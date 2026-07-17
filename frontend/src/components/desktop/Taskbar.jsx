import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  CheckCheck,
  Play,
  Pin,
  PinOff,
  Loader2,
  Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DesktopContextMenu } from '@/components/desktop/DesktopContextMenu';
import StartMenu from '@/components/desktop/StartMenu';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import {
  dismissNotificationById,
  listInboxNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationsClient';
import { getNotificationPresentation } from '@shared/contracts/notifications';
import { getWindowPreviewSnapshot, requestWindowPreviewCapture } from '@/components/desktop/Window';
import { useNow } from '@/hooks/useNow';

const TASKBAR_HEIGHT = 48;
const PREVIEW_WIDTH = 280;
const PREVIEW_HEIGHT = 168;
const PREVIEW_MARGIN = 12;
const HOVER_PREVIEW_DELAY_MS = 120;
const HOVER_PREVIEW_HIDE_DELAY_MS = 90;
const PREVIEW_REFRESH_INTERVAL_MS = 2_000;
const WINDOW_PREVIEW_UPDATED_EVENT = 'window-preview-updated';
const INBOX_NOTIFICATIONS_LIMIT = 30;
const INBOX_NOTIFICATIONS_REFETCH_MS = 60_000;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatNotificationTime = (iso) => {
  const date = new Date(iso);
  return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
};

function getPreviewPosition(anchorRect) {
  if (typeof window === 'undefined' || !anchorRect) {
    return { left: PREVIEW_MARGIN, bottom: TASKBAR_HEIGHT + 10 };
  }

  const left = clamp(
    anchorRect.left + anchorRect.width / 2 - PREVIEW_WIDTH / 2,
    PREVIEW_MARGIN,
    window.innerWidth - PREVIEW_WIDTH - PREVIEW_MARGIN
  );

  return {
    left,
    bottom: TASKBAR_HEIGHT + 10,
  };
}

function normalizeStoredPreview(windowId) {
  const snapshot = getWindowPreviewSnapshot(windowId);

  if (!snapshot?.src && !snapshot?.error) {
    return null;
  }

  return {
    src: snapshot.src ?? null,
    capturedAt: snapshot.capturedAt ?? Date.now(),
    error: snapshot.error ?? null,
  };
}

const LanguageSelector = memo(function LanguageSelector() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const languages = [
    { code: 'pt-BR', label: 'Português', flag: '🇧🇷' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
  ];

  const currentLanguage = languages.find((l) => l.code === i18n.language) || languages[0];

  const handleLanguageChange = useCallback((langCode) => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  }, [i18n]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs"
        title="Idioma"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{currentLanguage.flag}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full right-0 mb-2 w-40 bg-slate-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors",
                  i18n.language === lang.code
                    ? "bg-indigo-600 text-white"
                    : "text-white/80 hover:bg-white/10"
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

const TaskbarClock = memo(function TaskbarClock() {
  const { i18n } = useTranslation();
  const now = useNow();
  const currentTime = useMemo(
    () => now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }),
    [now, i18n.language]
  );

  return (
    <div className="text-white text-xs text-right px-2 flex-shrink-0">
      <div className="font-mono">{currentTime}</div>
    </div>
  );
});

let TaskbarWindowButton = function ({
  win,
  hideTaskPreview,
  onTaskClick,
  onOpenApp,
  onHoverStart,
  onHoverEnd,
  onUnpinTask,
}) {
  const [ctxMenu, setCtxMenu] = useState(null);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    hideTaskPreview();
    if (win.isOpen) {
      setCtxMenu(null);
      return;
    }
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, [hideTaskPreview, win.isOpen]);

  const ctxItems = win.isOpen ? [] : [
    {
      label: 'Abrir Aplicativo',
      icon: <Play className="w-4 h-4" />,
      onClick: () => onOpenApp(win.id),
    },
    { separator: true },
    {
      label: win.isPinned ? 'Desfixar da Barra' : 'Fixar na Barra',
      icon: win.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
      onClick: () => onUnpinTask?.(win.id),
      disabled: !onUnpinTask,
    },
  ];

  return (
    <>
      <button
        onClick={() => {
          hideTaskPreview();
          if (win.isOpen) {
            onTaskClick(win.id);
          } else {
            onOpenApp(win.id);
          }
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={(event) => onHoverStart(win, event.currentTarget)}
        onMouseLeave={onHoverEnd}
        className={`flex items-center gap-2 px-3 h-8 rounded-lg text-sm text-white truncate max-w-[160px] transition-all flex-shrink-0 ${
          win.focused && win.isOpen ? 'bg-white/20 border border-white/30' : 'hover:bg-white/10'
        } ${win.minimized || !win.isOpen ? 'opacity-60' : ''}`}
      >
        {win.icon && <win.icon className="w-4 h-4 flex-shrink-0" style={{ color: win.iconColor }} />}
        <span className="truncate">{win.title}</span>
      </button>
      {!win.isOpen && (
        <DesktopContextMenu
          menu={ctxMenu ? { ...ctxMenu, items: ctxItems } : null}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}

TaskbarWindowButton = memo(TaskbarWindowButton);

const TaskbarWindowButtons = memo(function TaskbarWindowButtons({
  openWindows,
  hideTaskPreview,
  onTaskClick,
  onOpenApp,
  onHoverStart,
  onHoverEnd,
  onUnpinTask,
}) {
  return (
    <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
      {openWindows.map((win) => (
        <TaskbarWindowButton
          key={win.id}
          win={win}
          hideTaskPreview={hideTaskPreview}
          onTaskClick={onTaskClick}
          onOpenApp={onOpenApp}
          onHoverStart={onHoverStart}
          onHoverEnd={onHoverEnd}
          onUnpinTask={onUnpinTask}
        />
      ))}
    </div>
  );
});

const TaskbarNotificationsPopover = memo(function TaskbarNotificationsPopover({
  notifOpen,
  unreadCount,
  bulkReading,
  busyNotificationId,
  notifications,
  loadingNotifications,
  onClose,
  onMarkAllRead,
  onOpenNotification,
  onMarkRead,
  onDismiss,
  reducedMotion = false,
}) {
  if (!notifOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
        transition={{ duration: reducedMotion ? 0 : 0.15 }}
        className="absolute bottom-12 right-0 w-80 border border-white/15 rounded-xl shadow-2xl z-[9999] overflow-hidden"
        style={{ background: 'rgb(15 23 42 / 0.98)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            <span className="text-white font-semibold text-sm">Notificações</span>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-60" disabled={bulkReading}>
              {bulkReading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Marcar lidas
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {loadingNotifications ? (
            <div className="py-10 text-center text-white/40 text-sm">
              <Loader2 className="w-8 h-8 mx-auto mb-2 opacity-60 animate-spin" />
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-white/40 text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma notificação
            </div>
          ) : notifications.map((notification) => {
            const presentation = getNotificationPresentation(notification.event_type);
            const isBusy = busyNotificationId === notification.id;

            return (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${!notification.read_at ? 'bg-indigo-500/10' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => void onOpenNotification(notification)}
                  className="text-lg flex-shrink-0 mt-0.5"
                  aria-label={`Abrir notificação ${notification.title}`}
                  data-tooltip={`Abrir notificação ${notification.title}`}
                >
                  {presentation.icon}
                </button>
                <button
                  type="button"
                  onClick={() => void onOpenNotification(notification)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className={`text-sm font-medium leading-tight ${notification.read_at ? 'text-white/60' : 'text-white'}`}>{notification.title}</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{notification.body}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-white/30">{formatNotificationTime(notification.created_at)}</p>
                    {notification.action_label && (
                      <span className="text-[10px] text-indigo-300">{notification.action_label}</span>
                    )}
                  </div>
                </button>
                <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                  {!notification.read_at && (
                    <button
                      type="button"
                      onClick={() => void onMarkRead(notification.id)}
                      className="text-white/30 hover:text-indigo-300 transition-colors disabled:opacity-60"
                      disabled={isBusy}
                      title="Marcar como lida"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onDismiss(notification.id)}
                    className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-60"
                    disabled={isBusy}
                    title="Dispensar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
});

const TaskbarPreviewOverlay = memo(function TaskbarPreviewOverlay({
  taskPreview,
  previewPosition,
  previewLoadingId,
  activePreviewEntry,
  reducedMotion,
  disableWindowPreviews,
}) {
  if (!taskPreview || !previewPosition) return null;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.14, ease: 'easeOut' }}
      className="fixed z-[10002] pointer-events-none"
      style={{
        left: `${previewPosition.left}px`,
        bottom: `${previewPosition.bottom}px`,
        width: `${PREVIEW_WIDTH}px`,
      }}
    >
      <div className="overflow-hidden rounded-[22px] border border-white/12 bg-slate-900/98 p-3 shadow-[0_24px_60px_rgba(2,6,23,0.55)]">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          {taskPreview.icon && (
            <taskPreview.icon className="h-4 w-4 flex-shrink-0" style={{ color: taskPreview.iconColor }} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{taskPreview.title}</p>
            <p className="text-[11px] text-slate-400">
              {disableWindowPreviews
                ? 'Pré-visualização desativada no modo leve'
                : previewLoadingId === taskPreview.windowId && !activePreviewEntry?.src
                  ? 'Gerando miniatura...'
                  : 'Pré-visualização da janela'}
            </p>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-[18px] border border-white/8 bg-slate-950/90"
          style={{ height: `${PREVIEW_HEIGHT}px` }}
        >
          {disableWindowPreviews ? (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,1))] px-5 text-center">
              <div className="space-y-2">
                {taskPreview.icon && (
                  <taskPreview.icon className="mx-auto h-6 w-6 text-slate-400" />
                )}
                <p className="text-sm font-medium text-slate-100">
                  O modo leve desativa miniaturas para reduzir custo visual.
                </p>
              </div>
            </div>
          ) : activePreviewEntry?.src ? (
            <img
              src={activePreviewEntry.src}
              alt={`Pré-visualização da janela ${taskPreview.title}`}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,1))] px-5 text-center">
              <div className="space-y-2">
                {previewLoadingId === taskPreview.windowId ? (
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                ) : (
                  taskPreview.icon && (
                    <taskPreview.icon className="mx-auto h-6 w-6 text-slate-400" />
                  )
                )}
                <p className="text-sm font-medium text-slate-100">
                  {activePreviewEntry?.error || 'Pré-visualização indisponível.'}
                </p>
              </div>
            </div>
          )}

          {previewLoadingId === taskPreview.windowId && activePreviewEntry?.src && (
            <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] text-slate-200">
              <Loader2 className="h-3 w-3 animate-spin" />
              Atualizando
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

function Taskbar({
  openWindows,
  onTaskClick,
  onStartClick,
  onStartClose,
  onUnpinTask,
  onOpenApp,
  onAddDesktopShortcut,
  onSearchClick: _onSearchClick,
  searchOpen: _searchOpen = false,
  startOpen,
  startButtonRef,
  startMenuApps = [],
  profileType,
  shellUser,
  disableWindowPreviews = false,
  reducedMotion = false,
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [busyNotificationId, setBusyNotificationId] = useState(null);
  const [bulkReading, setBulkReading] = useState(false);
  const [taskPreview, setTaskPreview] = useState(null);
  const [previewCache, setPreviewCache] = useState({});
  const [previewLoadingId, setPreviewLoadingId] = useState(null);
  const previewLoadingTimeoutRef = useRef(null);
  const hoverOpenTimerRef = useRef(null);
  const hoverHideTimerRef = useRef(null);
  const notificationQueryKey = useMemo(
    () => ['notifications', 'inbox', user?.email || null, INBOX_NOTIFICATIONS_LIMIT, false],
    [user?.email]
  );

  const { data: notifications = [], isLoading: loadingNotifications } = useQuery({
    queryKey: notificationQueryKey,
    enabled: Boolean(user?.email),
    queryFn: () => listInboxNotifications({ limit: INBOX_NOTIFICATIONS_LIMIT }),
    staleTime: INBOX_NOTIFICATIONS_REFETCH_MS,
    refetchInterval: INBOX_NOTIFICATIONS_REFETCH_MS,
    retry: false,
  });

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications]
  );
  const handleCloseNotifications = useCallback(() => setNotifOpen(false), []);

  const invalidateNotifications = useCallback(() => queryClient.invalidateQueries({
    queryKey: notificationQueryKey,
  }), [notificationQueryKey, queryClient]);

  const clearPreviewTimers = useCallback(() => {
    if (hoverOpenTimerRef.current) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }

    if (hoverHideTimerRef.current) {
      window.clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
  }, []);

  const hideTaskPreview = useCallback(() => {
    clearPreviewTimers();
    setTaskPreview(null);
  }, [clearPreviewTimers]);

  useEffect(() => () => {
    clearPreviewTimers();
    if (previewLoadingTimeoutRef.current) {
      window.clearTimeout(previewLoadingTimeoutRef.current);
    }
  }, [clearPreviewTimers]);

  useEffect(() => {
    if (!disableWindowPreviews) return;

    setPreviewLoadingId(null);
  }, [disableWindowPreviews]);

  useEffect(() => {
    if (startOpen || notifOpen) {
      hideTaskPreview();
    }
  }, [hideTaskPreview, notifOpen, startOpen]);

  useEffect(() => {
    if (!taskPreview) return undefined;

    const handleViewportChange = () => setTaskPreview(null);

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [taskPreview]);

  useEffect(() => {
    if (!taskPreview) return;

    const previewWindowStillOpen = openWindows.some(
      (windowItem) => windowItem.id === taskPreview.windowId && windowItem.isOpen
    );

    if (!previewWindowStillOpen) {
      setTaskPreview(null);
    }
  }, [openWindows, taskPreview]);

  const syncStoredWindowPreview = useCallback((windowId) => {
    const storedPreview = normalizeStoredPreview(windowId);
    if (!storedPreview) return false;

    setPreviewCache((current) => {
      const currentPreview = current[windowId];
      if (currentPreview?.capturedAt >= storedPreview.capturedAt && currentPreview?.src) {
        return current;
      }

      return {
        ...current,
        [windowId]: storedPreview,
      };
    });

    return true;
  }, []);

  useEffect(() => {
    const handleWindowPreviewUpdated = (event) => {
      const windowId = event?.detail?.windowId;
      if (!windowId) return;

      const updated = syncStoredWindowPreview(windowId);
      if (updated) {
        setPreviewLoadingId((current) => (current === windowId ? null : current));
      }
    };

    window.addEventListener(WINDOW_PREVIEW_UPDATED_EVENT, handleWindowPreviewUpdated);
    return () => window.removeEventListener(WINDOW_PREVIEW_UPDATED_EVENT, handleWindowPreviewUpdated);
  }, [syncStoredWindowPreview]);

  useEffect(() => {
    if (!previewLoadingId) return undefined;

    if (previewLoadingTimeoutRef.current) {
      window.clearTimeout(previewLoadingTimeoutRef.current);
    }

    previewLoadingTimeoutRef.current = window.setTimeout(() => {
      setPreviewLoadingId((current) => (current === previewLoadingId ? null : current));
      previewLoadingTimeoutRef.current = null;
    }, 1600);

    return () => {
      if (previewLoadingTimeoutRef.current) {
        window.clearTimeout(previewLoadingTimeoutRef.current);
        previewLoadingTimeoutRef.current = null;
      }
    };
  }, [previewLoadingId]);

  const ensureWindowPreview = useCallback((win) => {
    if (disableWindowPreviews) {
      setPreviewLoadingId((current) => (current === win.id ? null : current));
      setPreviewCache((current) => {
        const existing = current[win.id];
        if (existing?.error === 'Pré-visualização desativada no modo leve') {
          return current;
        }

        return {
          ...current,
          [win.id]: {
            src: null,
            capturedAt: Date.now(),
            error: 'Pré-visualização desativada no modo leve',
          },
        };
      });
      return;
    }

    const cachedPreview = previewCache[win.id];
    const hasStoredPreview = syncStoredWindowPreview(win.id);
    const latestPreview = normalizeStoredPreview(win.id) ?? cachedPreview;

    if (win.minimized && (hasStoredPreview || cachedPreview?.src)) {
      return;
    }

    if (win.minimized && !cachedPreview?.src) {
      setPreviewCache((current) => ({
        ...current,
        [win.id]: {
          src: null,
          capturedAt: Date.now(),
          error: 'Janela minimizada. Restaure-a para atualizar a miniatura.',
        },
      }));
      return;
    }

    if (
      latestPreview?.capturedAt &&
      Date.now() - latestPreview.capturedAt < PREVIEW_REFRESH_INTERVAL_MS
    ) {
      return;
    }

    const requestScheduled = requestWindowPreviewCapture(win.id, 120);

    if (!requestScheduled) {
      setPreviewLoadingId((current) => (current === win.id ? null : current));
      if (!hasStoredPreview && !cachedPreview?.src) {
        setPreviewCache((current) => ({
          ...current,
          [win.id]: {
            src: null,
            capturedAt: Date.now(),
            error: 'Miniatura ainda nao disponivel para esta janela.',
          },
        }));
      }
      return;
    }

    setPreviewLoadingId(win.id);
  }, [disableWindowPreviews, previewCache, syncStoredWindowPreview]);

  const handleTaskHoverStart = useCallback((win, buttonElement) => {
    if (!win?.isOpen || !buttonElement) return;

    clearPreviewTimers();

    const anchorRect = buttonElement.getBoundingClientRect();
    hoverOpenTimerRef.current = window.setTimeout(() => {
      syncStoredWindowPreview(win.id);
      setTaskPreview({
        windowId: win.id,
        title: win.title,
        icon: win.icon,
        iconColor: win.iconColor,
        anchorRect,
      });
      ensureWindowPreview(win);
    }, HOVER_PREVIEW_DELAY_MS);
  }, [clearPreviewTimers, ensureWindowPreview, syncStoredWindowPreview]);

  const handleTaskHoverEnd = useCallback(() => {
    if (hoverOpenTimerRef.current) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }

    hoverHideTimerRef.current = window.setTimeout(() => {
      setTaskPreview(null);
    }, HOVER_PREVIEW_HIDE_DELAY_MS);
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (bulkReading || unreadCount === 0) return;

    setBulkReading(true);
    try {
      await markAllNotificationsRead();
      await invalidateNotifications();
    } catch (error) {
      console.warn('[Taskbar] Falha ao marcar notificacoes como lidas.', error);
      toast.error(error?.message || 'Nao foi possivel marcar as notificacoes como lidas.');
    } finally {
      setBulkReading(false);
    }
  }, [bulkReading, invalidateNotifications, unreadCount]);

  const handleMarkRead = useCallback(async (notificationId) => {
    if (!notificationId || busyNotificationId === notificationId) return;

    setBusyNotificationId(notificationId);
    try {
      await markNotificationRead(notificationId);
      await invalidateNotifications();
    } catch (error) {
      console.warn('[Taskbar] Falha ao marcar notificacao como lida.', error);
      toast.error(error?.message || 'Nao foi possivel marcar a notificacao como lida.');
    } finally {
      setBusyNotificationId(null);
    }
  }, [busyNotificationId, invalidateNotifications]);

  const handleDismiss = useCallback(async (notificationId) => {
    if (!notificationId || busyNotificationId === notificationId) return;

    setBusyNotificationId(notificationId);
    try {
      await dismissNotificationById(notificationId);
      await invalidateNotifications();
    } catch (error) {
      console.warn('[Taskbar] Falha ao dispensar notificacao.', error);
      toast.error(error?.message || 'Nao foi possivel dispensar a notificacao.');
    } finally {
      setBusyNotificationId(null);
    }
  }, [busyNotificationId, invalidateNotifications]);

  const handleOpenNotification = useCallback(async (notification) => {
    if (!notification) return;

    if (!notification.read_at) {
      void handleMarkRead(notification.id);
    }

    if (notification.action_app) {
      onOpenApp?.(notification.action_app);
      setNotifOpen(false);
    }
  }, [handleMarkRead, onOpenApp]);

  const activePreviewEntry = taskPreview ? previewCache[taskPreview.windowId] : null;
  const previewPosition = useMemo(
    () => (taskPreview ? getPreviewPosition(taskPreview.anchorRect) : null),
    [taskPreview]
  );

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-slate-950 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2 gap-2 z-[9999] border-t border-white/10">
        <div />

        <div className="min-w-0 justify-self-center">
          <div className="flex items-center gap-1 max-w-full overflow-x-auto">
            <button
              ref={startButtonRef}
              onClick={() => {
                hideTaskPreview();
                onStartClick();
              }}
              data-cy="taskbar-start"
              aria-label="Abrir menu iniciar"
              className={`flex items-center gap-2 px-3 h-8 rounded-lg text-white text-sm font-medium transition-all flex-shrink-0 ${
                startOpen ? 'bg-indigo-600' : 'hover:bg-white/10'
              }`}
            >
              <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-[10px] font-bold">K</span>
              </div>
              <span className="hidden sm:block">KYRONIX</span>
            </button>





            {openWindows.length > 0 && <div className="w-px h-6 bg-white/20 mx-1 flex-shrink-0" />}

            <TaskbarWindowButtons
              openWindows={openWindows}
              hideTaskPreview={hideTaskPreview}
              onTaskClick={onTaskClick}
              onOpenApp={onOpenApp}
              onHoverStart={handleTaskHoverStart}
              onHoverEnd={handleTaskHoverEnd}
              onUnpinTask={onUnpinTask}
            />
          </div>
        </div>

        <div className="flex items-center justify-self-end min-w-0">
          <TaskbarClock />

          <div className="w-px h-6 bg-white/20 mx-1" />

          {/* Language Selector */}
          <div className="relative flex-shrink-0">
            <LanguageSelector />
          </div>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <div className="relative flex-shrink-0">
            <button
              onClick={() => {
                hideTaskPreview();
                setNotifOpen((open) => !open);
              }}
              data-cy="taskbar-notifications"
              aria-label="Abrir notificações"
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg text-white/70 hover:text-white transition-all ${notifOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}
              title="Notificações"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              <TaskbarNotificationsPopover
                notifOpen={notifOpen}
                unreadCount={unreadCount}
                bulkReading={bulkReading}
                busyNotificationId={busyNotificationId}
                notifications={notifications}
                loadingNotifications={loadingNotifications}
                onClose={handleCloseNotifications}
              onMarkAllRead={handleMarkAllRead}
              onOpenNotification={handleOpenNotification}
              onMarkRead={handleMarkRead}
              onDismiss={handleDismiss}
              reducedMotion={reducedMotion}
            />
            </AnimatePresence>
          </div>

          <div className="w-px h-6 bg-white/20 mx-1" />


        </div>
      </div>

      <AnimatePresence>
        {startOpen && (
          <div key="taskbar-start-menu-floating" className="fixed inset-0 pointer-events-none z-[10000]">
            <div className="pointer-events-auto h-full w-full relative">
              <StartMenu
                apps={startMenuApps}
                onOpenApp={onOpenApp}
                onAddDesktopShortcut={onAddDesktopShortcut}
                onClose={onStartClose}
                startButtonRef={startButtonRef}
                profileType={profileType}
                user={shellUser}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
      <TaskbarPreviewOverlay
        taskPreview={taskPreview}
        previewPosition={previewPosition}
        previewLoadingId={previewLoadingId}
        activePreviewEntry={activePreviewEntry}
        reducedMotion={reducedMotion}
        disableWindowPreviews={disableWindowPreviews}
      />
      </AnimatePresence>
    </>
  );
}

export default memo(Taskbar);
