import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { createRealtimeChannelName } from '@/lib/realtimeChannels';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, PhoneIncoming } from 'lucide-react';
import ChatWindow from './ChatWindow';
import ContactList from './ContactList';
import { usePermissions } from '@/components/hooks/usePermissions';
import { canUseDirectChat } from '@shared/contracts/access';
import { buildDirectConversationId, CHAT_CALL_STATUSES } from '@shared/contracts/chat';
import { useChatPresence } from '@/hooks/useChatPresence';

export default function ChatHub() {
  const { user: authUser } = useAuth();
  const { profileType } = usePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [showContacts, setShowContacts] = useState(false);
  const [openChats, setOpenChats] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimerRef = useRef(null);
  const tenantId = authUser?.app_metadata?.tenant_id || authUser?.user_metadata?.tenant_id || null;
  const {
    getPresenceForEmail,
    getConversationPresenceSummary,
    isPresenceReady,
  } = useChatPresence({
    currentUser,
    currentProfileType: profileType,
    tenantId,
    disabled: !authUser?.email,
  });

  const getChatKey = (chat) => chat.conversationId || chat.email;

  useEffect(() => {
    if (!authUser?.email) return;

    setCurrentUser({
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.email,
      id: authUser.id,
      tenantId,
    });

    // Subscribe to new direct messages via Supabase Realtime
    const channel = supabase
      .channel(createRealtimeChannelName('chat_hub_inbox'))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      }, (payload) => {
        const msg = payload.new;
        if (msg.sender_email !== authUser.email && !msg.read) {
          const unreadKey = msg.conversation_id || msg.sender_email;
          setUnreadCounts(prev => ({ ...prev, [unreadKey]: (prev[unreadKey] || 0) + 1 }));
          setToastMsg({ name: msg.sender_name, content: msg.content });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => {
            setToastMsg(null);
            toastTimerRef.current = null;
          }, 4000);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_call_sessions',
        filter: `recipient_email=eq.${authUser.email}`,
      }, (payload) => {
        const call = payload.new;
        if (!call?.id || call.status !== CHAT_CALL_STATUSES.RINGING) {
          return;
        }

        const senderEmail = call.initiator_email;
        setToastMsg({
          name: call.initiator_email,
          content: call.call_type === 'video' ? 'Videochamada recebida' : 'Chamada de voz recebida',
          isCall: true,
        });

        setOpenChats((prev) => {
          const directConversationId = buildDirectConversationId(authUser.email, senderEmail);
          const existing = prev.find((chat) => getChatKey(chat) === directConversationId || chat.email === senderEmail);
          if (existing) {
            return prev.map((chat) => (
              getChatKey(chat) === getChatKey(existing)
                ? { ...chat, minimized: false, incomingCall: call, conversationId: directConversationId }
                : chat
            ));
          }

          return [...prev, {
            email: senderEmail,
            name: call.initiator_email,
            role: 'contato',
            conversationId: directConversationId,
            minimized: false,
            incomingCall: call,
          }];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [authUser, tenantId]);

  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
    setTotalUnread(total);
  }, [unreadCounts]);

  const openChat = (contact) => {
    setOpenChats(prev => {
      const nextKey = getChatKey(contact);
      if (prev.find(c => getChatKey(c) === nextKey)) {
        return prev.map(c => getChatKey(c) === nextKey ? { ...c, ...contact, minimized: false } : c);
      }
      return [...prev, { ...contact, minimized: false }];
    });
    setUnreadCounts(prev => {
      const n = { ...prev };
      delete n[contact.email];
      if (contact.conversationId) {
        delete n[contact.conversationId];
      }
      return n;
    });
  };

  const closeChat = (chatKey) => setOpenChats(prev => prev.filter(c => getChatKey(c) !== chatKey));
  const minimizeChat = (chatKey) => setOpenChats(prev => prev.map(c => getChatKey(c) === chatKey ? { ...c, minimized: !c.minimized } : c));

  if (!currentUser || !canUseDirectChat(profileType)) return null;

  return (
    <>
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="fixed bottom-16 right-4 z-[11000] flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border border-white/10 max-w-xs"
            style={{ background: 'rgba(15,15,30,0.97)', backdropFilter: 'blur(16px)' }}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {toastMsg.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold">{toastMsg.name}</p>
              <p className="text-white/60 text-xs truncate mt-0.5">{toastMsg.content}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-14 right-16 z-[10500] flex items-end gap-2">
        <AnimatePresence>
          {openChats.map(chat => !chat.minimized && (
            <ChatWindow
              key={getChatKey(chat)}
              contact={chat}
              currentUser={currentUser}
              getPresenceForEmail={getPresenceForEmail}
              getConversationPresenceSummary={getConversationPresenceSummary}
              isPresenceReady={isPresenceReady}
              initialIncomingCall={chat.incomingCall || null}
              onClose={() => closeChat(getChatKey(chat))}
              onMinimize={() => minimizeChat(getChatKey(chat))}
            />
          ))}
        </AnimatePresence>

        {openChats.filter(c => c.minimized).map(chat => (
          <button key={getChatKey(chat)} onClick={() => minimizeChat(getChatKey(chat))}
            className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-lg transition-colors"
            title={chat.name}>
            {chat.name?.[0]?.toUpperCase()}
          </button>
        ))}

        <AnimatePresence>
          {showContacts && (
            <ContactList
              currentUser={currentUser}
              currentProfileType={profileType}
              getPresenceForEmail={getPresenceForEmail}
              getConversationPresenceSummary={getConversationPresenceSummary}
              isPresenceReady={isPresenceReady}
              onSelectContact={openChat}
              onClose={() => setShowContacts(false)}
              unreadCounts={unreadCounts}
            />
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowContacts(o => !o)}
          className="relative w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center shadow-lg transition-all flex-shrink-0"
        >
          {toastMsg?.isCall ? (
            <PhoneIncoming className="w-5 h-5 text-white" />
          ) : (
            <MessageSquare className="w-5 h-5 text-white" />
          )}
          {totalUnread > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">{totalUnread > 9 ? '9+' : totalUnread}</span>
            </div>
          )}
        </button>
      </div>
    </>
  );
}
