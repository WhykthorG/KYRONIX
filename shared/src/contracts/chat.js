// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
export const CHAT_BUCKETS = Object.freeze({
  VOICE: 'chat-voice',
  RECORDINGS: 'chat-recordings',
});

export const CHAT_MESSAGE_TYPES = Object.freeze({
  TEXT: 'text',
  VOICE: 'voice',
  SYSTEM: 'system',
  CALL_EVENT: 'call_event',
});

export const CHAT_ATTACHMENT_TYPES = Object.freeze({
  AUDIO: 'audio',
  VIDEO: 'video',
  IMAGE: 'image',
  FILE: 'file',
});

export const CHAT_CALL_TYPES = Object.freeze({
  AUDIO: 'audio',
  VIDEO: 'video',
});

export const CHAT_CALL_RINGING_TIMEOUT_MS = 45_000;

export const CHAT_CALL_STATUSES = Object.freeze({
  RINGING: 'ringing',
  ACTIVE: 'active',
  ENDED: 'ended',
  MISSED: 'missed',
  DECLINED: 'declined',
  FAILED: 'failed',
});

export const CHAT_SIGNAL_TYPES = Object.freeze({
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice_candidate',
  HANGUP: 'hangup',
});

export function buildDirectConversationId(emailA, emailB) {
  return [emailA, emailB]
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('__');
}

export function normalizeChatAttachment(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const type = String(value.type || '').trim().toLowerCase();
  const path = String(value.path || '').trim();

  if (!type || !path) {
    return null;
  }

  return {
    type,
    path,
    bucket: String(value.bucket || CHAT_BUCKETS.VOICE).trim(),
    contentType: String(value.contentType || '').trim() || null,
    fileName: String(value.fileName || '').trim() || null,
    sizeBytes: Number.isFinite(value.sizeBytes) ? Number(value.sizeBytes) : null,
    durationMs: Number.isFinite(value.durationMs) ? Number(value.durationMs) : null,
  };
}

export function normalizeChatAttachments(values) {
  return (Array.isArray(values) ? values : [])
    .map(normalizeChatAttachment)
    .filter(Boolean);
}

export function buildDirectMessagePayload({
  currentUser,
  contact,
  content = '',
  messageType = CHAT_MESSAGE_TYPES.TEXT,
  attachments = [],
  metadata = null,
  now = new Date().toISOString(),
}) {
  const senderEmail = String(currentUser?.email || '').trim().toLowerCase();
  const isGroupConversation = contact?.conversation?.type === 'group' || contact?.role === 'group';
  const resolvedConversationId = String(
    contact?.conversationId
    || (isGroupConversation ? contact?.conversation?.id || '' : buildDirectConversationId(senderEmail, contact?.email))
  ).trim().toLowerCase();
  const recipientEmail = isGroupConversation
    ? `group:${resolvedConversationId}`
    : String(contact?.email || '').trim().toLowerCase();
  const normalizedContent = String(content || '').trim();
  const normalizedAttachments = normalizeChatAttachments(attachments);

  if (!senderEmail || !recipientEmail || !resolvedConversationId) {
    throw new Error('Participantes invalidos para envio da mensagem.');
  }

  if (messageType === CHAT_MESSAGE_TYPES.TEXT && !normalizedContent) {
    throw new Error('Mensagem de texto vazia.');
  }

  if (messageType !== CHAT_MESSAGE_TYPES.TEXT && normalizedAttachments.length === 0) {
    throw new Error('Midia obrigatoria para mensagens nao textuais.');
  }

  return {
    conversation_id: resolvedConversationId,
    sender_email: senderEmail,
    sender_name: currentUser?.full_name || currentUser?.email || senderEmail,
    recipient_email: recipientEmail,
    recipient_name: contact?.name || recipientEmail,
    content: normalizedContent || '',
    read: false,
    message_type: messageType,
    attachments: normalizedAttachments,
    media_metadata: metadata && typeof metadata === 'object' ? metadata : null,
    created_at: now,
  };
}

export function buildCallEventMessage({
  currentUser,
  contact,
  callType,
  callStatus,
  callId,
  durationSeconds = null,
  now = new Date().toISOString(),
}) {
  return buildDirectMessagePayload({
    currentUser,
    contact,
    content: '',
    messageType: CHAT_MESSAGE_TYPES.CALL_EVENT,
    metadata: {
      callId,
      callType,
      callStatus,
      durationSeconds: Number.isFinite(durationSeconds) ? Number(durationSeconds) : null,
      createdAt: now,
    },
    attachments: [{
      type: CHAT_ATTACHMENT_TYPES.AUDIO,
      path: `call-event/${callId || 'unknown'}`,
      bucket: CHAT_BUCKETS.RECORDINGS,
    }],
    now,
  });
}

export function getChatMessagePreview(message) {
  if (!message) return '';

  switch (message.message_type) {
    case CHAT_MESSAGE_TYPES.VOICE:
      return 'Mensagem de voz';
    case CHAT_MESSAGE_TYPES.CALL_EVENT: {
      const status = message?.media_metadata?.callStatus || '';
      const callType = message?.media_metadata?.callType || 'call';
      return `${callType === CHAT_CALL_TYPES.VIDEO ? 'Videochamada' : 'Chamada'} ${status}`;
    }
    case CHAT_MESSAGE_TYPES.SYSTEM:
      return 'Mensagem do sistema';
    default:
      return String(message.content || '').trim();
  }
}
