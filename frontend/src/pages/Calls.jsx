import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PhoneCall, Video, Clock3, Users, Phone, MonitorSmartphone } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import ContactList from '@/components/chat/ContactList';
import ChatWindow from '@/components/chat/ChatWindow';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { DirectMessageApi, UserProfileApi } from '@/services/supabaseApi';
import { listChatConversations } from '@/lib/chatClient';
import { CHAT_CALL_TYPES, CHAT_MESSAGE_TYPES } from '@shared/contracts/chat';
import { supabase } from '@/lib/supabase';
import { createRealtimeChannelName } from '@/lib/realtimeChannels';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getConversationPeer(conversation, currentUserEmail) {
  if (!conversation || conversation.type === 'group') {
    return null;
  }

  return (conversation.participants || []).find(
    (participant) => normalizeEmail(participant.participant_email) !== normalizeEmail(currentUserEmail)
  ) || null;
}

function buildSelectedContact(conversation, currentUserEmail, profilesByEmail) {
  if (!conversation?.id) return null;

  if (conversation.type === 'group') {
    return {
      email: conversation.id,
      name: conversation.title || 'Grupo',
      role: 'group',
      conversationId: conversation.id,
      conversation,
    };
  }

  const peer = getConversationPeer(conversation, currentUserEmail);
  const peerEmail = normalizeEmail(peer?.participant_email);
  const profile = profilesByEmail.get(peerEmail);

  return {
    email: peerEmail,
    name: profile?.full_name || peer?.participant_email || 'Contato',
    role: profile?.profile_type || 'contato',
    conversationId: conversation.id,
    conversation,
  };
}

function getCallStatusLabel(message) {
  const status = String(message?.media_metadata?.callStatus || 'ended').trim().toLowerCase();
  const labels = {
    ringing: 'Chamando',
    active: 'Ativa',
    ended: 'Encerrada',
    missed: 'Perdida',
    declined: 'Recusada',
    failed: 'Falhou',
  };
  return labels[status] || status;
}

function getCallDirection(message, currentUserEmail) {
  return normalizeEmail(message?.sender_email) === normalizeEmail(currentUserEmail) ? 'Saída' : 'Entrada';
}

export default function Calls() {
  const { user } = useAuth();
  const { profileType } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedContact, setSelectedContact] = useState(null);
  const currentUser = useMemo(() => ({
    email: user?.email || '',
    full_name: user?.user_metadata?.full_name || user?.email || '',
    id: user?.id || '',
  }), [user]);

  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async () => {
      const payload = await listChatConversations();
      return payload?.conversations || [];
    },
    enabled: !!user?.email,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['call-profiles'],
    queryFn: () => UserProfileApi.filter({ status: 'ativo' }, 'full_name', 500),
    enabled: !!user?.email,
  });

  const { data: directMessages = [] } = useQuery({
    queryKey: ['call-events'],
    queryFn: async () => {
      const result = await DirectMessageApi.filter({}, '-created_at', 200);
      return Array.isArray(result) ? result : (result?.data || []);
    },
    enabled: !!user?.email,
  });

  useEffect(() => {
    if (!user?.email) return undefined;

    const channel = supabase
      .channel(createRealtimeChannelName('calls-module-refresh'))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['call-events'] });
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.email]);

  const profilesByEmail = useMemo(() => {
    const map = new Map();
    for (const profile of profiles) {
      map.set(normalizeEmail(profile.user_email), profile);
    }
    return map;
  }, [profiles]);

  const callEvents = useMemo(() => (
    directMessages
      .filter((message) => message.message_type === CHAT_MESSAGE_TYPES.CALL_EVENT)
      .sort((left, right) => (
        new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
      ))
  ), [directMessages]);

  const callStats = useMemo(() => ({
    total: callEvents.length,
    audio: callEvents.filter((message) => message?.media_metadata?.callType === CHAT_CALL_TYPES.AUDIO).length,
    video: callEvents.filter((message) => message?.media_metadata?.callType === CHAT_CALL_TYPES.VIDEO).length,
    missed: callEvents.filter((message) => String(message?.media_metadata?.callStatus || '').toLowerCase() === 'missed').length,
  }), [callEvents]);

  const recentCallConversations = useMemo(() => {
    const seen = new Set();
    const items = [];

    for (const conversation of conversations) {
      if (!conversation?.id || seen.has(conversation.id)) continue;
      const hasCallEvent = callEvents.some((message) => message.conversation_id === conversation.id);
      if (!hasCallEvent) continue;
      items.push(conversation);
      seen.add(conversation.id);
      if (items.length >= 8) break;
    }

    return items;
  }, [callEvents, conversations]);

  useEffect(() => {
    if (selectedContact || recentCallConversations.length === 0) {
      return;
    }

    const initial = buildSelectedContact(recentCallConversations[0], currentUser.email, profilesByEmail);
    if (initial) {
      setSelectedContact(initial);
    }
  }, [currentUser.email, profilesByEmail, recentCallConversations, selectedContact]);

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/Dashboard"
        backLabel="Dashboard"
        title="Ligações"
        subtitle="Módulo dedicado para chamadas de voz e vídeo usando a infraestrutura de chat em tempo real."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-indigo-500/20 p-3 text-indigo-300"><PhoneCall className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Chamadas</p>
              <p className="text-2xl font-semibold">{callStats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-300"><Phone className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Voz</p>
              <p className="text-2xl font-semibold">{callStats.audio}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-sky-500/20 p-3 text-sky-300"><Video className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Vídeo</p>
              <p className="text-2xl font-semibold">{callStats.video}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-500/20 p-3 text-amber-300"><Clock3 className="h-5 w-5" /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">Perdidas</p>
              <p className="text-2xl font-semibold">{callStats.missed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)_22rem]">
        <ContactList
          currentUser={currentUser}
          currentProfileType={profileType}
          onSelectContact={setSelectedContact}
          onClose={() => {}}
          unreadCounts={{}}
          variant="embedded"
          className="min-h-[42rem]"
        />

        <div className="min-h-[42rem]">
          {selectedContact ? (
            <ChatWindow
              contact={selectedContact}
              currentUser={currentUser}
              onClose={() => setSelectedContact(null)}
              onMinimize={() => {}}
              variant="embedded"
              className="min-h-[42rem]"
            />
          ) : (
            <Card className="flex h-full min-h-[42rem] items-center justify-center border-white/10 bg-slate-950/70 text-white">
              <CardContent className="space-y-3 text-center">
                <div className="mx-auto w-fit rounded-2xl bg-indigo-500/15 p-4 text-indigo-300">
                  <MonitorSmartphone className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Selecione um contato ou conversa</p>
                  <p className="text-sm text-white/55">
                    Use o painel lateral para abrir uma conversa e iniciar ligação de voz ou vídeo.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border-white/10 bg-slate-950/70 text-white">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">Histórico recente</p>
                <h3 className="text-lg font-semibold">Últimas ligações</h3>
              </div>
              <Badge variant="outline" className="border-white/15 text-white/70">
                <Users className="mr-1 h-3 w-3" />
                {recentCallConversations.length} conversas
              </Badge>
            </div>

            <div className="space-y-3">
              {callEvents.slice(0, 10).map((message) => {
                const conversation = conversations.find((item) => item.id === message.conversation_id);
                const contact = conversation
                  ? buildSelectedContact(conversation, currentUser.email, profilesByEmail)
                  : null;
                const isVideo = message?.media_metadata?.callType === CHAT_CALL_TYPES.VIDEO;

                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => contact && setSelectedContact(contact)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {contact?.name || message.recipient_name || 'Conversa'}
                        </p>
                        <p className="mt-1 text-xs text-white/55">
                          {getCallDirection(message, currentUser.email)} • {getCallStatusLabel(message)}
                        </p>
                      </div>
                      <div className={`rounded-full p-2 ${isVideo ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {isVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-white/40">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </button>
                );
              })}

              {callEvents.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/45">
                  Nenhuma ligação registrada ainda.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
