import React, { memo, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ChevronLeft, ChevronRight, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/AuthContext';
import { getNotificationPresentation } from '@shared/contracts/notifications';
import {
  dismissNotificationById,
  listInboxNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationsClient';

const INBOX_NOTIFICATIONS_LIMIT = 30;
const INBOX_NOTIFICATIONS_REFETCH_MS = 60_000;

function NotificationBar({ onOpenApp }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(0);
  const notificationQueryKey = ['notifications', 'inbox', user?.email || null, INBOX_NOTIFICATIONS_LIMIT, false];

  const invalidateNotifications = () => (
    queryClient.invalidateQueries({ queryKey: notificationQueryKey })
  );

  const { data: notifications = [] } = useQuery({
    queryKey: notificationQueryKey,
    queryFn: () => listInboxNotifications({ limit: INBOX_NOTIFICATIONS_LIMIT }),
    enabled: Boolean(user?.email),
    staleTime: INBOX_NOTIFICATIONS_REFETCH_MS,
    refetchInterval: INBOX_NOTIFICATIONS_REFETCH_MS,
    retry: false,
  });

  const dismissMutation = useMutation({
    mutationFn: dismissNotificationById,
    onSuccess: invalidateNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidateNotifications,
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidateNotifications,
  });

  const unreadNotifications = useMemo(
    () => notifications.filter(
      (notification) => !notification.dismissed_at && !notification.read_at
    ),
    [notifications]
  );

  useEffect(() => {
    if (current >= unreadNotifications.length) {
      setCurrent(0);
    }
  }, [current, unreadNotifications.length]);

  const handleDismiss = async (notificationId) => {
    try {
      await dismissMutation.mutateAsync(notificationId);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel dispensar a notificacao.');
    }
  };

  const handleOpenNotification = async (notification) => {
    if (!notification.read_at) {
      void markReadMutation.mutateAsync(notification.id).catch((error) => {
        toast.error(error?.message || 'Nao foi possivel marcar a notificacao como lida.');
      });
    }

    if (notification.action_app && typeof onOpenApp === 'function') {
      onOpenApp(notification.action_app);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync();
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel marcar as notificacoes como lidas.');
    }
  };

  if (unreadNotifications.length === 0) return null;

  const notification = unreadNotifications[current];
  const presentation = getNotificationPresentation(notification.event_type);
  const actionLabel = notification.action_label || presentation.actionLabel;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute top-0 left-0 right-0 z-[10000] flex items-center gap-2 px-3 h-10 border-b border-white/10"
        style={{ background: 'rgb(15 23 42 / 0.98)' }}
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Bell className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 text-xs font-semibold">{unreadNotifications.length}</span>
        </div>
        <div className="w-px h-5 bg-white/20 flex-shrink-0" />
        <span className="text-sm flex-shrink-0" aria-hidden="true">{presentation.icon}</span>
        <button
          type="button"
          onClick={() => void handleOpenNotification(notification)}
          className="text-left text-white text-xs flex-1 truncate hover:text-white/90 transition-colors"
        >
          {notification.title}
          <span className="text-white/45 ml-2">{notification.body}</span>
        </button>
        {actionLabel && notification.action_app && (
          <button
            type="button"
            onClick={() => void handleOpenNotification(notification)}
            className="text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors flex-shrink-0"
          >
            {actionLabel}
          </button>
        )}
        {unreadNotifications.length > 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setCurrent((value) => (value - 1 + unreadNotifications.length) % unreadNotifications.length)}
              className="text-white/50 hover:text-white transition-colors p-0.5"
              aria-label="Notificação anterior"
              data-tooltip="Notificação anterior"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-white/40 text-xs">{current + 1}/{unreadNotifications.length}</span>
            <button
              type="button"
              onClick={() => setCurrent((value) => (value + 1) % unreadNotifications.length)}
              className="text-white/50 hover:text-white transition-colors p-0.5"
              aria-label="Próxima notificação"
              data-tooltip="Próxima notificação"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
        {unreadNotifications.length > 1 && (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors flex-shrink-0"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todas
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleDismiss(notification.id)}
          className="text-white/40 hover:text-white transition-colors flex-shrink-0 p-0.5"
          aria-label="Dispensar notificação"
          data-tooltip="Dispensar notificação"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(NotificationBar);
