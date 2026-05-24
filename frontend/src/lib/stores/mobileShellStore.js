import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  MOBILE_SHELL_DEFAULT_VIEW_STATES,
  MOBILE_SHELL_QUICK_SETTINGS,
  createMockNotifications,
} from '@/lib/mocks/mobileShell';

const MOBILE_SHELL_STORAGE_KEY = 'project-wg-mobile-shell-v3';

const createModuleInstanceId = (moduleId) => (
  globalThis.crypto?.randomUUID?.()
  || `${moduleId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

const ensureUniqueIds = (ids = []) => [...new Set(ids.filter(Boolean))];

const arraysShallowEqual = (left = [], right = []) => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const objectsShallowEqual = (left = {}, right = {}) => {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([key, value]) => right[key] === value);
};

const moduleCatalogShallowEqual = (left = [], right = []) => (
  left.length === right.length
  && left.every((module, index) => {
    const candidate = right[index];
    if (!candidate) return false;

    return (
      module.id === candidate.id
      && module.appId === candidate.appId
      && module.page === candidate.page
      && module.title === candidate.title
      && module.eyebrow === candidate.eyebrow
      && module.description === candidate.description
      && module.heroTitle === candidate.heroTitle
      && module.heroCopy === candidate.heroCopy
      && module.accent === candidate.accent
      && module.icon === candidate.icon
      && module.iconColor === candidate.iconColor
      && module.bgColor === candidate.bgColor
      && module.integrationStatus === candidate.integrationStatus
      && arraysShallowEqual(module.metrics, candidate.metrics)
      && arraysShallowEqual(module.feed, candidate.feed)
      && arraysShallowEqual(module.actions, candidate.actions)
    );
  })
);

const sanitizeIds = (ids = [], availableIds = [], fallbackIds = []) => {
  const available = new Set(availableIds);
  const filtered = ensureUniqueIds(ids).filter((id) => available.has(id));
  if (filtered.length > 0) return filtered;
  return ensureUniqueIds(fallbackIds).filter((id) => available.has(id));
};

const buildDefaultQuickSettings = () => Object.fromEntries(
  MOBILE_SHELL_QUICK_SETTINGS.map((item) => [
    item.id,
    item.id === 'sync' || item.id === 'alerts' || item.id === 'wifi',
  ])
);

const buildDefaultModuleStates = (modules = []) => Object.fromEntries(
  modules.map((module) => [module.id, MOBILE_SHELL_DEFAULT_VIEW_STATES[module.id] || 'content'])
);

const cycleVisualState = (currentState = 'content') => {
  const order = ['content', 'loading', 'empty', 'error'];
  const currentIndex = order.indexOf(currentState);
  return order[(currentIndex + 1) % order.length];
};

export const useMobileShellStore = create(
  persist(
    (set, get) => ({
      modules: [],
      stack: [],
      activeModuleId: null,
      homeIds: [],
      dockIds: [],
      widgetIds: ['pulse', 'communications', 'agenda'],
      searchQuery: '',
      drawerOpen: false,
      notificationsOpen: false,
      quickSettingsOpen: false,
      recentsOpen: false,
      locked: true,
      themeMode: 'system',
      accentId: 'institutional',
      quickSettings: buildDefaultQuickSettings(),
      notifications: [],
      moduleViewStates: {},

      registerModules: (modules = []) => {
        const availableIds = modules.map((module) => module.id);
        const defaultDockIds = ['dashboard', 'messages', 'schoolcalendar', 'settings'];
        const defaultHomeIds = modules.slice(0, 8).map((module) => module.id);

        set((state) => {
          const nextStack = state.stack.filter((entry) => availableIds.includes(entry.moduleId));
          const nextDockIds = sanitizeIds(state.dockIds, availableIds, defaultDockIds).slice(0, 4);
          const nextHomeIds = sanitizeIds(state.homeIds, availableIds, defaultHomeIds).slice(0, 8);
          const nextModuleViewStates = {
            ...buildDefaultModuleStates(modules),
            ...Object.fromEntries(
              Object.entries(state.moduleViewStates).filter(([moduleId]) => availableIds.includes(moduleId))
            ),
          };
          const nextNotifications = state.notifications.length > 0
            ? state.notifications.filter((notification) => (
              !notification.moduleId || availableIds.includes(notification.moduleId)
            ))
            : createMockNotifications(modules);

          const nextActiveModuleId =
            state.activeModuleId && availableIds.includes(state.activeModuleId)
              ? state.activeModuleId
              : nextStack.at(-1)?.moduleId || null;

          const notificationsUnchanged = arraysShallowEqual(state.notifications, nextNotifications);
          const moduleStatesUnchanged = objectsShallowEqual(state.moduleViewStates, nextModuleViewStates);
          const modulesUnchanged = moduleCatalogShallowEqual(state.modules, modules);

          if (
            modulesUnchanged
            && arraysShallowEqual(state.homeIds, nextHomeIds)
            && arraysShallowEqual(state.dockIds, nextDockIds)
            && arraysShallowEqual(state.stack, nextStack)
            && notificationsUnchanged
            && moduleStatesUnchanged
            && state.activeModuleId === nextActiveModuleId
          ) {
            return state;
          }

          return {
            modules,
            stack: nextStack,
            activeModuleId: nextActiveModuleId,
            dockIds: nextDockIds,
            homeIds: nextHomeIds,
            notifications: nextNotifications,
            moduleViewStates: nextModuleViewStates,
          };
        });
      },

      unlockShell: () => set({ locked: false }),
      lockShell: () => set({ locked: true, drawerOpen: false, notificationsOpen: false, quickSettingsOpen: false, recentsOpen: false }),

      openModule: (moduleId, appProps) => {
        if (!get().modules.some((module) => module.id === moduleId)) return;

        set((state) => {
          const nextEntry = {
            id: createModuleInstanceId(moduleId),
            moduleId,
            ...(appProps !== undefined ? { appProps } : {}),
            openedAt: Date.now(),
          };
          const nextStack = [
            ...state.stack.filter((entry) => entry.moduleId !== moduleId),
            nextEntry,
          ].slice(-6);

          return {
            stack: nextStack,
            activeModuleId: moduleId,
            drawerOpen: false,
            notificationsOpen: false,
            quickSettingsOpen: false,
            recentsOpen: false,
            searchQuery: '',
          };
        });
      },

      focusModule: (moduleId, appProps) => {
        get().openModule(moduleId, appProps);
      },

      closeModule: (moduleId) => {
        set((state) => {
          const nextStack = state.stack.filter((entry) => entry.moduleId !== moduleId);
          const nextActiveModuleId = state.activeModuleId === moduleId
            ? nextStack.at(-1)?.moduleId || null
            : state.activeModuleId;

          return {
            stack: nextStack,
            activeModuleId: nextActiveModuleId,
          };
        });
      },

      goHome: () => set({
        activeModuleId: null,
        drawerOpen: false,
        notificationsOpen: false,
        quickSettingsOpen: false,
        recentsOpen: false,
      }),

      toggleDrawer: (nextValue) => set((state) => {
        const open = typeof nextValue === 'boolean' ? nextValue : !state.drawerOpen;
        return {
          drawerOpen: open,
          notificationsOpen: open ? false : state.notificationsOpen,
          quickSettingsOpen: open ? false : state.quickSettingsOpen,
          recentsOpen: open ? false : state.recentsOpen,
        };
      }),

      toggleNotifications: (nextValue) => set((state) => {
        const open = typeof nextValue === 'boolean' ? nextValue : !state.notificationsOpen;
        return {
          notificationsOpen: open,
          drawerOpen: open ? false : state.drawerOpen,
          quickSettingsOpen: open ? false : state.quickSettingsOpen,
          recentsOpen: open ? false : state.recentsOpen,
        };
      }),

      toggleQuickSettings: (nextValue) => set((state) => {
        const open = typeof nextValue === 'boolean' ? nextValue : !state.quickSettingsOpen;
        return {
          quickSettingsOpen: open,
          drawerOpen: open ? false : state.drawerOpen,
          notificationsOpen: open ? false : state.notificationsOpen,
          recentsOpen: open ? false : state.recentsOpen,
        };
      }),

      toggleRecents: (nextValue) => set((state) => {
        const open = typeof nextValue === 'boolean' ? nextValue : !state.recentsOpen;
        return {
          recentsOpen: open,
          drawerOpen: open ? false : state.drawerOpen,
          notificationsOpen: open ? false : state.notificationsOpen,
          quickSettingsOpen: open ? false : state.quickSettingsOpen,
        };
      }),

      closeOverlays: () => set({
        drawerOpen: false,
        notificationsOpen: false,
        quickSettingsOpen: false,
        recentsOpen: false,
      }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      toggleDockModule: (moduleId) => {
        set((state) => {
          if (!state.modules.some((module) => module.id === moduleId)) return state;

          if (state.dockIds.includes(moduleId)) {
            return {
              dockIds: state.dockIds.filter((id) => id !== moduleId),
            };
          }

          return {
            dockIds: [...state.dockIds, moduleId].slice(-4),
          };
        });
      },

      setAccent: (accentId) => set({ accentId }),
      setThemeMode: (themeMode) => set({ themeMode }),

      toggleQuickSetting: (settingId) => {
        set((state) => ({
          quickSettings: {
            ...state.quickSettings,
            [settingId]: !state.quickSettings[settingId],
          },
        }));
      },

      setModuleViewState: (moduleId, visualState) => {
        set((state) => ({
          moduleViewStates: {
            ...state.moduleViewStates,
            [moduleId]: visualState,
          },
        }));
      },

      cycleModuleViewState: (moduleId) => {
        set((state) => ({
          moduleViewStates: {
            ...state.moduleViewStates,
            [moduleId]: cycleVisualState(state.moduleViewStates[moduleId]),
          },
        }));
      },

      markNotificationRead: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((notification) => (
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          )),
        }));
      },

      dismissNotification: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((notification) => (
            notification.id === notificationId
              ? { ...notification, dismissed: true }
              : notification
          )),
        }));
      },

      markGroupRead: (groupName) => {
        set((state) => ({
          notifications: state.notifications.map((notification) => (
            notification.group === groupName
              ? { ...notification, read: true }
              : notification
          )),
        }));
      },

      restoreNotifications: () => {
        set((state) => ({
          notifications: createMockNotifications(state.modules),
        }));
      },
    }),
    {
      name: MOBILE_SHELL_STORAGE_KEY,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        accentId: state.accentId,
        themeMode: state.themeMode,
        dockIds: state.dockIds,
        homeIds: state.homeIds,
        quickSettings: state.quickSettings,
        notifications: state.notifications,
        moduleViewStates: state.moduleViewStates,
      }),
    }
  )
);
