import React, { useEffect, useMemo, useState } from 'react';
import { StudentApi, UserProfileApi } from '@/services/supabaseApi';
import { createChatConversation, listChatConversations } from '@/lib/chatClient';
import { getChatMessagePreview } from '@shared/contracts/chat';
import { Search, Users, UserPlus2, X, MessageSquare, ChevronDown, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/lib/supabase';
import { createRealtimeChannelName } from '@/lib/realtimeChannels';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChatPresenceBadge } from '@/components/chat/ChatPresenceBadge';
import { CHAT_PRESENCE_LABELS, formatGroupPresenceSummary } from '@/hooks/useChatPresence';

const CONVERSATION_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'Todas' },
  { value: 'groups', label: 'Grupos' },
  { value: 'direct', label: 'Diretas' },
  { value: 'unread', label: 'Nao lidas' },
]);

const CONTACT_FILTER_OPTIONS = Object.freeze([
  { value: 'all', label: 'Todos' },
  { value: 'aluno', label: 'Aluno' },
  { value: 'professor', label: 'Professor' },
  { value: 'administracao', label: 'Administração' },
  { value: 'secretaria', label: 'Secretaria' },
  { value: 'coordenacao', label: 'Coordenação' },
  { value: 'turma', label: 'Turma' },
  { value: 'periodo', label: 'Período' },
]);

const PROFILE_LABELS = Object.freeze({
  administrador: 'Administração',
  coordenador: 'Coordenação',
  secretario: 'Secretaria',
  professor: 'Professor',
  aluno: 'Aluno',
  responsavel: 'Responsável',
  contato: 'Contato',
});

const SHIFT_LABELS = Object.freeze({
  matutino: 'Matutino',
  vespertino: 'Vespertino',
  noturno: 'Noturno',
  integral: 'Integral',
});

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildConversationTitle(conversation, currentUserEmail, profileByEmail) {
  if (!conversation) return 'Conversa';
  if (conversation.type === 'group') {
    return conversation.title || 'Grupo';
  }

  const otherParticipant = (conversation.participants || []).find(
    (participant) => normalizeEmail(participant.participant_email) !== normalizeEmail(currentUserEmail)
  );
  const profile = otherParticipant ? profileByEmail.get(normalizeEmail(otherParticipant.participant_email)) : null;
  return profile?.full_name || otherParticipant?.participant_email || 'Conversa direta';
}

function buildConversationRole(conversation, currentUserEmail, profileByEmail) {
  if (!conversation || conversation.type === 'group') {
    return 'Grupo';
  }

  const otherParticipant = (conversation.participants || []).find(
    (participant) => normalizeEmail(participant.participant_email) !== normalizeEmail(currentUserEmail)
  );
  const profile = otherParticipant ? profileByEmail.get(normalizeEmail(otherParticipant.participant_email)) : null;
  return PROFILE_LABELS[profile?.profile_type] || 'Conversa direta';
}

function buildConversationAvatarUrl(conversation, currentUserEmail, profileByEmail) {
  if (!conversation || conversation.type === 'group') {
    return null;
  }

  const otherParticipant = (conversation.participants || []).find(
    (participant) => normalizeEmail(participant.participant_email) !== normalizeEmail(currentUserEmail)
  );
  const profile = otherParticipant ? profileByEmail.get(normalizeEmail(otherParticipant.participant_email)) : null;
  return profile?.avatar_url || null;
}

function buildConversationPreview(conversation) {
  return getChatMessagePreview(conversation?.last_message) || 'Sem mensagens ainda';
}

function getDirectConversationPeerEmail(conversation, currentUserEmail) {
  if (!conversation || conversation.type === 'group') {
    return '';
  }

  const otherParticipant = (conversation.participants || []).find(
    (participant) => normalizeEmail(participant.participant_email) !== normalizeEmail(currentUserEmail)
  );

  return normalizeEmail(otherParticipant?.participant_email);
}

function findDirectConversationByContactEmail(conversations, currentUserEmail, contactEmail) {
  const normalizedContactEmail = normalizeEmail(contactEmail);
  if (!normalizedContactEmail) return null;

  return (Array.isArray(conversations) ? conversations : []).find((conversation) => (
    conversation?.type !== 'group'
    && getDirectConversationPeerEmail(conversation, currentUserEmail) === normalizedContactEmail
  )) || null;
}

export default function ContactList({
  currentUser,
  currentProfileType,
  getPresenceForEmail,
  getConversationPresenceSummary,
  isPresenceReady = false,
  onSelectContact,
  onClose,
  unreadCounts,
  variant = 'floating',
  className = '',
}) {
  const isEmbedded = variant === 'embedded';
  const [profiles, setProfiles] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');
  const [currentStudent, setCurrentStudent] = useState(null);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [openingContactEmails, setOpeningContactEmails] = useState([]);
  const canUseStudentScopedFilters = currentProfileType === 'aluno';

  useEffect(() => {
    UserProfileApi.filter({ status: 'ativo' }, 'full_name', 500).then(setProfiles);
  }, []);

  useEffect(() => {
    listChatConversations()
      .then((payload) => setConversations(payload?.conversations || []))
      .catch(() => setConversations([]));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(createRealtimeChannelName('chat-conversation-list'))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      }, ({ new: message }) => {
        if (!message?.conversation_id) return;
        setConversations((prev) => {
          const existing = prev.find((conversation) => conversation.id === message.conversation_id);
          if (!existing) return prev;
          const updatedConversation = {
            ...existing,
            last_message: message,
            updated_at: message.created_at,
          };
          return [updatedConversation, ...prev.filter((conversation) => conversation.id !== updatedConversation.id)];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.email) return;

    StudentApi.filter({ email: currentUser.email }, 'created_at', 20)
      .then((records) => setCurrentStudent(records[0] || null))
      .catch(() => setCurrentStudent(null));
  }, [currentUser?.email]);

  const profileByEmail = useMemo(() => {
    const map = new Map();
    for (const profile of profiles) {
      map.set(normalizeEmail(profile.user_email), profile);
    }
    return map;
  }, [profiles]);

  const studentByEmail = useMemo(() => {
    const map = new Map();
    for (const student of profiles.filter((profile) => profile.profile_type === 'aluno')) {
      map.set(normalizeEmail(student.user_email), student);
    }
    return map;
  }, [profiles]);

  const contacts = useMemo(() => {
    return profiles
      .filter((profile) => profile.user_email !== currentUser.email)
      .map((profile) => {
        const studentRecord = studentByEmail.get(normalizeEmail(profile.user_email)) || null;
        return {
          email: profile.user_email,
          name: profile.full_name,
          role: profile.profile_type,
          avatarUrl: profile.avatar_url || null,
          classId: studentRecord?.current_class_id || null,
          shift: studentRecord?.shift || null,
        };
      });
  }, [currentUser.email, profiles, studentByEmail]);

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return contacts.filter((contact) => {
      if (normalizedSearch && !String(contact.name || '').toLowerCase().includes(normalizedSearch)) {
        return false;
      }

      switch (contactFilter) {
        case 'aluno':
          return contact.role === 'aluno';
        case 'professor':
          return contact.role === 'professor';
        case 'administracao':
          return contact.role === 'administrador';
        case 'secretaria':
          return contact.role === 'secretario';
        case 'coordenacao':
          return contact.role === 'coordenador';
        case 'turma':
          if (canUseStudentScopedFilters && currentStudent?.current_class_id) {
            return contact.role === 'aluno' && contact.classId === currentStudent.current_class_id;
          }
          return contact.role === 'aluno';
        case 'periodo':
          if (canUseStudentScopedFilters && currentStudent?.shift) {
            return contact.role === 'aluno' && contact.shift === currentStudent.shift;
          }
          return contact.role === 'aluno';
        default:
          return true;
      }
    });
  }, [canUseStudentScopedFilters, contactFilter, contacts, currentStudent?.current_class_id, currentStudent?.shift, search]);

  const visibleConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...conversations]
      .filter((conversation) => {
        const title = buildConversationTitle(conversation, currentUser.email, profileByEmail);
        const preview = buildConversationPreview(conversation).toLowerCase();
        const isGroup = conversation.type === 'group';
        const hasUnread = (unreadCounts[conversation.id] || 0) > 0;

        if (
          normalizedSearch
          && !title.toLowerCase().includes(normalizedSearch)
          && !preview.includes(normalizedSearch)
        ) {
          return false;
        }

        switch (conversationFilter) {
          case 'groups':
            return isGroup;
          case 'direct':
            return !isGroup;
          case 'unread':
            return hasUnread;
          default:
            return true;
        }
      })
      .sort((left, right) => new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime());
  }, [conversationFilter, conversations, currentUser.email, profileByEmail, search, unreadCounts]);

  const conversationFilterCounts = useMemo(() => ({
    all: conversations.length,
    groups: conversations.filter((conversation) => conversation.type === 'group').length,
    direct: conversations.filter((conversation) => conversation.type !== 'group').length,
    unread: conversations.filter((conversation) => (unreadCounts[conversation.id] || 0) > 0).length,
  }), [conversations, unreadCounts]);

  const contactFilterCounts = useMemo(() => ({
    all: contacts.length,
    aluno: contacts.filter((contact) => contact.role === 'aluno').length,
    professor: contacts.filter((contact) => contact.role === 'professor').length,
    administracao: contacts.filter((contact) => contact.role === 'administrador').length,
    secretaria: contacts.filter((contact) => contact.role === 'secretario').length,
    coordenacao: contacts.filter((contact) => contact.role === 'coordenador').length,
    turma: canUseStudentScopedFilters && currentStudent?.current_class_id
      ? contacts.filter((contact) => contact.role === 'aluno' && contact.classId === currentStudent.current_class_id).length
      : contacts.filter((contact) => contact.role === 'aluno').length,
    periodo: canUseStudentScopedFilters && currentStudent?.shift
      ? contacts.filter((contact) => contact.role === 'aluno' && contact.shift === currentStudent.shift).length
      : contacts.filter((contact) => contact.role === 'aluno').length,
  }), [canUseStudentScopedFilters, contacts, currentStudent?.current_class_id, currentStudent?.shift]);

  const roleColor = {
    administrador: 'bg-red-500',
    coordenador: 'bg-orange-500',
    professor: 'bg-indigo-500',
    secretario: 'bg-yellow-500',
    aluno: 'bg-green-500',
    contato: 'bg-slate-500',
    group: 'bg-fuchsia-500',
  };

  const openConversation = async (contact) => {
    const normalizedContactEmail = normalizeEmail(contact.email);
    if (!normalizedContactEmail) {
      return;
    }

    if (openingContactEmails.includes(normalizedContactEmail)) {
      return;
    }

    const existingConversation = findDirectConversationByContactEmail(
      conversations,
      currentUser.email,
      normalizedContactEmail
    );

    if (existingConversation?.id) {
      setConversations((prev) => [
        existingConversation,
        ...prev.filter((item) => item.id !== existingConversation.id),
      ]);
      onSelectContact({
        ...contact,
        conversationId: existingConversation.id,
        conversation: existingConversation,
      });
      return;
    }

    setOpeningContactEmails((prev) => [...prev, normalizedContactEmail]);

    try {
      const payload = await createChatConversation({
        type: 'direct',
        participantEmails: [contact.email],
      });

      const conversation = payload?.conversation;
      const resolvedContact = {
        ...contact,
        conversationId: conversation?.id,
        conversation,
      };

      setConversations((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== conversation?.id);
        return conversation?.id ? [conversation, ...withoutCurrent] : prev;
      });

      onSelectContact(resolvedContact);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel abrir a conversa.');
    } finally {
      setOpeningContactEmails((prev) => prev.filter((email) => email !== normalizedContactEmail));
    }
  };

  const toggleGroupMember = (email) => {
    setSelectedEmails((prev) => (
      prev.includes(email)
        ? prev.filter((item) => item !== email)
        : [...prev, email]
    ));
  };

  const createGroupConversation = async () => {
    if (selectedEmails.length === 0) {
      toast.error('Selecione ao menos um participante para o grupo.');
      return;
    }

    setCreatingGroup(true);
    try {
      const payload = await createChatConversation({
        type: 'group',
        title: groupTitle.trim() || 'Novo grupo',
        participantEmails: selectedEmails,
      });

      const conversation = payload?.conversation;
      if (conversation?.id) {
        setConversations((prev) => [conversation, ...prev.filter((item) => item.id !== conversation.id)]);
      }

      setGroupTitle('');
      setSelectedEmails([]);
      setShowGroupCreator(false);
      setContactDrawerOpen(false);
      onSelectContact({
        email: conversation?.id,
        name: buildConversationTitle(conversation, currentUser.email, profileByEmail),
        role: 'group',
        conversationId: conversation?.id,
        conversation,
      });
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel criar o grupo.');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className={cn(
        'flex flex-col rounded-xl overflow-hidden shadow-2xl border border-white/10',
        isEmbedded ? 'h-full w-full' : 'w-80 h-[32rem]',
        className
      )}
      style={{ background: 'rgba(15,15,30,0.97)', backdropFilter: 'blur(16px)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0"
        style={{ background: 'rgba(99,102,241,0.2)' }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span className="text-white text-xs font-semibold">Conversas</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowGroupCreator((open) => !open)}
            className="text-white/60 hover:text-white p-1"
            aria-label="Criar grupo"
          >
            <UserPlus2 className="w-3.5 h-3.5" />
          </button>
          {!isEmbedded && (
            <button onClick={onClose} className="text-white/40 hover:text-white" aria-label="Fechar lista de contatos">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-white/10 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1">
          <Search className="w-3 h-3 text-white/40" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conversa ou contato..."
            className="bg-transparent text-white text-xs outline-none flex-1 placeholder-white/30"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-white/45">
            <Filter className="h-3 w-3" />
            <span>Filtros das conversas</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CONVERSATION_FILTER_OPTIONS.map((option) => {
              const isActive = conversationFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setConversationFilter(option.value)}
                  className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    isActive
                      ? 'border-indigo-400/70 bg-indigo-500/25 text-white'
                      : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {option.label} ({conversationFilterCounts[option.value] || 0})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showGroupCreator && (
        <div className="border-b border-white/10 px-3 py-3 space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Novo grupo</p>
            <input
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
              placeholder="Nome do grupo"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs text-white outline-none placeholder-white/30"
            />
          </div>
          <div className="max-h-28 overflow-y-auto space-y-1">
            {filteredContacts.map((contact) => (
              <label key={contact.email} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-white/85 hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={selectedEmails.includes(contact.email)}
                  onChange={() => toggleGroupMember(contact.email)}
                  className="h-3.5 w-3.5 accent-indigo-500"
                />
                <span className="truncate">{contact.name}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={createGroupConversation}
            disabled={creatingGroup}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {creatingGroup ? 'Criando grupo...' : 'Criar grupo'}
          </button>
        </div>
      )}

      <div className="border-b border-white/10 py-1">
        <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Conversas</p>
        <div className="max-h-40 overflow-y-auto">
          {visibleConversations.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-white/30">Nenhuma conversa encontrada.</p>
          )}
          {visibleConversations.map((conversation) => {
            const title = buildConversationTitle(conversation, currentUser.email, profileByEmail);
            const roleLabel = buildConversationRole(conversation, currentUser.email, profileByEmail);
            const avatarUrl = buildConversationAvatarUrl(conversation, currentUser.email, profileByEmail);
            const unread = unreadCounts[conversation.id] || 0;
            const isGroup = conversation.type === 'group';
            const directPeerEmail = getDirectConversationPeerEmail(conversation, currentUser.email);
            const presence = getPresenceForEmail?.(directPeerEmail);
            const groupPresenceSummary = isGroup
              ? getConversationPresenceSummary?.(
                  (conversation.participants || []).map((participant) => participant.participant_email),
                  currentUser.email
                )
              : null;
            const groupPresenceLabel = groupPresenceSummary
              ? formatGroupPresenceSummary(groupPresenceSummary)
              : 'Sem presenca';

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectContact({
                  email: isGroup
                    ? conversation.id
                    : directPeerEmail,
                  name: title,
                  role: isGroup ? 'group' : roleLabel.toLowerCase(),
                  avatarUrl,
                  conversationId: conversation.id,
                  conversation,
                })}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="w-8 h-8">
                    {!isGroup && <AvatarImage src={avatarUrl || undefined} alt={title || 'Conversa'} />}
                    <AvatarFallback className={`${isGroup ? roleColor.group : 'bg-indigo-500'} text-white text-xs font-bold`}>
                      {isGroup ? <Users className="w-3.5 h-3.5" /> : title?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isGroup && isPresenceReady && (
                    <ChatPresenceBadge
                      state={presence?.state}
                      className="absolute bottom-0 right-0 h-2.5 w-2.5"
                    />
                  )}
                  {unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-[9px] text-white font-bold">{unread > 9 ? '9+' : unread}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{title}</p>
                  <p className="text-white/40 text-[10px] truncate">{buildConversationPreview(conversation)}</p>
                  <p className="text-white/30 text-[9px] truncate">
                    {isGroup ? `${roleLabel} • ${groupPresenceLabel}` : roleLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Collapsible open={contactDrawerOpen} onOpenChange={setContactDrawerOpen} className="border-t border-white/10">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/5"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Iniciar nova conversa</p>
              <p className="mt-1 text-[11px] text-white/55">
                {filteredContacts.length} contato{filteredContacts.length === 1 ? '' : 's'} visível{filteredContacts.length === 1 ? '' : 'eis'}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-white/55 transition-transform ${contactDrawerOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex-1 overflow-hidden border-t border-white/10">
          <div className="space-y-2 px-3 py-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {CONTACT_FILTER_OPTIONS.map((option) => {
                const isActive = contactFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setContactFilter(option.value)}
                    className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      isActive
                        ? 'border-emerald-400/70 bg-emerald-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {option.label} ({contactFilterCounts[option.value] || 0})
                  </button>
                );
              })}
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredContacts.length === 0 && (
              <p className="mt-4 px-3 text-center text-xs text-white/30">Nenhum contato encontrado</p>
            )}
            {filteredContacts.map((contact) => {
              const unread = unreadCounts[contact.email] || 0;
              const isOpeningConversation = openingContactEmails.includes(normalizeEmail(contact.email));
              const presence = getPresenceForEmail?.(contact.email);
              return (
                <button
                  key={contact.email}
                  onClick={() => openConversation(contact)}
                  disabled={isOpeningConversation}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 transition-colors text-left disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={contact.avatarUrl || undefined} alt={contact.name || 'Contato'} />
                      <AvatarFallback className={`${roleColor[contact.role] || 'bg-slate-500'} text-white text-xs font-bold`}>
                        {contact.name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isPresenceReady && (
                      <ChatPresenceBadge
                        state={presence?.state}
                        className="absolute bottom-0 right-0 h-2.5 w-2.5"
                      />
                    )}
                    {unread > 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-[9px] text-white font-bold">{unread > 9 ? '9+' : unread}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{contact.name}</p>
                    <p className="text-white/40 text-[10px] capitalize">
                      {PROFILE_LABELS[contact.role] || contact.role}
                      {contact.role === 'aluno' && contact.classId ? ' • Turma' : ''}
                      {contact.role === 'aluno' && contact.shift ? ` • ${SHIFT_LABELS[contact.shift] || contact.shift}` : ''}
                    </p>
                    {isPresenceReady && (
                      <p className="text-white/30 text-[9px]">
                        {CHAT_PRESENCE_LABELS[presence?.state] || CHAT_PRESENCE_LABELS.offline}
                      </p>
                    )}
                    {isOpeningConversation && (
                      <p className="text-[10px] text-indigo-300">Abrindo conversa...</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </motion.div>
  );
}
