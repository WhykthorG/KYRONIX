// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import React, { memo, startTransition, useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { AnimatePresence, useReducedMotion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { School,
  RefreshCw, LayoutGrid, Info, Plus, Palette, Feather
} from 'lucide-react';
import Window from '@/components/desktop/Window';
import Taskbar from '@/components/desktop/Taskbar';
import DesktopIcon from '@/components/desktop/DesktopIcon';
import NotificationBar from '@/components/desktop/NotificationBar';
import GlobalSearchBar from '@/components/desktop/GlobalSearchBar';
import DesktopIdleOverlay from '@/components/desktop/DesktopIdleOverlay';
import ChatHub from '@/components/chat/ChatHub';
import ProjectBackgroundVideo from '@/components/common/ProjectBackgroundVideo';
import RenderProfiler from '@/components/common/RenderProfiler';
import appRegistry from '@/lib/appRegistry';
import { Loader2 as PageLoader } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { DEFAULT_IDLE_TIMEOUT_MS, useUserInactivity } from '@/hooks/useUserInactivity';
import { useDesktopShortcutsLayout } from '@/hooks/useDesktopShortcutsLayout';
import { useWorkspacePersistence } from '@/hooks/useWorkspacePersistence';
import MobileShell from '@/components/desktop/MobileShell';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useAuth } from '@/lib/AuthContext';
import { canAccessPage } from '@shared/contracts/access';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { getAppsForProfile, getAppById } from '@/lib/appManifest';
import { useDesktopShellStore } from '@/lib/stores/desktopShellStore';
import { useDesktopPerformanceMode } from '@/lib/desktopPerformanceMode';
import { getShellBackgroundAssets } from '@/lib/shellBackground';
import { useUserShellBackgroundPreference } from '@/lib/userShellBackground';

const isEditableElement = (target) => {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

const DesktopWindowItem = memo(function DesktopWindowItem({
  win,
  boundsRef,
  closeWindow,
  minimizeWindow,
  focusWindow,
  clearSnapRequest,
  keyboardSnapRequest,
  openApp,
  reducedMotion,
  disableWindowPreviews,
}) {
  const app = getAppById(win.appId);
  if (!app) return null;

  const PageComponent = appRegistry[app.page];

  return (
    <Window
      id={win.id}
      title={app.title}
      icon={app.icon}
      iconColor={app.iconColor}
      zIndex={win.zIndex}
      boundsRef={boundsRef}
      isFocused={win.focused}
      // @ts-ignore
      alwaysOnTop={win.alwaysOnTop}
      minimized={win.minimized}
      onClose={() => closeWindow(win.id)}
      onMinimize={() => minimizeWindow(win.id)}
      onFocus={() => focusWindow(win.id)}
      keyboardSnapRequest={keyboardSnapRequest}
      onKeyboardSnapHandled={() => clearSnapRequest(keyboardSnapRequest?.requestId ?? null)}
      reducedMotion={reducedMotion}
      disableWindowPreviews={disableWindowPreviews}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center h-full bg-slate-50">
          <PageLoader className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      }>
        {PageComponent
          ? (
            <PageComponent
              {...(win.appProps || {})}
              windowLaunchToken={win.launchToken}
              openApp={openApp}
              closeWindow={closeWindow}
              desktopWindowId={win.id}
            />
          )
          : <div className="p-8 text-center text-slate-500">Módulo não encontrado</div>}
      </Suspense>
    </Window>
  );
});

const DesktopWindowLayer = memo(function DesktopWindowLayer({
  windows,
  boundsRef,
  closeWindow,
  minimizeWindow,
  focusWindow,
  clearSnapRequest,
  snapRequest,
  openApp,
  reducedMotion,
  disableWindowPreviews,
}) {
  return (
    <AnimatePresence>
      {windows.map((win) => (
        <DesktopWindowItem
          key={win.id}
          win={win}
          boundsRef={boundsRef}
          closeWindow={closeWindow}
          minimizeWindow={minimizeWindow}
          focusWindow={focusWindow}
          clearSnapRequest={clearSnapRequest}
          keyboardSnapRequest={snapRequest?.windowId === win.id ? snapRequest : null}
          openApp={openApp}
          reducedMotion={reducedMotion}
          disableWindowPreviews={disableWindowPreviews}
        />
      ))}
    </AnimatePresence>
  );
});

export default function Desktop() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profileType, currentProfile } = usePermissions();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const windows = useDesktopShellStore((s) => s.windows);
  const activeWindowId = useDesktopShellStore((s) => s.activeWindowId);
  const openWindow = useDesktopShellStore((s) => s.openWindow);
  const closeWindow = useDesktopShellStore((s) => s.closeWindow);
  const minimizeWindow = useDesktopShellStore((s) => s.minimizeWindow);
  const focusWindow = useDesktopShellStore((s) => s.focusWindow);
  const toggleAlwaysOnTop = useDesktopShellStore((s) => s.toggleAlwaysOnTop);
  const snapRequest = useDesktopShellStore((s) => s.snapRequest);
  const requestWindowSnap = useDesktopShellStore((s) => s.requestWindowSnap);
  const clearSnapRequest = useDesktopShellStore((s) => s.clearSnapRequest);
  const pruneWindowsNotAllowed = useDesktopShellStore((s) => s.pruneWindowsNotAllowed);
  const loadWorkspace = useDesktopShellStore((s) => s.loadWorkspace);
  const resetShell = useDesktopShellStore((s) => s.resetShell);
  const [startOpen, setStartOpen] = useState(false);
  const [globalSearchUiOpen, setGlobalSearchUiOpen] = useState(false);
  const [systemInfoOpen, setSystemInfoOpen] = useState(false);
  const profileKey = currentProfile?.id || user?.email || user?.id || null;
  const {
    isLightMode,
    toggleDesktopPerformanceMode,
  } = useDesktopPerformanceMode();
  const windowLayerRef = useRef(null);
  const startButtonRef = useRef(null);
  const canAccessApp = useCallback(
    (app) => {
      if (!app) return false;
      if (Array.isArray(app.permissions) && app.permissions.length === 0) return true;
      return Boolean(profileType) && canAccessPage(profileType, app.page);
    },
    [profileType]
  );
  const APPS = useMemo(
    () => (profileType ? getAppsForProfile(profileType, canAccessPage) : []),
    [profileType]
  );
  const allowedAppIds = useMemo(() => new Set(APPS.map((app) => app.id)), [APPS]);
  const appsById = useMemo(
    () => Object.fromEntries(APPS.map((app) => [app.id, app])),
    [APPS]
  );
  const {
    desktopRef,
    desktopAppsIds,
    pinnedAppsIds,
    iconPositions,
    computedPositions,
    visibleDesktopAppIds,
    setDesktopAppsIds,
    setPinnedAppsIds,
    setIconPositions,
    handlePositionChange,
    removeShortcut,
    addDesktopShortcut,
    togglePinTaskbar,
    handleRearrangeIcons,
  } = useDesktopShortcutsLayout({ allowedAppIds });
  const { hydrationDone } = useWorkspacePersistence({
    userId: user?.id || null,
    isMobile,
    profileType,
    apps: APPS,
    allowedAppIds,
    windows,
    activeWindowId,
    loadWorkspace,
    resetShell,
    pruneWindowsNotAllowed,
    desktopAppsIds,
    pinnedAppsIds,
    iconPositions,
    setDesktopAppsIds,
    setPinnedAppsIds,
    setIconPositions,
  });
  const {
    isIdle: idleModeActive,
    idleSince,
    markActive: resumeFromIdle,
  } = useUserInactivity({
    timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    disabled: isMobile || !hydrationDone,
  });
  const reducedEffects = Boolean(prefersReducedMotion || isLightMode);
  const {
    backgroundMode,
    backgroundAssetId,
    setBackgroundMode,
    setBackgroundSelection,
  } = useUserShellBackgroundPreference(profileKey);
  useEffect(() => {
    if (!isLightMode || backgroundMode !== 'animado') return;

    setBackgroundMode('estatico');
  }, [backgroundMode, isLightMode, setBackgroundMode]);
  const backgroundAssets = useMemo(
    () => getShellBackgroundAssets(backgroundMode),
    [backgroundMode]
  );
  const desktopIconsTopInset = 56;
  // Maximized windows should cover the decorative wallpaper area from the top.
  const desktopTopInset = 0;
  useEffect(() => {
    if (!idleModeActive) return;

    startTransition(() => {
      setStartOpen(false);
      setGlobalSearchUiOpen(false);
      setSystemInfoOpen(false);
    });
  }, [idleModeActive]);

  const toggleGlobalSearch = useCallback(() => {
    startTransition(() => {
      setStartOpen(false);
      setGlobalSearchUiOpen((current) => !current);
    });
  }, []);

  const openApp = useCallback(
    (appId, appProps, context) => {
      const app = getAppById(appId);
      if (!app) return;
      if (!canAccessApp(app)) return;
      startTransition(() => {
        setStartOpen(false);
        openWindow(appId, appProps, context);
      });
    },
    [canAccessApp, openWindow]
  );

  useEffect(() => {
    const requestedAppId = location.state?.desktopOpenAppId;
    if (!requestedAppId) return;
    if (!profileType) return;
    if (isMobile) return;

    const requestedApp = getAppById(requestedAppId);
    if (!requestedApp || !canAccessApp(requestedApp)) {
      navigate('/Desktop', { replace: true, state: {} });
      return;
    }

    openApp(requestedAppId, location.state?.desktopOpenAppProps || undefined);
    navigate('/Desktop', { replace: true, state: {} });
  }, [canAccessApp, location.state, navigate, openApp, profileType]);

  const taskClick = useCallback((id) => {
    const win = windows.find(w => w.id === id);
    if (!win) return;
    win.focused && !win.minimized ? minimizeWindow(id) : focusWindow(id);
  }, [focusWindow, minimizeWindow, windows]);

  const toggleTaskMinimize = useCallback((id) => {
    const win = windows.find((item) => item.id === id);
    if (!win) return;
    if (win.minimized) {
      focusWindow(id);
      return;
    }
    minimizeWindow(id);
  }, [focusWindow, minimizeWindow, windows]);

  const openTaskbarWindows = useMemo(() => (
    windows.map((windowItem) => {
      const app = getAppById(windowItem.appId);
      return {
        ...windowItem,
        title: app?.title,
        icon: app?.icon,
        iconColor: app?.iconColor,
        isPinned: false,
        isOpen: true,
      };
    })
  ), [windows]);

  const pinnedTaskbarItems = useMemo(() => (
    pinnedAppsIds
      .filter((id) => allowedAppIds.has(id))
      .filter((id) => !windows.some((windowItem) => windowItem.appId === id))
      .map((id) => {
        const app = getAppById(id);
        return {
          id,
          title: app?.title,
          icon: app?.icon,
          iconColor: app?.iconColor,
          isPinned: true,
          focused: false,
          minimized: false,
          isOpen: false,
        };
      })
  ), [allowedAppIds, pinnedAppsIds, windows]);

  const allTaskbarItems = useMemo(
    () => [...pinnedTaskbarItems, ...openTaskbarWindows],
    [openTaskbarWindows, pinnedTaskbarItems]
  );

  const handleRefreshData = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const handleStartMenuToggle = useCallback(() => {
    startTransition(() => {
      setStartOpen((current) => !current);
    });
  }, []);

  const handleStartMenuOpen = useCallback(() => {
    startTransition(() => {
      setStartOpen(true);
    });
  }, []);

  const handleStartMenuClose = useCallback(() => {
    startTransition(() => {
      setStartOpen(false);
    });
  }, []);

  const handleGlobalSearchActivate = useCallback(() => {
    startTransition(() => {
      setGlobalSearchUiOpen(true);
    });
  }, []);

  const handleGlobalSearchResultOpen = useCallback((appId, appProps) => {
    startTransition(() => {
      setStartOpen(false);
      openApp(appId, appProps);
    });
  }, [openApp]);

  const handleSystemInfoOpen = useCallback(() => {
    startTransition(() => {
      setSystemInfoOpen(true);
    });
  }, []);

  useEffect(() => {
    const handleGlobalShortcut = (event) => {
      const normalizedKey = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && normalizedKey === 'o') {
        event.preventDefault();
        handleRearrangeIcons();
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (normalizedKey === 'k') {
        event.preventDefault();
        startTransition(() => {
          setGlobalSearchUiOpen(false);
          setStartOpen((current) => !current);
        });
        return;
      }

      if (normalizedKey === 'g') {
        event.preventDefault();
        toggleGlobalSearch();
        return;
      }

      if (
        (normalizedKey === 'arrowleft' || normalizedKey === 'arrowright')
        && event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && !event.shiftKey
      ) {
        if (!activeWindowId || isEditableElement(event.target)) {
          return;
        }

        event.preventDefault();
        requestWindowSnap(activeWindowId, normalizedKey === 'arrowleft' ? 'left' : 'right');
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [activeWindowId, handleRearrangeIcons, requestWindowSnap, toggleGlobalSearch]);

  const desktopIconElements = useMemo(() => (
    visibleDesktopAppIds.map((id) => {
      const app = getAppById(id);
      if (!app) return null;

      return (
        <DesktopIcon
          key={app.id}
          app={app}
          onOpen={openApp}
          onRemove={removeShortcut}
          onPin={togglePinTaskbar}
          isPinned={pinnedAppsIds.includes(app.id)}
          initialPosition={computedPositions[app.id] || { x: 8, y: 8 }}
          onPositionChange={handlePositionChange}
          dragConstraintsRef={desktopRef}
        />
      );
    })
  ), [
    computedPositions,
    handlePositionChange,
    openApp,
    pinnedAppsIds,
    removeShortcut,
    togglePinTaskbar,
    visibleDesktopAppIds,
  ]);

  if (isMobile) {
    return (
      <MobileShell
        apps={APPS}
        profileKey={currentProfile?.id || user?.email || user?.id || null}
        requestedAppLaunch={
          location.state?.desktopOpenAppId
            ? {
                appId: location.state.desktopOpenAppId,
                appProps: location.state?.desktopOpenAppProps || undefined,
              }
            : null
        }
        onRequestedAppHandled={() => navigate('/Desktop', { replace: true, state: {} })}
      />
    );
  }

  const overlaysBlockingShell = startOpen || idleModeActive;
  const desktopContainStyle = {
    contentVisibility: 'auto',
    contain: 'layout paint style',
    containIntrinsicSize: '1200px 900px',
  };

  return (
    <RenderProfiler id="Desktop">
      <ContextMenu>
      <ProjectBackgroundVideo
        className="fixed inset-0 overflow-hidden select-none"
        contentClassName="h-full"
        profileKey={currentProfile?.id || user?.email || user?.id || null}
        forceStatic={isLightMode}
      >
        <NotificationBar onOpenApp={openApp} />
        <GlobalSearchBar
          appsById={appsById}
          profileType={profileType}
          searchEnabled={true}
          topOffset={48}
          user={user}
          isVisible={globalSearchUiOpen}
          onVisibilityChange={setGlobalSearchUiOpen}
          onActivate={handleGlobalSearchActivate}
          onOpenResult={handleGlobalSearchResultOpen}
        />


        <ContextMenuTrigger asChild>
          <div
            ref={desktopRef}
            className="absolute inset-x-0 bottom-12 overflow-hidden z-[1]"
            style={{ left: 0, top: desktopIconsTopInset, ...desktopContainStyle }}
          >
            {desktopIconElements}
          </div>
        </ContextMenuTrigger>


        <div
          ref={windowLayerRef}
          className="absolute inset-x-0 bottom-12 pointer-events-none z-10"
          style={{ top: desktopTopInset, ...desktopContainStyle }}
        >
          <DesktopWindowLayer
            windows={windows}
            boundsRef={windowLayerRef}
            closeWindow={closeWindow}
            minimizeWindow={minimizeWindow}
            focusWindow={focusWindow}
            clearSnapRequest={clearSnapRequest}
            snapRequest={snapRequest}
            openApp={openApp}
            reducedMotion={reducedEffects}
            disableWindowPreviews={reducedEffects}
          />
        </div>

        <ChatHub />

        <Taskbar
          openWindows={allTaskbarItems}
          onTaskClick={taskClick}
          onStartClick={handleStartMenuToggle}
          onStartClose={handleStartMenuClose}
          // @ts-ignore
          onCloseTask={closeWindow}
          onMinimizeTask={toggleTaskMinimize}
          onToggleAlwaysOnTop={toggleAlwaysOnTop}
          onUnpinTask={togglePinTaskbar}
          onOpenApp={openApp}
          onSearchClick={() => {}}
          searchOpen={globalSearchUiOpen}
          hidden={startOpen || idleModeActive}
          startOpen={startOpen}
          startButtonRef={startButtonRef}
          startMenuApps={APPS}
          onAddDesktopShortcut={addDesktopShortcut}
          profileType={profileType}
          shellUser={user}
          blockAnimatedBackground={isLightMode}
          disableWindowPreviews={reducedEffects}
          reducedMotion={reducedEffects}
        />

        <DesktopIdleOverlay
          active={overlaysBlockingShell && idleModeActive}
          idleSince={idleSince}
          profileType={profileType}
          user={user}
          onResume={resumeFromIdle}
          reducedMotion={reducedEffects}
        />
      </ProjectBackgroundVideo>

      {/* @ts-ignore - shadcn wrappers typing in JS */}
      <ContextMenuContent className="w-56 bg-slate-950 border-white/10 text-white rounded-xl shadow-2xl overflow-hidden p-1 shadow-black/50">
        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuItem onClick={handleStartMenuOpen} className="hover:bg-white/10 cursor-pointer focus:bg-white/20 p-2 rounded-lg m-1 transition-all">
          <Plus className="w-4 h-4 mr-2 text-indigo-400" />
          Novo Atalho
          {/* @ts-ignore - shadcn wrappers typing in JS */}
          <ContextMenuShortcut>Start</ContextMenuShortcut>
        </ContextMenuItem>

        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuItem
          onClick={isLightMode ? undefined : () => setBackgroundMode(backgroundMode === 'animado' ? 'estatico' : 'animado')}
          disabled={isLightMode}
          className="hover:bg-white/10 cursor-pointer focus:bg-white/20 p-2 rounded-lg m-1 transition-all data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50"
        >
          <Palette className="w-4 h-4 mr-2 text-violet-400" />
          {isLightMode
            ? 'Fundo animado bloqueado no modo leve'
            : backgroundMode === 'animado'
              ? 'Usar fundo estático'
              : 'Usar fundo animado'}
        </ContextMenuItem>

        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuItem
          onClick={toggleDesktopPerformanceMode}
          className="hover:bg-white/10 cursor-pointer focus:bg-white/20 p-2 rounded-lg m-1 transition-all"
        >
          <Feather className="w-4 h-4 mr-2 text-sky-400" />
          {isLightMode ? 'Desativar modo leve' : 'Ativar modo leve'}
        </ContextMenuItem>

        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuSeparator className="bg-white/10 mx-1" />

        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuItem onClick={handleRefreshData} className="hover:bg-white/10 cursor-pointer focus:bg-white/20 p-2 rounded-lg m-1 transition-all">
          <RefreshCw className="w-4 h-4 mr-2 text-emerald-400" />
          Atualizar Área de Trabalho
          {/* @ts-ignore - shadcn wrappers typing in JS */}
          <ContextMenuShortcut>F5</ContextMenuShortcut>
        </ContextMenuItem>

        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuItem onClick={handleRearrangeIcons} className="hover:bg-white/10 cursor-pointer focus:bg-white/20 p-2 rounded-lg m-1 transition-all">
          <LayoutGrid className="w-4 h-4 mr-2 text-blue-400" />
          Organizar Ícones
          {/* @ts-ignore - shadcn wrappers typing in JS */}
          <ContextMenuShortcut>Ctrl Shift O</ContextMenuShortcut>
        </ContextMenuItem>

        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuSeparator className="bg-white/10 mx-1" />

        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <ContextMenuItem onClick={handleSystemInfoOpen} className="hover:bg-white/10 cursor-pointer focus:bg-white/20 p-2 rounded-lg m-1 transition-all">
          <Info className="w-4 h-4 mr-2 text-slate-400" />
          Sobre o Sistema
        </ContextMenuItem>
      </ContextMenuContent>

      <Dialog open={systemInfoOpen} onOpenChange={setSystemInfoOpen}>
        {/* @ts-ignore - shadcn wrappers typing in JS */}
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[425px] rounded-3xl overflow-hidden shadow-2xl shadow-black">
          {/* @ts-ignore - shadcn wrappers typing in JS */}
          <DialogHeader>
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/20 rotate-3">
              <School className="w-8 h-8 text-white" />
            </div>
            {/* @ts-ignore - shadcn wrappers typing in JS */}
            <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Project WG
            </DialogTitle>
            {/* @ts-ignore - shadcn wrappers typing in JS */}
            <DialogDescription className="text-center text-slate-400">
              Sistema Integrado de Gestão Escolar
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Versão</span>
                <span className="font-mono text-indigo-300">1.0.0</span>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Status</span>
                <span className="text-emerald-400 font-medium">Online</span>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Arquitetura</span>
                <span className="text-slate-300">React + Vite</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Core Engine</span>
                <span className="text-slate-300">Supabase DB</span>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                  Plano de fundo do meu perfil
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Disponível também na versão desktop.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {backgroundMode === 'animado' ? 'Animado' : 'Estatico'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {backgroundMode === 'animado'
                      ? 'Usa vídeos animados como fundo.'
                      : 'Usa imagens fixas como fundo.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Estático
                  </span>
                  <Switch
                    disabled={isLightMode}
                    checked={backgroundMode === 'animado'}
                    onCheckedChange={(checked) => {
                      if (isLightMode) return;
                      setBackgroundMode(checked ? 'animado' : 'estatico');
                    }}
                    aria-label="Alternar fundo animado ou estático"
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    Animado
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {backgroundAssets.map((option) => {
                  const isSelected = backgroundAssetId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isLightMode && option.type === 'animado'}
                      onClick={() => {
                        if (isLightMode && option.type === 'animado') return;
                        setBackgroundSelection(option.type, option.id);
                      }}
                      className={[
                        'overflow-hidden rounded-2xl border text-left transition-all',
                        isLightMode && option.type === 'animado'
                          ? 'opacity-50 cursor-not-allowed'
                          : '',
                        isSelected
                          ? 'border-white/30 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                          : 'border-white/10 bg-white/5 hover:bg-white/8',
                      ].join(' ')}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
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
                        <div className="absolute inset-0 bg-black/10" />
                        <span className="absolute left-2 top-2 rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white">
                          {option.type === 'animado' ? 'Animado' : 'Estático'}
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-semibold text-white">{option.label}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-center text-[11px] text-slate-500 pt-4 italic">
              "Eficiência e inovação na ponta dos seus dedos"
            </p>
          </div>
        </DialogContent>
      </Dialog>
      </ContextMenu>
    </RenderProfiler>
  );
}
