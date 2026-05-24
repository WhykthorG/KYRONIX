import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DirectMessageApi } from '@/services/supabaseApi';
import { supabase } from '@/lib/supabase';
import { createRealtimeChannelName } from '@/lib/realtimeChannels';
import {
  buildCallEventMessage,
  buildDirectConversationId,
  buildDirectMessagePayload,
  CHAT_BUCKETS,
  CHAT_CALL_STATUSES,
  CHAT_CALL_TYPES,
  CHAT_MESSAGE_TYPES,
  CHAT_SIGNAL_TYPES,
} from '@shared/contracts/chat';
import {
  createChatDownloadUrl,
  endChatCall,
  joinChatCall,
  sendChatSignal,
  startChatCall,
  uploadChatMedia,
} from '@/lib/chatClient';
import {
  Check,
  CheckCheck,
  Clock3,
  Loader2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  Send,
  Square,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { CHAT_CALL_RINGING_TIMEOUT_MS } from '@shared/contracts/chat';
import { OBSERVABILITY_EVENT_TYPES } from '@shared/contracts/observability';
import { reportFrontendCallIssue } from '@/lib/observabilityClient';
import {
  buildRtcConfiguration,
  getRtcConfigurationDiagnostics,
  shouldRequestVideoForCallType,
} from '@/lib/webrtcConfig';
import { ChatPresenceBadge } from '@/components/chat/ChatPresenceBadge';
import { CHAT_PRESENCE_LABELS, formatGroupPresenceSummary } from '@/hooks/useChatPresence';

function createMediaUrlKey(attachment) {
  return `${attachment.bucket}:${attachment.path}`;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function VideoTile({ stream, muted = false, label }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-slate-950">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="h-28 w-full object-cover"
      />
      <div className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
        {label}
      </div>
    </div>
  );
}

export default function ChatWindow({
  contact,
  currentUser,
  getPresenceForEmail,
  getConversationPresenceSummary,
  isPresenceReady = false,
  onClose,
  onMinimize,
  initialIncomingCall = null,
  variant = 'floating',
  className = '',
}) {
  const isEmbedded = variant === 'embedded';

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [resolvingMedia, setResolvingMedia] = useState(false);
  const [mediaUrls, setMediaUrls] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [activeCall, setActiveCall] = useState(initialIncomingCall);
  const [callMode, setCallMode] = useState(initialIncomingCall?.call_type || null);
  const [isCallBusy, setIsCallBusy] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [pendingOffers, setPendingOffers] = useState([]);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [persistedCallEventId, setPersistedCallEventId] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [ringingExpiresInMs, setRingingExpiresInMs] = useState(null);
  const bottomRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const pendingSignalsRef = useRef(new Map());
  const offeredPeersRef = useRef(new Set());
  const reportedCallIssuesRef = useRef(new Set());
  const localStreamRef = useRef(null);
  const isGroupConversation = contact?.conversation?.type === 'group' || contact?.role === 'group';
  const rtcConfiguration = useMemo(() => buildRtcConfiguration(), []);
  const rtcDiagnostics = useMemo(() => getRtcConfigurationDiagnostics(), []);
  const convId = useMemo(
    () => contact?.conversationId || buildDirectConversationId(currentUser.email, contact.email),
    [contact?.conversationId, contact.email, currentUser.email]
  );
  const conversationParticipantEmails = useMemo(() => (
    isGroupConversation
      ? (contact?.conversation?.participants || [])
          .map((participant) => participant.participant_email)
          .filter((email) => email && email !== currentUser.email)
      : (() => {
          const participantEmails = (contact?.conversation?.participants || [])
            .map((participant) => normalizeEmail(participant.participant_email))
            .filter((email) => email && email !== normalizeEmail(currentUser.email));

          if (participantEmails.length > 0) {
            return participantEmails;
          }

          const fallbackEmail = normalizeEmail(contact?.email);
          return fallbackEmail.includes('@') ? [fallbackEmail] : [];
        })()
  ), [contact?.conversation?.participants, contact.email, currentUser.email, isGroupConversation]);

  const sortByDate = (items) => [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const isCallActive = activeCall && [CHAT_CALL_STATUSES.RINGING, CHAT_CALL_STATUSES.ACTIVE].includes(activeCall.status);
  const isIncomingCall = activeCall?.status === CHAT_CALL_STATUSES.RINGING
    && activeCall?.initiator_email !== currentUser.email
    && conversationParticipantEmails.length > 0;
  const isDirectConversation = !isGroupConversation;
  const activeCallRef = useRef(activeCall);
  const callModeRef = useRef(callMode);
  const isGroupConversationRef = useRef(isGroupConversation);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callModeRef.current = callMode;
  }, [callMode]);

  useEffect(() => {
    isGroupConversationRef.current = isGroupConversation;
  }, [isGroupConversation]);

  const participantSummary = useMemo(() => {
    if (isGroupConversation) {
      return `${conversationParticipantEmails.length + 1} participantes`;
    }
    return contact.role;
  }, [contact.role, conversationParticipantEmails.length, isGroupConversation]);
  const directPresence = useMemo(
    () => getPresenceForEmail?.(contact?.email),
    [contact?.email, getPresenceForEmail]
  );
  const groupPresenceSummary = useMemo(
    () => (
      isGroupConversation
        ? getConversationPresenceSummary?.(conversationParticipantEmails, currentUser.email)
        : null
    ),
    [conversationParticipantEmails, currentUser.email, getConversationPresenceSummary, isGroupConversation]
  );
  const statusSummary = useMemo(() => {
    if (isGroupConversation) {
      return formatGroupPresenceSummary(
        groupPresenceSummary || { onlineCount: 0, idleCount: 0, offlineCount: 0 }
      );
    }

    return CHAT_PRESENCE_LABELS[directPresence?.state] || CHAT_PRESENCE_LABELS.offline;
  }, [directPresence?.state, groupPresenceSummary, isGroupConversation]);

  const resolveParticipantLabel = (email) => {
    if (email === currentUser.email) {
      return 'Voce';
    }

    const participant = (contact?.conversation?.participants || []).find(
      (item) => item.participant_email === email
    );
    return participant?.participant_email || email;
  };

  const syncRemoteParticipant = (email, stream) => {
    setRemoteParticipants((prev) => {
      const others = prev.filter((item) => item.email !== email);
      return [...others, { email, stream }].sort((left, right) => left.email.localeCompare(right.email));
    });
  };

  const removeRemoteParticipant = (email) => {
    setRemoteParticipants((prev) => prev.filter((item) => item.email !== email));
  };

  const reportCallIssue = async ({
    eventType = OBSERVABILITY_EVENT_TYPES.FRONTEND_CALL_FAILURE,
    message,
    error = null,
    metadata = {},
    dedupeKey = null,
  }) => {
    const resolvedKey = dedupeKey || `${eventType}:${message}`;
    if (reportedCallIssuesRef.current.has(resolvedKey)) {
      return;
    }

    reportedCallIssuesRef.current.add(resolvedKey);
    await reportFrontendCallIssue({
      eventType,
      message,
      metadata: {
        conversation_id: convId,
        contact_email: contact?.email || null,
        call_id: activeCall?.id || null,
        call_status: activeCall?.status || null,
        error_name: error?.name || null,
        error_message: error?.message || null,
        error_stack: error?.stack || null,
        ...metadata,
      },
    }).catch(() => {});
  };

  const queuePendingSignal = (signal) => {
    const senderEmail = normalizeEmail(signal?.sender_email);
    if (!senderEmail) {
      return;
    }

    const currentSignals = pendingSignalsRef.current.get(senderEmail) || [];
    pendingSignalsRef.current.set(senderEmail, [...currentSignals, signal]);
  };

  const flushPendingSignals = async (remoteEmail) => {
    const normalizedRemoteEmail = normalizeEmail(remoteEmail);
    const connection = peerConnectionsRef.current.get(normalizedRemoteEmail);
    if (!connection) {
      return;
    }

    const pendingSignals = pendingSignalsRef.current.get(normalizedRemoteEmail) || [];
    if (pendingSignals.length === 0) {
      return;
    }

    const remainingSignals = [];

    for (const signal of pendingSignals) {
      try {
        if (signal.signal_type === CHAT_SIGNAL_TYPES.ANSWER) {
          if (!connection.currentRemoteDescription && signal.payload) {
            await connection.setRemoteDescription(new RTCSessionDescription(signal.payload));
            setCallStartedAt((current) => current || Date.now());
          }
          continue;
        }

        if (signal.signal_type === CHAT_SIGNAL_TYPES.ICE_CANDIDATE) {
          if (!connection.remoteDescription && !connection.currentRemoteDescription) {
            remainingSignals.push(signal);
            continue;
          }

          await connection.addIceCandidate(new RTCIceCandidate(signal.payload));
          continue;
        }

        remainingSignals.push(signal);
      } catch (error) {
        remainingSignals.push(signal);
        reportCallIssue({
          message: 'Falha ao aplicar sinal pendente da chamada.',
          error,
          metadata: {
            remote_email: normalizedRemoteEmail,
            signal_type: signal?.signal_type || null,
          },
          dedupeKey: `pending-signal:${normalizedRemoteEmail}:${signal?.signal_type || 'unknown'}`,
        });
      }
    }

    if (remainingSignals.length > 0) {
      pendingSignalsRef.current.set(normalizedRemoteEmail, remainingSignals);
      return;
    }

    pendingSignalsRef.current.delete(normalizedRemoteEmail);
  };

  const markConversationMessagesAsRead = (rows = []) => {
    rows.forEach((message) => {
      if (message.sender_email !== currentUser.email && !message.read) {
        DirectMessageApi.update(message.id, { read: true }).catch(() => {});
      }
    });
  };

  useEffect(() => {
    let cancelled = false;
    const pendingMessages = [];
    let loadDone = false;

    const channel = supabase
      .channel(createRealtimeChannelName(`chat_${convId}`))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        const incoming = payload.new;
        if (!loadDone) {
          pendingMessages.push(incoming);
          return;
        }

        setMessages((prev) => {
          if (prev.find((message) => message.id === incoming.id)) return prev;
          return sortByDate([...prev, incoming]);
        });
        markConversationMessagesAsRead([incoming]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => {
        const updated = payload.new;
        setMessages((prev) => prev.map((message) => (
          message.id === updated.id ? { ...message, ...updated } : message
        )));
      })
      .subscribe();

    const loadMessages = async () => {
      const result = await DirectMessageApi.filter({ conversation_id: convId }, 'created_at', 100);
      const loadedMessages = Array.isArray(result) ? result : (result?.data ?? []);
      if (cancelled) return;

      loadDone = true;
      const existingIds = new Set(loadedMessages.map((message) => message.id));
      const nextMessages = sortByDate([
        ...loadedMessages,
        ...pendingMessages.filter((message) => !existingIds.has(message.id)),
      ]);
      setMessages(nextMessages);
      markConversationMessagesAsRead(nextMessages);
    };

    loadMessages().catch(() => {});

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [convId, currentUser.email]);

  useEffect(() => {
    let cancelled = false;
    const attachments = messages
      .flatMap((message) => Array.isArray(message.attachments) ? message.attachments : [])
      .filter((attachment) => attachment?.path && attachment?.bucket);
    const missingAttachments = attachments.filter((attachment) => !mediaUrls[createMediaUrlKey(attachment)]);
    if (missingAttachments.length === 0) {
      return undefined;
    }

    setResolvingMedia(true);
    Promise.all(missingAttachments.map(async (attachment) => {
      const result = await createChatDownloadUrl({
        bucket: attachment.bucket,
        path: attachment.path,
      });
      return [createMediaUrlKey(attachment), result.signedUrl];
    }))
      .then((entries) => {
        if (!cancelled) {
          setMediaUrls((prev) => Object.fromEntries([...Object.entries(prev), ...entries]));
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Nao foi possivel resolver uma midia do chat.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setResolvingMedia(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mediaUrls, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeCall, remoteParticipants]);

  const cleanupMediaResources = ({ preserveCallState = true } = {}) => {
    peerConnectionsRef.current.forEach((connection) => {
      connection.ontrack = null;
      connection.onicecandidate = null;
      connection.close();
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    remoteStreamsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    offeredPeersRef.current.clear();
    pendingSignalsRef.current.clear();
    reportedCallIssuesRef.current.clear();
    setRemoteParticipants([]);
    setIsMuted(false);
    setIsCameraEnabled(true);
    setPendingOffers([]);
    setCallStartedAt(null);
    setRingingExpiresInMs(null);
    if (!preserveCallState) {
      setActiveCall(null);
      setCallMode(null);
      setPersistedCallEventId(null);
    }
  };

  useEffect(() => {
    const callChannel = supabase
      .channel(createRealtimeChannelName(`chat_calls_${convId}`))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_call_sessions',
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: nextCall }) => {
        if (!nextCall?.id) return;
        setActiveCall(nextCall);
        setCallMode(nextCall.call_type || null);
        if (
          [
            CHAT_CALL_STATUSES.ENDED,
            CHAT_CALL_STATUSES.MISSED,
            CHAT_CALL_STATUSES.DECLINED,
            CHAT_CALL_STATUSES.FAILED,
          ].includes(nextCall.status)
        ) {
          cleanupMediaResources({ preserveCallState: false });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_call_signals',
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: signal }) => {
        if (!signal?.id || normalizeEmail(signal.recipient_email) !== normalizeEmail(currentUser.email)) return;
        handleIncomingSignal(signal).catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callChannel);
    };
  }, [convId, currentUser.email, conversationParticipantEmails.join('|')]);

  useEffect(() => {
    if (!activeCall?.id || activeCall.status !== CHAT_CALL_STATUSES.RINGING || !activeCall.started_at) {
      setRingingExpiresInMs(null);
      return undefined;
    }

    const updateRemaining = () => {
      const remainingMs = Math.max(
        0,
        Date.parse(activeCall.started_at) + CHAT_CALL_RINGING_TIMEOUT_MS - Date.now()
      );
      setRingingExpiresInMs(remainingMs);
    };

    updateRemaining();
    const intervalId = setInterval(updateRemaining, 1000);
    return () => clearInterval(intervalId);
  }, [activeCall?.id, activeCall?.started_at, activeCall?.status]);

  useEffect(() => {
    if (!activeCall?.id || activeCall.status !== CHAT_CALL_STATUSES.RINGING || !activeCall.started_at) {
      return undefined;
    }

    const remainingMs = Math.max(
      0,
      Date.parse(activeCall.started_at) + CHAT_CALL_RINGING_TIMEOUT_MS - Date.now()
    );

    const timeoutId = setTimeout(() => {
      const timeoutStatus = isIncomingCall ? CHAT_CALL_STATUSES.MISSED : CHAT_CALL_STATUSES.FAILED;
      reportCallIssue({
        eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_CALL_STUCK,
        message: 'Chamada ficou em ringing alem do timeout configurado.',
        metadata: {
          timeout_ms: CHAT_CALL_RINGING_TIMEOUT_MS,
          direction: isIncomingCall ? 'incoming' : 'outgoing',
        },
        dedupeKey: `ringing-timeout:${activeCall.id}`,
      });
      finishCall(timeoutStatus).catch(() => {});
    }, remainingMs);

    return () => clearTimeout(timeoutId);
  }, [activeCall?.id, activeCall?.started_at, activeCall?.status, isIncomingCall]);

  useEffect(() => {
    if (!activeCall?.id || activeCall.status !== CHAT_CALL_STATUSES.ACTIVE || !callStartedAt || remoteParticipants.length > 0) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      reportCallIssue({
        eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_CALL_STUCK,
        message: 'Chamada ativa sem participante remoto conectado apos o handshake inicial.',
        metadata: {
          remote_participant_count: remoteParticipants.length,
        },
        dedupeKey: `active-without-remote:${activeCall.id}`,
      });
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [activeCall?.id, activeCall?.status, callStartedAt, remoteParticipants.length]);

  useEffect(() => {
    if (pendingOffers.length === 0 || !activeCall?.id) {
      return undefined;
    }

    pendingOffers.forEach((signal) => {
      handleRemoteOffer(signal).catch(() => {});
    });
    setPendingOffers([]);
    return undefined;
  }, [activeCall?.id, pendingOffers]);

  useEffect(() => () => {
    cleanupMediaResources({ preserveCallState: false });
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  }, []);

  const persistCallEvent = async (callRecord, status, durationSeconds = null) => {
    if (!callRecord?.id || persistedCallEventId === callRecord.id) {
      return;
    }

    try {
      const eventMessage = buildCallEventMessage({
        currentUser,
        contact,
        callType: callRecord.call_type || callMode || CHAT_CALL_TYPES.AUDIO,
        callStatus: status,
        callId: callRecord.id,
        durationSeconds,
      });
      await DirectMessageApi.create(eventMessage);
      setPersistedCallEventId(callRecord.id);
    } catch {
      // Keep call teardown resilient if event persistence fails.
    }
  };

  const ensureLocalStream = async (type) => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: shouldRequestVideoForCallType(type),
      });
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      reportCallIssue({
        message: 'Falha ao acessar dispositivos locais da chamada.',
        error,
        metadata: {
          requested_video: shouldRequestVideoForCallType(type),
          transport_mode: rtcDiagnostics.transportMode,
        },
        dedupeKey: `local-media:${type}:${error?.name || 'unknown'}`,
      });
      throw error;
    }
  };

  const getOrCreatePeerConnection = async (remoteEmail, callRecord, stream) => {
    const normalizedRemoteEmail = normalizeEmail(remoteEmail);
    if (peerConnectionsRef.current.has(normalizedRemoteEmail)) {
      return peerConnectionsRef.current.get(normalizedRemoteEmail);
    }

    const connection = new RTCPeerConnection(rtcConfiguration);
    const remoteStream = new MediaStream();
    remoteStreamsRef.current.set(normalizedRemoteEmail, remoteStream);
    syncRemoteParticipant(normalizedRemoteEmail, remoteStream);

    stream.getTracks().forEach((track) => connection.addTrack(track, stream));

    connection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!remoteStream.getTracks().some((current) => current.id === track.id)) {
          remoteStream.addTrack(track);
        }
      });
      syncRemoteParticipant(normalizedRemoteEmail, remoteStream);
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate || !callRecord?.id) return;
      sendChatSignal(callRecord.id, {
        signalType: CHAT_SIGNAL_TYPES.ICE_CANDIDATE,
        recipientEmail: normalizedRemoteEmail,
        payload: event.candidate.toJSON(),
      }).catch((error) => {
        reportCallIssue({
          message: 'Falha ao enviar candidato ICE da chamada.',
          error,
          metadata: {
            remote_email: normalizedRemoteEmail,
          },
          dedupeKey: `ice-send:${callRecord?.id || 'unknown'}:${normalizedRemoteEmail}`,
        });
      });
    };

    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        setCallStartedAt((current) => current || Date.now());
        return;
      }

      if (['closed', 'failed', 'disconnected'].includes(connection.connectionState)) {
        removeRemoteParticipant(normalizedRemoteEmail);
        if (connection.connectionState === 'failed') {
          reportCallIssue({
            message: 'Peer connection falhou durante a chamada.',
            metadata: {
              remote_email: normalizedRemoteEmail,
              connection_state: connection.connectionState,
              transport_mode: rtcDiagnostics.transportMode,
            },
            dedupeKey: `peer-failed:${normalizedRemoteEmail}`,
          });
        }
      }
    };

    peerConnectionsRef.current.set(normalizedRemoteEmail, connection);
    await flushPendingSignals(normalizedRemoteEmail);
    return connection;
  };

  const createOfferForParticipant = async (remoteEmail, callRecord, stream) => {
    const normalizedRemoteEmail = normalizeEmail(remoteEmail);
    if (!normalizedRemoteEmail || normalizedRemoteEmail === normalizeEmail(currentUser.email)) return;
    if (offeredPeersRef.current.has(normalizedRemoteEmail)) return;

    const connection = await getOrCreatePeerConnection(normalizedRemoteEmail, callRecord, stream);
    if (connection.signalingState !== 'stable') {
      return;
    }

    offeredPeersRef.current.add(normalizedRemoteEmail);
    const offer = await connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: (callRecord?.call_type || callMode) === CHAT_CALL_TYPES.VIDEO,
    });
    await connection.setLocalDescription(offer);
    try {
      await sendChatSignal(callRecord.id, {
        signalType: CHAT_SIGNAL_TYPES.OFFER,
        recipientEmail: normalizedRemoteEmail,
        payload: offer,
      });
    } catch (error) {
      reportCallIssue({
        message: 'Falha ao enviar offer da chamada.',
        error,
        metadata: {
          remote_email: normalizedRemoteEmail,
        },
        dedupeKey: `offer-send:${callRecord?.id || 'unknown'}:${normalizedRemoteEmail}`,
      });
      throw error;
    }
    await flushPendingSignals(normalizedRemoteEmail);
  };

  const handleRemoteOffer = async (signal) => {
    const callRecord = activeCallRef.current;
    if (!callRecord?.id) {
      return;
    }

    const resolvedCallType = callRecord.call_type || callModeRef.current || CHAT_CALL_TYPES.AUDIO;
    const stream = await ensureLocalStream(resolvedCallType);
    const connection = await getOrCreatePeerConnection(signal.sender_email, callRecord, stream);
    await connection.setRemoteDescription(new RTCSessionDescription(signal.payload));
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    try {
      await sendChatSignal(callRecord.id, {
        signalType: CHAT_SIGNAL_TYPES.ANSWER,
        recipientEmail: signal.sender_email,
        payload: answer,
      });
    } catch (error) {
      reportCallIssue({
        message: 'Falha ao enviar answer da chamada.',
        error,
        metadata: {
          remote_email: signal.sender_email,
        },
        dedupeKey: `answer-send:${callRecord?.id || 'unknown'}:${signal?.sender_email || 'unknown'}`,
      });
      throw error;
    }
    setCallStartedAt((current) => current || Date.now());
    await flushPendingSignals(signal.sender_email);
  };

  const handleIncomingSignal = async (signal) => {
    const senderEmail = normalizeEmail(signal?.sender_email);

    if (signal.signal_type === CHAT_SIGNAL_TYPES.HANGUP) {
      if (isGroupConversationRef.current) {
        const connection = peerConnectionsRef.current.get(senderEmail);
        if (connection) {
          connection.close();
          peerConnectionsRef.current.delete(senderEmail);
        }
        removeRemoteParticipant(senderEmail);
        return;
      }

      cleanupMediaResources({ preserveCallState: false });
      return;
    }

    if (signal.signal_type === CHAT_SIGNAL_TYPES.OFFER) {
      setPendingOffers((prev) => (
        prev.some((entry) => entry.id === signal.id) ? prev : [...prev, signal]
      ));
      return;
    }

    const connection = peerConnectionsRef.current.get(senderEmail);
    if (!connection) {
      queuePendingSignal(signal);
      return;
    }

    if (signal.signal_type === CHAT_SIGNAL_TYPES.ANSWER) {
      await connection.setRemoteDescription(new RTCSessionDescription(signal.payload));
      setCallStartedAt((current) => current || Date.now());
      await flushPendingSignals(senderEmail);
      return;
    }

    if (signal.signal_type === CHAT_SIGNAL_TYPES.ICE_CANDIDATE && signal.payload) {
      if (!connection.remoteDescription && !connection.currentRemoteDescription) {
        queuePendingSignal(signal);
        return;
      }
      await connection.addIceCandidate(new RTCIceCandidate(signal.payload));
    }
  };

  const startCallFlow = async (type) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      toast.error('Este navegador nao suporta chamadas de audio/video.');
      return;
    }

    if (!isDirectConversation) {
      toast.error('Esta versao suporta apenas ligacoes diretas 1:1.');
      return;
    }

    if (!rtcDiagnostics.turnConfigured && !import.meta.env.DEV) {
      toast.warning(rtcDiagnostics.warning);
      reportCallIssue({
        message: 'Chamada iniciada sem TURN configurado em ambiente nao-dev.',
        metadata: {
          transport_mode: rtcDiagnostics.transportMode,
          requested_call_type: type,
        },
        dedupeKey: `turn-missing:${type}`,
      });
    }

    setIsCallBusy(true);
    try {
      const recipients = conversationParticipantEmails.filter(Boolean);
      if (recipients.length !== 1) {
        throw new Error('A chamada 1:1 requer exatamente um participante remoto.');
      }

      const { call } = await startChatCall({
        conversationId: convId,
        recipientEmail: recipients[0],
        participantEmails: [recipients[0]],
        callType: type,
      });

      setActiveCall(call);
      setCallMode(type);
      const stream = await ensureLocalStream(type);
      await createOfferForParticipant(recipients[0], call, stream);
    } catch (error) {
      reportCallIssue({
        message: 'Falha ao iniciar a chamada.',
        error,
        metadata: {
          requested_call_type: type,
        },
        dedupeKey: `start-call:${type}:${error?.message || 'unknown'}`,
      });
      toast.error(error?.message || 'Nao foi possivel iniciar a chamada.');
      cleanupMediaResources({ preserveCallState: false });
    } finally {
      setIsCallBusy(false);
    }
  };

  const acceptIncomingCall = async () => {
    if (!activeCall?.id) return;
    setIsCallBusy(true);
    try {
      const { call } = await joinChatCall(activeCall.id);
      setActiveCall(call);
      setCallMode(call.call_type || callMode);
      await ensureLocalStream(call.call_type || callMode || CHAT_CALL_TYPES.AUDIO);
    } catch (error) {
      reportCallIssue({
        message: 'Falha ao aceitar a chamada recebida.',
        error,
        dedupeKey: `accept-call:${activeCall?.id || 'unknown'}:${error?.message || 'unknown'}`,
      });
      toast.error(error?.message || 'Nao foi possivel aceitar a chamada.');
    } finally {
      setIsCallBusy(false);
    }
  };

  const finishCall = async (status = CHAT_CALL_STATUSES.ENDED) => {
    if (!activeCall?.id) {
      cleanupMediaResources({ preserveCallState: false });
      return;
    }

    const callRecord = activeCall;
    setIsCallBusy(true);
    try {
      await Promise.all(conversationParticipantEmails.map((email) => (
        sendChatSignal(callRecord.id, {
          signalType: CHAT_SIGNAL_TYPES.HANGUP,
          recipientEmail: email,
          payload: { status },
        }).catch(() => {})
      )));
      await endChatCall(callRecord.id, { status });
      const durationSeconds = callStartedAt
        ? Math.max(1, Math.round((Date.now() - callStartedAt) / 1000))
        : null;
      await persistCallEvent(callRecord, status, durationSeconds);
    } catch (error) {
      reportCallIssue({
        message: 'Falha ao encerrar a chamada.',
        error,
        metadata: { status },
        dedupeKey: `end-call:${callRecord?.id || 'unknown'}:${status}:${error?.message || 'unknown'}`,
      });
      toast.error(error?.message || 'Nao foi possivel encerrar a chamada.');
    } finally {
      cleanupMediaResources({ preserveCallState: false });
      setIsCallBusy(false);
    }
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const nextEnabled = !isCameraEnabled;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Gravacao de audio nao suportada neste navegador.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        setIsRecording(false);
        const durationMs = Math.max(1, Date.now() - (recordingStartedAtRef.current || Date.now()));
        setRecordingDurationMs(durationMs);
        stream.getTracks().forEach((track) => track.stop());

        if (recordingChunksRef.current.length === 0) {
          return;
        }

        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const extension = blob.type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-message.${extension}`, { type: blob.type || 'audio/webm' });
        await sendVoiceMessage(file, durationMs);
        recordingChunksRef.current = [];
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDurationMs(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDurationMs(Date.now() - recordingStartedAtRef.current);
      }, 250);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel iniciar a gravacao.');
    }
  };

  const stopVoiceRecording = () => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }
    recorderRef.current.stop();
    recorderRef.current = null;
  };

  const sendVoiceMessage = async (file, durationMs) => {
    setIsUploadingVoice(true);
    try {
      const upload = await uploadChatMedia({
        file,
        bucket: CHAT_BUCKETS.VOICE,
        conversationId: convId,
      });
      const payload = buildDirectMessagePayload({
        currentUser,
        contact,
        content: '',
        messageType: CHAT_MESSAGE_TYPES.VOICE,
        attachments: [{
          type: 'audio',
          bucket: upload.bucket,
          path: upload.path,
          contentType: file.type,
          fileName: file.name,
          sizeBytes: file.size,
          durationMs,
        }],
        metadata: { durationMs },
      });
      const created = await DirectMessageApi.create(payload);
      setMessages((prev) => sortByDate([...prev, created]));
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel enviar a mensagem de voz.');
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const sendTextMessage = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    const payload = buildDirectMessagePayload({
      currentUser,
      contact,
      content,
      messageType: CHAT_MESSAGE_TYPES.TEXT,
    });
    const tempId = `temp_${Date.now()}`;
    setText('');
    setMessages((prev) => [...prev, { ...payload, id: tempId, pending: true }]);

    try {
      const created = await DirectMessageApi.create(payload);
      setMessages((prev) => {
        const withoutTemp = prev.filter((message) => message.id !== tempId);
        if (withoutTemp.some((message) => message.id === created.id)) {
          return withoutTemp;
        }
        return sortByDate([...withoutTemp, created]);
      });
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setText(content);
      toast.error(error?.message || 'Nao foi possivel enviar a mensagem.');
    }
  };

  const renderMessageStatus = (message) => {
    if (message.pending) return <Clock3 className="w-2.5 h-2.5" />;
    if (message.read) return <CheckCheck className="w-2.5 h-2.5 text-sky-300" />;
    return <Check className="w-2.5 h-2.5" />;
  };

  const renderMessageBody = (message) => {
    if (message.message_type === CHAT_MESSAGE_TYPES.CALL_EVENT) {
      const callTypeLabel = message?.media_metadata?.callType === CHAT_CALL_TYPES.VIDEO
        ? 'Videochamada'
        : 'Chamada de voz';
      const statusLabel = message?.media_metadata?.callStatus || 'encerrada';
      const duration = Number.isFinite(message?.media_metadata?.durationSeconds)
        ? ` • ${message.media_metadata.durationSeconds}s`
        : '';
      return (
        <div className="space-y-1">
          <p className="font-medium">{callTypeLabel}</p>
          <p className="text-[11px] opacity-80 capitalize">{statusLabel}{duration}</p>
        </div>
      );
    }

    if (message.message_type === CHAT_MESSAGE_TYPES.VOICE) {
      const attachment = Array.isArray(message.attachments) ? message.attachments[0] : null;
      const resolvedUrl = attachment ? mediaUrls[createMediaUrlKey(attachment)] : null;
      return (
        <div className="space-y-2">
          <p className="text-[11px] opacity-80">Mensagem de voz</p>
          {resolvedUrl ? (
            <audio controls src={resolvedUrl} className="max-w-full" />
          ) : (
            <p className="text-[11px] opacity-70">
              {resolvingMedia ? 'Carregando audio...' : 'Audio indisponivel'}
            </p>
          )}
        </div>
      );
    }

    return <p>{message.content}</p>;
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-white/10 shadow-2xl',
        isEmbedded ? 'h-full min-h-[36rem] w-full' : 'h-[36rem] w-[26rem]',
        className
      )}
      style={{ background: 'rgba(15,15,30,0.97)', backdropFilter: 'blur(16px)' }}
    >
      <div
        className="flex flex-shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2"
        style={{ background: 'rgba(99,102,241,0.2)' }}
      >
        <div className="relative flex-shrink-0">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarImage src={contact.avatarUrl || undefined} alt={contact.name || 'Conversa'} />
            <AvatarFallback className="bg-indigo-500 text-xs font-bold text-white">
              {contact.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!isGroupConversation && isPresenceReady && (
            <ChatPresenceBadge
              state={directPresence?.state}
              className="absolute bottom-0 right-0"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{contact.name}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            {!isGroupConversation && isPresenceReady && (
              <ChatPresenceBadge
                state={directPresence?.state}
                className="h-2 w-2 flex-shrink-0"
                ringClassName="ring-transparent"
              />
            )}
            <p className="truncate capitalize">{`${participantSummary} • ${statusSummary}`}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => startCallFlow(CHAT_CALL_TYPES.AUDIO)}
          disabled={isCallBusy || isCallActive || !isDirectConversation || conversationParticipantEmails.length !== 1}
          className="p-1 text-white/50 hover:text-white disabled:opacity-40"
          aria-label={`Iniciar chamada de voz com ${contact.name}`}
        >
          {isCallBusy && !isCallActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Phone className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => startCallFlow(CHAT_CALL_TYPES.VIDEO)}
          disabled={isCallBusy || isCallActive || !isDirectConversation || conversationParticipantEmails.length !== 1}
          className="p-1 text-white/50 hover:text-white disabled:opacity-40"
          aria-label={`Iniciar videochamada com ${contact.name}`}
        >
          <Video className="h-3.5 w-3.5" />
        </button>
        {!isEmbedded && (
          <button onClick={onMinimize} className="p-1 text-white/40 hover:text-white" aria-label={`Minimizar conversa com ${contact.name}`}><Minimize2 className="h-3.5 w-3.5" /></button>
        )}
        <button onClick={onClose} className="p-1 text-white/40 hover:text-red-400" aria-label={`Fechar conversa com ${contact.name}`}><X className="h-3.5 w-3.5" /></button>
      </div>

      {activeCall && (
        <div className="space-y-3 border-b border-white/10 bg-black/30 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white">
                {callMode === CHAT_CALL_TYPES.VIDEO ? 'Videochamada' : 'Chamada de voz'}
              </p>
              <p className="text-[11px] capitalize text-white/60">
                {activeCall.status === CHAT_CALL_STATUSES.RINGING
                  ? (isIncomingCall ? 'Chamada recebida' : 'Chamando...')
                  : activeCall.status}
              </p>
              {!rtcDiagnostics.turnConfigured && (
                <p className="text-[10px] text-amber-200/80">
                  TURN nao configurado; chamadas fora da rede local podem falhar.
                </p>
              )}
              {activeCall.status === CHAT_CALL_STATUSES.RINGING && Number.isFinite(ringingExpiresInMs) && (
                <p className="text-[10px] text-white/35">
                  Timeout em {Math.max(0, Math.ceil(ringingExpiresInMs / 1000))}s
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeCall.status === CHAT_CALL_STATUSES.RINGING && (
                <>
                  {isIncomingCall && (
                    <button
                      type="button"
                      onClick={acceptIncomingCall}
                      disabled={isCallBusy}
                      className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] text-white"
                    >
                      Entrar
                    </button>
                  )}
                  {isIncomingCall && (
                    <button
                      type="button"
                      onClick={() => finishCall(CHAT_CALL_STATUSES.DECLINED)}
                      disabled={isCallBusy}
                      className="rounded-full bg-amber-500 px-3 py-1 text-[11px] text-white"
                    >
                      Recusar
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => finishCall(CHAT_CALL_STATUSES.ENDED)}
                disabled={isCallBusy}
                className="rounded-full bg-rose-500 px-3 py-1 text-[11px] text-white"
              >
                Encerrar
              </button>
            </div>
          </div>

          {callMode === CHAT_CALL_TYPES.VIDEO && (
            <div className="grid grid-cols-2 gap-2">
              {localStreamRef.current && (
                <VideoTile
                  stream={localStreamRef.current}
                  muted
                  label={resolveParticipantLabel(currentUser.email)}
                />
              )}
              {remoteParticipants.map((participant) => (
                <VideoTile
                  key={participant.email}
                  stream={participant.stream}
                  label={resolveParticipantLabel(participant.email)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              disabled={!localStreamRef.current}
              className="rounded-full border border-white/10 bg-white/10 p-2 text-white disabled:opacity-40"
            >
              {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
            {callMode === CHAT_CALL_TYPES.VIDEO && (
              <button
                type="button"
                onClick={toggleCamera}
                disabled={!localStreamRef.current}
                className="rounded-full border border-white/10 bg-white/10 p-2 text-white disabled:opacity-40"
              >
                {isCameraEnabled ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-white/30">Inicie a conversa.</p>
        )}
        {messages.map((message) => {
          const mine = message.sender_email === currentUser.email;
          const pending = Boolean(message.pending);
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs ${
                  mine ? 'rounded-br-sm bg-indigo-600 text-white' : 'rounded-bl-sm bg-white/10 text-white/90'
                } ${pending ? 'opacity-60' : ''}`}
              >
                {!mine && isGroupConversation && (
                  <p className="mb-1 text-[10px] font-semibold text-white/55">{resolveParticipantLabel(message.sender_email)}</p>
                )}
                {renderMessageBody(message)}
                <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-60">
                  <span>
                    {pending
                      ? 'Enviando...'
                      : formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                  {mine && renderMessageStatus(message)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 space-y-2 border-t border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            disabled={isUploadingVoice}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isRecording ? 'bg-rose-500 text-white' : 'bg-white/10 text-white'
            } disabled:opacity-40`}
            aria-label={isRecording ? 'Parar gravacao de voz' : 'Gravar mensagem de voz'}
          >
            {isUploadingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
              isRecording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendTextMessage();
              }
            }}
            placeholder="Mensagem..."
            className="flex-1 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white outline-none placeholder-white/30 focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={sendTextMessage}
            disabled={!text.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 transition-colors hover:bg-indigo-500 disabled:opacity-40"
            aria-label={`Enviar mensagem para ${contact.name}`}
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
        {(isRecording || isUploadingVoice) && (
          <p className="text-[11px] text-white/60">
            {isUploadingVoice
              ? 'Enviando mensagem de voz...'
              : `Gravando voz... ${Math.ceil(recordingDurationMs / 1000)}s`}
          </p>
        )}
      </div>
    </motion.div>
  );
}
