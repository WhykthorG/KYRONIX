import React, { Suspense, startTransition, useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Bell,
  ChevronUp,
  Grid3X3,
  Home,
  Layers3,
  LockKeyhole,
  LogOut,
  MoonStar,
  Palette,
  Search,
  Settings2,
  Sparkles,
  SunMedium,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

import ProjectBackgroundVideo from '@/components/common/ProjectBackgroundVideo';
import MobileModuleView from '@/components/mobile-shell/MobileModuleView';
import { Switch } from '@/components/ui/switch';
import appRegistry from '@/lib/appRegistry';
import {
  MOBILE_SHELL_ACCENTS,
  MOBILE_SHELL_QUICK_SETTINGS,
  MOBILE_SHELL_WIDGETS,
  getAccentToken,
} from '@/lib/mocks/mobileShell';
import {
  getShellBackgroundAssets,
  getShellBackgroundOption,
} from '@/lib/shellBackground';
import { useMobileShellStore } from '@/lib/stores/mobileShellStore';
import { useUserShellBackgroundPreference } from '@/lib/userShellBackground';
import { cn } from '@/lib/utils';
import { useMobileShellEnvironment } from '@/hooks/useMobileShellEnvironment';
import { useMobileShellNotifications } from '@/hooks/useMobileShellNotifications';

const QUICK_SETTING_ICON_MAP = {
  sync: Sparkles,
  alerts: Bell,
  focus: Layers3,
  lowData: WifiOff,
  wifi: Wifi,
  reducedMotion: Settings2,
};

const WIDGET_TARGETS = {
  pulse: 'dashboard',
  communications: 'messages',
  agenda: 'schoolcalendar',
};

function formatClock(date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function FloatingLayer({ children, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="absolute inset-0 z-40 bg-slate-950/62 backdrop-blur-sm"
      onClick={onClose}
    >
      {children}
    </motion.div>
  );
}

function BottomPanel({
  open,
  onClose,
  title,
  description,
  children,
  reducedMotion,
  headerActions = null,
}) {
  return (
    <AnimatePresence>
      {open ? (
        <FloatingLayer onClose={onClose}>
          <motion.section
            initial={{ y: '100%', opacity: reducedMotion ? 1 : 0.7 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: reducedMotion ? 1 : 0.7 }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 30 }}
            className="absolute inset-x-0 bottom-0 max-h-[82%] rounded-t-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))] px-4 pb-6 pt-3 text-white shadow-[0_-24px_80px_rgba(2,6,23,0.55)]"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto h-1.5 w-16 rounded-full bg-white/20" />
            <div className="mt-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Mobile Shell
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
                {description ? (
                  <p className="mt-2 text-sm leading-6 text-white/68">{description}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {headerActions}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/8 text-white/80 transition-colors hover:bg-white/12"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-5 max-h-[64vh] overflow-y-auto pr-1">{children}</div>
          </motion.section>
        </FloatingLayer>
      ) : null}
    </AnimatePresence>
  );
}

function QuickSettingCard({ title, description, active, icon: Icon, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'rounded-[26px] border p-4 text-left transition-all',
        active
          ? 'border-white/30 bg-gradient-to-br from-white/10 to-white/5 shadow-[var(--mobile-accent-glow)]'
          : 'border-white/10 bg-white/6 text-white/78 hover:bg-white/10'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn(
          'flex h-11 w-11 items-center justify-center rounded-[18px] border',
          active ? 'border-white/18 bg-white/15' : 'border-white/10 bg-white/8'
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
            active
              ? 'border-emerald-300/15 bg-emerald-400/15 text-emerald-100'
              : 'border-white/10 bg-white/8 text-white/60'
          )}
        >
          {active ? 'ativo' : 'inativo'}
        </span>
      </div>

      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/64">{description}</p>
    </button>
  );
}

function WidgetButton({ widget, module, onOpen }) {
  const Icon = module?.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-4 text-left shadow-[0_24px_80px_rgba(2,6,23,0.24)] backdrop-blur-2xl transition-transform active:scale-[0.985]"
    >
      <div className="absolute -right-10 top-0 h-24 w-24 rounded-full bg-[var(--mobile-accent-soft)]/18 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
            {widget.eyebrow}
          </p>
          <h3 className="mt-2 text-sm font-semibold text-white">{widget.title}</h3>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/10 text-white/90">
          {Icon ? <Icon className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-3xl font-semibold text-white">{widget.value}</p>
        <p className="mt-2 text-sm leading-6 text-white/64">{widget.detail}</p>
      </div>
    </button>
  );
}

function ShellAppIcon({ module, badge, active, onClick }) {
  const Icon = module.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 rounded-[26px] border border-white/10 bg-white/6 px-2 py-3 text-center transition-all hover:bg-white/10 active:scale-[0.97]"
    >
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-[22px] border shadow-[0_18px_40px_rgba(2,6,23,0.2)]',
          active ? 'border-white/20 ring-2 ring-white/12' : 'border-white/8'
        )}
        style={{ backgroundColor: module.bgColor }}
      >
        {Icon ? <Icon className="h-6 w-6" style={{ color: module.iconColor }} /> : null}
      </div>
      <span className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-4 text-white/82">
        {module.title}
      </span>
      {badge > 0 ? (
        <span className="absolute right-2 top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function NotificationGroup({ groupName, items, modulesById, onOpenNotification, onDismissNotification, onMarkGroupRead }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Agrupamento
          </p>
          <h3 className="mt-2 text-sm font-semibold text-white">{groupName}</h3>
        </div>
        <button
          type="button"
          onClick={() => onMarkGroupRead(groupName)}
          className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70"
        >
          Marcar lidas
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const module = modulesById[item.moduleId];
          const Icon = module?.icon;

          return (
            <div
              key={item.id}
              className={cn(
                'rounded-[22px] border p-4',
                item.read ? 'border-white/10 bg-white/6' : 'border-sky-300/18 bg-sky-500/10'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/10">
                  {Icon ? <Icon className="h-5 w-5 text-white/80" /> : <Bell className="h-5 w-5 text-white/80" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/68">{item.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDismissNotification(item.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-[14px] border border-white/10 bg-white/6 text-white/60"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                      {item.time}
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenNotification(item)}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white"
                    >
                      Abrir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentsCard({ module, isActive, depth, onOpen, onClose }) {
  const Icon = module.icon;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: depth * -8, scale: 1 - depth * 0.03 }}
      exit={{ opacity: 0, y: 24, scale: 0.94 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] p-4 shadow-[0_28px_90px_rgba(2,6,23,0.34)] backdrop-blur-2xl"
    >
      <div className="absolute inset-x-8 top-4 h-16 rounded-full bg-[var(--mobile-accent-soft)]/14 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <div
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[24px] border border-white/12"
            style={{ backgroundColor: module.bgColor }}
          >
            {Icon ? <Icon className="h-7 w-7" style={{ color: module.iconColor }} /> : null}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {isActive ? 'Ativo agora' : 'Pronto para retomada'}
            </p>
            <h3 className="mt-2 truncate text-lg font-semibold text-white">{module.title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/64">{module.description}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/8 text-white/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  );
}

export default function MobileShellRoot({
  moduleCatalog = [],
  viewer = null,
  onLogout = null,
  className,
  fullscreen = true,
  requestedAppLaunch = null,
  onRequestedAppHandled = null,
  profileKey = null,
}) {
  const reducedMotionPreference = useReducedMotion();
  const { now, systemDarkMode, browserOnline } = useMobileShellEnvironment();

  const modules = useMobileShellStore((state) => state.modules);
  const stack = useMobileShellStore((state) => state.stack);
  const activeModuleId = useMobileShellStore((state) => state.activeModuleId);
  const homeIds = useMobileShellStore((state) => state.homeIds);
  const dockIds = useMobileShellStore((state) => state.dockIds);
  const searchQuery = useMobileShellStore((state) => state.searchQuery);
  const drawerOpen = useMobileShellStore((state) => state.drawerOpen);
  const notificationsOpen = useMobileShellStore((state) => state.notificationsOpen);
  const quickSettingsOpen = useMobileShellStore((state) => state.quickSettingsOpen);
  const recentsOpen = useMobileShellStore((state) => state.recentsOpen);
  const locked = useMobileShellStore((state) => state.locked);
  const themeMode = useMobileShellStore((state) => state.themeMode);
  const accentId = useMobileShellStore((state) => state.accentId);
  const quickSettings = useMobileShellStore((state) => state.quickSettings);
  const notifications = useMobileShellStore((state) => state.notifications);
  const moduleViewStates = useMobileShellStore((state) => state.moduleViewStates);

  const registerModules = useMobileShellStore((state) => state.registerModules);
  const unlockShell = useMobileShellStore((state) => state.unlockShell);
  const lockShell = useMobileShellStore((state) => state.lockShell);
  const openModule = useMobileShellStore((state) => state.openModule);
  const closeModule = useMobileShellStore((state) => state.closeModule);
  const goHome = useMobileShellStore((state) => state.goHome);
  const toggleDrawer = useMobileShellStore((state) => state.toggleDrawer);
  const toggleNotifications = useMobileShellStore((state) => state.toggleNotifications);
  const toggleQuickSettings = useMobileShellStore((state) => state.toggleQuickSettings);
  const toggleRecents = useMobileShellStore((state) => state.toggleRecents);
  const closeOverlays = useMobileShellStore((state) => state.closeOverlays);
  const setSearchQuery = useMobileShellStore((state) => state.setSearchQuery);
  const toggleDockModule = useMobileShellStore((state) => state.toggleDockModule);
  const setAccent = useMobileShellStore((state) => state.setAccent);
  const setThemeMode = useMobileShellStore((state) => state.setThemeMode);
  const toggleQuickSetting = useMobileShellStore((state) => state.toggleQuickSetting);
  const setModuleViewState = useMobileShellStore((state) => state.setModuleViewState);
  const cycleModuleViewState = useMobileShellStore((state) => state.cycleModuleViewState);
  const markNotificationRead = useMobileShellStore((state) => state.markNotificationRead);
  const dismissNotification = useMobileShellStore((state) => state.dismissNotification);
  const markGroupRead = useMobileShellStore((state) => state.markGroupRead);
  const restoreNotifications = useMobileShellStore((state) => state.restoreNotifications);

  useEffect(() => {
    registerModules(moduleCatalog);
  }, [moduleCatalog, registerModules]);

  useEffect(() => {
    const requestedAppId = requestedAppLaunch?.appId;
    if (!requestedAppId) return;
    if (!modules.some((module) => module.id === requestedAppId)) return;

    openModule(requestedAppId, requestedAppLaunch?.appProps);
    onRequestedAppHandled?.();
  }, [modules, onRequestedAppHandled, openModule, requestedAppLaunch]);

  const deferredQuery = useDeferredValue(searchQuery);
  const isFocusMode = Boolean(quickSettings.focus);
  const isLowDataMode = Boolean(quickSettings.lowData);
  const reducedMotion = reducedMotionPreference || quickSettings.reducedMotion || isLowDataMode;
  const accent = getAccentToken(accentId);
  const resolvedTheme = themeMode === 'system'
    ? (systemDarkMode ? 'dark' : 'light')
    : themeMode;
  const isOffline = !quickSettings.wifi || !browserOnline;
  const activeModule = modules.find((module) => module.id === activeModuleId) || null;
  const modulesById = useMemo(
    () => Object.fromEntries(modules.map((module) => [module.id, module])),
    [modules]
  );
  const homeModules = homeIds.map((moduleId) => modulesById[moduleId]).filter(Boolean);
  const dockModules = dockIds.map((moduleId) => modulesById[moduleId]).filter(Boolean);
  const recents = [...stack]
    .reverse()
    .map((entry) => modulesById[entry.moduleId])
    .filter(Boolean);
  const activeStackEntry = useMemo(
    () => [...stack].reverse().find((entry) => entry.moduleId === activeModuleId) || null,
    [activeModuleId, stack]
  );
  const ActivePageComponent = activeModule ? appRegistry[activeModule.page] : null;
  const {
    visibleNotifications,
    effectiveUnreadCount,
    groupedNotifications,
    unreadBadgesByModuleId,
  } = useMobileShellNotifications({
    notifications,
    isFocusMode,
  });
  const filteredDrawerModules = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return modules;

    return modules.filter((module) => (
      module.title.toLowerCase().includes(normalizedQuery)
      || module.description.toLowerCase().includes(normalizedQuery)
      || module.eyebrow.toLowerCase().includes(normalizedQuery)
      || module.page.toLowerCase().includes(normalizedQuery)
    ));
  }, [deferredQuery, modules]);
  const shellViewer = viewer || {
    name: 'Project WG',
    role: 'Demo mobile',
    campus: 'Modo visual',
    avatarFallback: 'WG',
  };
  const {
    backgroundMode,
    backgroundAssetId,
    setBackgroundMode,
    setBackgroundSelection,
  } = useUserShellBackgroundPreference(profileKey);
  const backgroundOption = getShellBackgroundOption(backgroundMode, backgroundAssetId);

  const shellBackground = resolvedTheme === 'dark'
    ? (isLowDataMode
        ? 'linear-gradient(180deg, rgba(2,6,23,1) 0%, rgba(15,23,42,0.98) 100%)'
        : `radial-gradient(circle at top, hsl(${accent.hue} / 0.28) 0%, transparent 26%),
       radial-gradient(circle at 85% 12%, hsl(${accent.hueSoft} / 0.18) 0%, transparent 24%),
       linear-gradient(180deg, rgba(2,6,23,0.98) 0%, rgba(15,23,42,0.98) 45%, rgba(2,6,23,1) 100%)`)
    : (isLowDataMode
        ? 'linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(226,232,240,0.98) 100%)'
        : `radial-gradient(circle at top, hsl(${accent.hue} / 0.18) 0%, transparent 26%),
       radial-gradient(circle at 85% 12%, hsl(${accent.hueSoft} / 0.12) 0%, transparent 24%),
       linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.98) 42%, rgba(226,232,240,0.98) 100%)`);

  const shellStyle = {
    '--mobile-accent': `hsl(${accent.hue})`,
    '--mobile-accent-soft': `hsl(${accent.hueSoft})`,
    '--mobile-accent-glow': accent.glow,
    background: shellBackground,
  };
  const backgroundAssets = useMemo(() => getShellBackgroundAssets(backgroundMode), [backgroundMode]);
  const quickSettingDefinitions = useMemo(() => (
    MOBILE_SHELL_QUICK_SETTINGS.map((setting) => ({
      ...setting,
      icon: QUICK_SETTING_ICON_MAP[setting.id] || Settings2,
    }))
  ), []);

  const handleOpenModule = (moduleId, appProps) => {
    startTransition(() => {
      openModule(moduleId, appProps);
    });
  };

  const handleNestedOpenApp = useCallback((appId, appProps) => {
    startTransition(() => {
      openModule(appId, appProps);
    });
  }, [openModule]);

  const handleUnlock = () => {
    startTransition(() => {
      unlockShell();
    });
  };

  const handleHome = () => {
    startTransition(() => {
      goHome();
    });
  };

  const handleDrawerSearchChange = (event) => {
    const value = event.target.value;
    startTransition(() => {
      setSearchQuery(value);
    });
  };

  const handleOpenNotification = (notification) => {
    markNotificationRead(notification.id);
    if (notification.moduleId) {
      handleOpenModule(notification.moduleId);
    } else {
      closeOverlays();
    }
  };

  useEffect(() => {
    if (!isFocusMode) return;
    toggleNotifications(false);
    toggleRecents(false);
  }, [isFocusMode, toggleNotifications, toggleRecents]);

  const shellStatusBar = (
    <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.18em] text-white/76">
      <div className="flex items-center gap-2 uppercase">
        <span>{formatClock(now)}</span>
        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px] tracking-[0.14em]">
          {shellViewer.campus}
        </span>
      </div>
      <div className="flex items-center gap-2 uppercase">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px]">
          {isOffline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
          {isOffline ? 'offline' : 'online'}
        </span>
        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-[10px]">92%</span>
      </div>
    </div>
  );

  const homeScreen = (
    <motion.div
      key="home-screen"
      initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.98 }}
      transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
      className="relative flex min-h-full flex-col px-4 pb-40 pt-4"
    >
      {shellStatusBar}

      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {formatDate(now)}
          </p>
          <h1 className="mt-2 text-[1.9rem] font-semibold leading-tight text-white">
            {shellViewer.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/64">
            {isFocusMode
              ? 'Modo foco ativo. A interface reduz distrações e deixa a navegação principal em primeiro plano.'
              : isLowDataMode
                ? 'Modo dados leves ativo. O shell simplifica a camada visual para economizar processamento e rede.'
                : 'Shell mobile funcional do ERP com os mesmos módulos do desktop em uma navegação adaptada para tela pequena.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isFocusMode ? (
            <button
              type="button"
              onClick={() => toggleNotifications(true)}
              className="relative flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/14"
            >
              <Bell className="h-5 w-5" />
              {effectiveUnreadCount > 0 ? (
                <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {effectiveUnreadCount}
                </span>
              ) : null}
            </button>
          ) : (
            <div className="inline-flex h-12 items-center rounded-[20px] border border-emerald-300/15 bg-emerald-500/12 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Foco
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleQuickSettings(true)}
            className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/14"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isOffline ? (
        <div className="mt-4 rounded-[24px] border border-amber-300/14 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          O shell está em modo offline visual. A navegação continua disponível, mas os dados reais dependem da conectividade do app.
        </div>
      ) : null}

      {!isFocusMode ? (
        <div className={cn('mt-6 grid gap-3', isLowDataMode ? 'grid-cols-1' : 'grid-cols-2')}>
          {(isLowDataMode ? MOBILE_SHELL_WIDGETS.slice(0, 1) : MOBILE_SHELL_WIDGETS).map((widget) => (
            <WidgetButton
              key={widget.id}
              widget={widget}
              module={modulesById[WIDGET_TARGETS[widget.id]]}
              onOpen={() => handleOpenModule(WIDGET_TARGETS[widget.id])}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Home Screen
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Apps principais</h2>
        </div>
        <button
          type="button"
          onClick={() => toggleDrawer(true)}
          className="inline-flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80"
        >
          <Search className="h-4 w-4" />
          Buscar
        </button>
      </div>

      <div className={cn('mt-4 grid gap-3', isLowDataMode ? 'grid-cols-3' : 'grid-cols-4')}>
        {homeModules.map((module) => (
          <ShellAppIcon
            key={module.id}
            module={module}
            badge={unreadBadgesByModuleId[module.id] || 0}
            active={activeModuleId === module.id}
            onClick={() => handleOpenModule(module.id)}
          />
        ))}
      </div>

      {!isFocusMode ? (
        <div className="mt-6 rounded-[28px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Multitarefa
              </p>
              <h3 className="mt-2 text-sm font-semibold text-white">
                {recents.length > 0 ? `${recents.length} apps prontos para retomada` : 'A pilha aparece conforme você navega'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => toggleRecents(true)}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/76"
            >
              Abrir stack
            </button>
          </div>
        </div>
      ) : null}
    </motion.div>
  );

  const activeScreen = activeModule ? (
    <motion.div
      key={`module-${activeModule.id}`}
      initial={{ opacity: 0, y: reducedMotion ? 0 : 18, scale: reducedMotion ? 1 : 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : 10, scale: reducedMotion ? 1 : 0.99 }}
      transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
      className="relative flex min-h-full flex-col px-4 pb-40 pt-4"
    >
      {shellStatusBar}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleHome}
            className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/10 text-white"
          >
            <Home className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => closeModule(activeModule.id)}
            className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0 rounded-[22px] border border-white/10 bg-white/8 px-4 py-2 text-center">
          <p className="truncate text-sm font-semibold text-white">{activeModule.title}</p>
          <p className="truncate text-[11px] uppercase tracking-[0.14em] text-white/45">{activeModule.page}</p>
        </div>

        <button
          type="button"
          onClick={() => toggleRecents(true)}
          className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/10 text-white"
        >
          <Layers3 className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto pb-4">
        {ActivePageComponent ? (
          <Suspense
            fallback={(
              <div className="flex min-h-[40vh] items-center justify-center rounded-[28px] border border-white/10 bg-white/6 text-white/75">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  Carregando módulo
                </div>
              </div>
            )}
          >
            <div className={cn(
              'overflow-hidden rounded-[28px] border border-white/10 bg-white/6',
              isLowDataMode ? '' : 'backdrop-blur-2xl'
            )}>
              <ActivePageComponent
                {...(activeStackEntry?.appProps || {})}
                windowLaunchToken={activeStackEntry?.id || `mobile:${activeModule.id}`}
                openApp={handleNestedOpenApp}
                closeWindow={() => closeModule(activeModule.id)}
                desktopWindowId={activeStackEntry?.id || `mobile:${activeModule.id}`}
              />
            </div>
          </Suspense>
        ) : (
          <MobileModuleView
            module={activeModule}
            viewer={shellViewer}
            visualState={moduleViewStates[activeModule.id] || 'content'}
            isOffline={isOffline}
            onCycleState={() => cycleModuleViewState(activeModule.id)}
            onSetState={(stateKey) => setModuleViewState(activeModule.id, stateKey)}
          />
        )}
      </div>
    </motion.div>
  ) : null;

  const lockScreen = (
    <AnimatePresence>
      {locked ? (
        <motion.div
          key="lock-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.22 }}
          className="absolute inset-0 z-50 px-5 pb-8 pt-6"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl bg-[linear-gradient(180deg,rgba(2,6,23,0.2),rgba(2,6,23,0.62))]" />
          <div className="relative flex min-h-full flex-col">
            {shellStatusBar}

            <div className="mt-12">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/50">
                Lock Screen
              </p>
              <h1 className="mt-6 text-[4rem] font-semibold leading-none text-white">{formatClock(now)}</h1>
              <p className="mt-4 text-base text-white/72">{formatDate(now)}</p>
            </div>

            <div className="mt-10 space-y-3">
              {!isFocusMode && visibleNotifications.slice(0, isLowDataMode ? 1 : 2).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur-3xl"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    {notification.group}
                  </p>
                  <h2 className="mt-2 text-sm font-semibold text-white">{notification.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/68">{notification.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-auto">
              <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 backdrop-blur-3xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                      Sessão pronta
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">{shellViewer.role}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      Toque para entrar no shell mobile premium do ERP escolar.
                    </p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-white/12 text-white">
                    <LockKeyhole className="h-6 w-6" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUnlock}
                  className="mt-5 flex w-full items-center justify-center gap-3 rounded-[24px] border border-white/12 bg-white/14 px-4 py-4 text-sm font-semibold text-white shadow-[var(--mobile-accent-glow)]"
                >
                  Desbloquear shell
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className={resolvedTheme === 'dark' ? 'dark' : ''}>
      <div
        className={cn(
          'relative isolate w-full overflow-hidden text-foreground',
          fullscreen ? 'min-h-screen' : 'h-full min-h-full',
          className
        )}
        style={shellStyle}
      >
        {!isLowDataMode && backgroundOption ? (
          <ProjectBackgroundVideo
            className="absolute inset-0 z-0"
            videoClassName="opacity-70"
            overlayClassName="bg-black/16"
            profileKey={profileKey}
          />
        ) : null}

        {!isLowDataMode ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_32%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />
          </>
        ) : null}

        <div className="relative min-h-full">
          <AnimatePresence mode="wait">
            {activeModule ? activeScreen : homeScreen}
          </AnimatePresence>
        </div>

        <div
          className="absolute inset-x-0 bottom-0 z-30 px-4 pb-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
        >
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.96))] px-3 py-3 shadow-[0_-18px_70px_rgba(2,6,23,0.5)] backdrop-blur-3xl">
            <div className="flex items-center justify-between gap-2">
              {dockModules.map((module) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => handleOpenModule(module.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      toggleDockModule(module.id);
                    }}
                    className={cn(
                      'relative flex flex-1 flex-col items-center gap-1 rounded-[20px] px-2 py-2 transition-colors active:scale-[0.97]',
                      activeModuleId === module.id ? 'bg-white/14' : 'bg-transparent hover:bg-white/8'
                    )}
                  >
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10"
                      style={{ backgroundColor: module.bgColor }}
                    >
                      {Icon ? <Icon className="h-5 w-5" style={{ color: module.iconColor }} /> : null}
                    </div>
                    <span className="truncate text-[10px] font-semibold text-white/70">{module.title}</span>
                    {unreadBadgesByModuleId[module.id] ? (
                      <span className="absolute right-3 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                        {unreadBadgesByModuleId[module.id]}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => toggleRecents(true)}
                className="flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/8 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/76"
              >
                <Layers3 className="h-4 w-4" />
                Stack
              </button>
              <button
                type="button"
                onClick={handleHome}
                className="flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/8 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/76"
              >
                <Home className="h-4 w-4" />
                Home
              </button>
              <button
                type="button"
                onClick={() => toggleDrawer(true)}
                className="flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/8 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/76"
              >
                <Grid3X3 className="h-4 w-4" />
                Apps
              </button>
              <button
                type="button"
                onClick={() => toggleQuickSettings(true)}
                className="flex items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/8 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/76"
              >
                <Settings2 className="h-4 w-4" />
                Ajustes
              </button>
            </div>
          </div>
        </div>

        <BottomPanel
          open={drawerOpen}
          onClose={() => toggleDrawer(false)}
          title="App Drawer"
          description="Todos os módulos disponíveis no shell mobile, com busca rápida e integração futura preparada."
          reducedMotion={reducedMotion}
        >
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/42" />
            <input
              value={searchQuery}
              onChange={handleDrawerSearchChange}
              placeholder="Buscar módulo, tag ou rota"
              className="w-full rounded-[22px] border border-white/10 bg-white/8 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/38"
            />
          </label>

          <div className="mt-4 grid gap-3">
            {filteredDrawerModules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => handleOpenModule(module.id)}
                className="flex items-center gap-4 rounded-[26px] border border-white/10 bg-white/6 px-4 py-4 text-left transition-colors hover:bg-white/10"
              >
                <div
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[22px] border border-white/10"
                  style={{ backgroundColor: module.bgColor }}
                >
                  {module.icon ? <module.icon className="h-6 w-6" style={{ color: module.iconColor }} /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{module.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/45">{module.eyebrow}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/64">{module.description}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {dockIds.includes(module.id) ? (
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
                      Dock
                    </span>
                  ) : null}
                  {unreadBadgesByModuleId[module.id] ? (
                    <span className="rounded-full border border-rose-300/15 bg-rose-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-100">
                      {unreadBadgesByModuleId[module.id]} alertas
                    </span>
                  ) : null}
                </div>
              </button>
            ))}

            {filteredDrawerModules.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/55">
                Nenhum módulo corresponde à busca atual.
              </div>
            ) : null}
          </div>
        </BottomPanel>

        <BottomPanel
          open={notificationsOpen}
          onClose={() => toggleNotifications(false)}
          title="Central de notificações"
          description="Agrupamento institucional com ações simuladas para leitura, retomada e descarte."
          reducedMotion={reducedMotion}
          headerActions={(
            <button
              type="button"
              onClick={restoreNotifications}
              className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72"
            >
              Restaurar
            </button>
          )}
        >
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3">
              <p className="text-sm font-semibold text-white">{effectiveUnreadCount} alertas não lidos</p>
              <p className="mt-1 text-sm text-white/64">
                {isFocusMode
                  ? 'Modo foco reduz distrações e mantém notificações fora da home.'
                  : isOffline
                    ? 'Os alertas seguem disponíveis em modo offline simulado.'
                    : 'O shell está pronto para sincronizar notificações reais depois.'}
              </p>
            </div>

            {groupedNotifications.map(([groupName, items]) => (
              <NotificationGroup
                key={groupName}
                groupName={groupName}
                items={items}
                modulesById={modulesById}
                onOpenNotification={handleOpenNotification}
                onDismissNotification={dismissNotification}
                onMarkGroupRead={markGroupRead}
              />
            ))}

            {visibleNotifications.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/55">
                A central está vazia. Use “Restaurar” para repopular o cenário mock.
              </div>
            ) : null}
          </div>
        </BottomPanel>

        <BottomPanel
          open={quickSettingsOpen}
          onClose={() => toggleQuickSettings(false)}
          title="Quick Settings"
          description="Tema, cor principal, foco, conectividade simulada e preferências rápidas do shell."
          reducedMotion={reducedMotion}
          headerActions={(
            <>
              <button
                type="button"
                onClick={lockShell}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72"
              >
                <LockKeyhole className="h-3.5 w-3.5" />
                Bloquear
              </button>
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </button>
              ) : null}
            </>
          )}
        >
          <div className="grid grid-cols-2 gap-3">
            {quickSettingDefinitions.map((setting) => (
              <QuickSettingCard
                key={setting.id}
                title={setting.title}
                description={setting.description}
                active={Boolean(quickSettings[setting.id])}
                icon={setting.icon}
                onToggle={() => toggleQuickSetting(setting.id)}
              />
            ))}
          </div>

          <div className="mt-5 rounded-[28px] border border-white/10 bg-white/6 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Tema
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { id: 'light', label: 'Claro', icon: SunMedium },
                { id: 'dark', label: 'Escuro', icon: MoonStar },
                { id: 'system', label: 'Sistema', icon: Sparkles },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setThemeMode(option.id)}
                  className={cn(
                    'rounded-[22px] border px-3 py-3 text-center transition-colors',
                    themeMode === option.id
                      ? 'border-white/30 bg-gradient-to-br from-white/10 to-white/5'
                      : 'border-white/10 bg-white/6 text-white/70 hover:bg-white/10'
                  )}
                >
                  <option.icon className="mx-auto h-5 w-5" />
                  <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.14em]">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-white/10 bg-white/6 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Plano de fundo do meu perfil
            </p>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/6 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {backgroundMode === 'animado' ? 'Animado' : 'Estatico'}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-white/58">
                  {backgroundMode === 'animado'
                    ? 'Usa videos animados como fundo.'
                    : 'Usa imagens fixas como fundo.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  Estatico
                </span>
                <Switch
                  checked={backgroundMode === 'animado'}
                  onCheckedChange={(checked) => setBackgroundMode(checked ? 'animado' : 'estatico')}
                  aria-label="Alternar fundo animado ou estatico"
                />
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  Animado
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {backgroundAssets.map((option) => {
                const isSelected = backgroundAssetId === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBackgroundSelection(option.type, option.id)}
                    className={cn(
                      'overflow-hidden rounded-[22px] border p-2 text-left transition-all',
                      isSelected
                        ? 'border-white/30 bg-gradient-to-br from-white/10 to-white/5 shadow-[var(--mobile-accent-glow)]'
                        : 'border-white/10 bg-white/6 text-white/70 hover:bg-white/10'
                    )}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] border border-white/10 bg-white/8">
                      {option.assetType === 'video' ? (
                        <video
                          src={option.source}
                          className="h-full w-full object-cover"
                          muted
                          loop
                          autoPlay
                          playsInline
                          aria-hidden="true"
                        />
                      ) : (
                        <img
                          src={option.source}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/18" />
                      <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/88">
                        {option.type === 'animado' ? 'Animado' : 'Estático'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-white">{option.label}</p>
                    <p className="mt-1 text-[11px] leading-5 text-white/58">{option.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-white/70" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Cor primária
              </p>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2 min-[400px]:gap-3">
              {MOBILE_SHELL_ACCENTS.map((option) => { const isSelected = accentId === option.id; return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccent(option.id)}
                  className={cn(
                    'rounded-[18px] border p-1.5 min-[400px]:p-2 text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 min-[400px]:gap-1.5',
                    isSelected
                      ? 'border-white/30 bg-gradient-to-br from-white/10 to-white/5'
                      : 'border-white/10 bg-white/6 text-white/70 hover:bg-white/10'
                  )}
                >
                  <span
                    className="mx-auto block h-8 w-8 rounded-full border border-white/15"
                    style={{ background: `linear-gradient(135deg, hsl(${option.hue}), hsl(${option.hueSoft}))` }}
                  />
                  <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.14em]">
                    {option.label}
                  </span>
                </button>
              )})}
            </div>
          </div>
        </BottomPanel>

        <BottomPanel
          open={recentsOpen}
          onClose={() => toggleRecents(false)}
          title="Multitarefa em stack"
          description="Retomada visual dos módulos recentes, com cards empilhados e foco instantâneo."
          reducedMotion={reducedMotion}
        >
          <div className="space-y-3">
            {recents.map((module, index) => (
              <RecentsCard
                key={module.id}
                module={module}
                depth={index}
                isActive={activeModuleId === module.id}
                onOpen={() => handleOpenModule(module.id)}
                onClose={() => closeModule(module.id)}
              />
            ))}

            {recents.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/55">
                Abra alguns módulos e a pilha multitarefa será montada automaticamente.
              </div>
            ) : null}
          </div>
        </BottomPanel>

        {lockScreen}
      </div>
    </div>
  );
}
