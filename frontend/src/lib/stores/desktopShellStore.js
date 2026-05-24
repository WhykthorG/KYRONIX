/**
 * Store única do shell desktop: janelas, foco e z-order.
 * Substitui estado local em Desktop.jsx e o antigo windowStore.
 */

import { create } from 'zustand';
import { getAppById } from '../appManifest.js';

const maxZInList = (list) =>
  Math.max(100, ...list.map((w) => Number(w.zIndex) || 0));

const nextNormalZ = (list) => maxZInList(list) + 1;

const nextAlwaysOnTopZ = (list) => Math.max(5000, maxZInList(list)) + 1;

const getTopFocusableWindowId = (list) => {
  const top = [...list]
    .filter((w) => !w.minimized)
    .sort((left, right) => (right.zIndex || 0) - (left.zIndex || 0))[0];
  return top ? top.id : null;
};

const withFocusedState = (windowItem, activeWindowId) => {
  const nextFocused = Boolean(activeWindowId) && windowItem.id === activeWindowId;
  return windowItem.focused === nextFocused
    ? windowItem
    : { ...windowItem, focused: nextFocused };
};

const syncFocusedWindows = (list, preferredActiveId = null) => {
  const activeWindowId =
    preferredActiveId && list.some((w) => w.id === preferredActiveId && !w.minimized)
      ? preferredActiveId
      : getTopFocusableWindowId(list);

  return {
    activeWindowId,
    windows: list.map((w) => withFocusedState(w, activeWindowId)),
  };
};

/**
 * Calcula o id estável da janela a partir do manifest (singleton vs record).
 * @param {import('@/lib/appManifest').AppManifestEntry | undefined} app
 * @param {Record<string, unknown>} [appProps]
 * @param {Record<string, unknown>} [context]
 */
export function computeWindowId(app, appProps = {}, context = {}) {
  if (!app?.window) return app?.id ?? null;
  const mode = app.window.mode || 'singleton';
  if (mode === 'singleton') return app.id;
  if (mode === 'record') {
    const keyFn = app.window.key;
    const ctx = { ...context, ...appProps };
    if (typeof keyFn === 'function') {
      try {
        return `${app.id}:${String(keyFn(ctx))}`;
      } catch {
        return app.id;
      }
    }
    if (typeof keyFn === 'string') return `${app.id}:${keyFn}`;
  }
  return app.id;
}

/**
 * @typedef {Object} DesktopShellWindow
 * @property {string} id          — windowId (único; pode ser composto em modo record)
 * @property {string} appId       — chave no appManifest
 * @property {Record<string, unknown>} [appProps]
 * @property {boolean} minimized
 * @property {number} zIndex
 * @property {boolean} focused
 * @property {boolean} [alwaysOnTop]
 * @property {number} [launchToken]
 */

export const useDesktopShellStore = create((set) => ({
  /** @type {DesktopShellWindow[]} */
  windows: [],
  /** @type {string | null} */
  activeWindowId: null,
  /** @type {number} */
  launchCounter: 0,
  /** @type {{ windowId: string, mode: 'left' | 'right' | 'maximized', requestId: number } | null} */
  snapRequest: null,

  /**
   * Abre ou foca uma janela. `context` reserva para deep links / record (ex.: studentId).
  * @param {string} appId
  * @param {Record<string, unknown>} [appProps]
  * @param {Record<string, unknown>} [context]
  */
openWindow: (appId, appProps, context = {}) => {
    const app = getAppById(appId);
    if (!app) return;
    const windowId = computeWindowId(app, appProps || {}, context);
    if (!windowId) return;

    set((state) => {
      const prev = state.windows;
      const existing = prev.find((w) => w.id === windowId);
      const nz = nextNormalZ(prev);
      const nextLaunchToken = (state.launchCounter || 0) + 1;
      if (existing) {
        const z = existing.alwaysOnTop ? nextAlwaysOnTopZ(prev) : nz;
        return {
          launchCounter: nextLaunchToken,
          activeWindowId: windowId,
          windows: prev.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  appId,
                  minimized: false,
                  zIndex: z,
                  focused: true,
                  launchToken: nextLaunchToken,
                  ...(appProps !== undefined ? { appProps } : {}),
                }
              : withFocusedState(w, windowId)
          ),
        };
      }
      return {
        launchCounter: nextLaunchToken,
        activeWindowId: windowId,
        windows: [
          ...prev.map((w) => withFocusedState(w, windowId)),
          {
            id: windowId,
            appId,
            appProps,
            minimized: false,
            zIndex: nz,
            focused: true,
            launchToken: nextLaunchToken,
          },
        ],
      };
    });
  },

  closeWindow: (windowId) => {
    set((state) => {
      if (!state.windows.some((w) => w.id === windowId)) {
        return state;
      }

      const next = state.windows.filter((w) => w.id !== windowId);
      const preferredActiveId =
        state.activeWindowId === windowId ? null : state.activeWindowId;
      return syncFocusedWindows(next, preferredActiveId);
    });
  },

  minimizeWindow: (windowId) => {
    set((state) => {
      const targetWindow = state.windows.find((w) => w.id === windowId);
      if (!targetWindow || targetWindow.minimized) {
        return state;
      }

      const next = state.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              minimized: true,
              focused: false,
            }
          : w
      );
      const preferredActiveId =
        state.activeWindowId === windowId ? null : state.activeWindowId;
      return syncFocusedWindows(next, preferredActiveId);
    });
  },

  focusWindow: (windowId) => {
    set((state) => {
      const prev = state.windows;
      const targetWindow = prev.find((w) => w.id === windowId);
      if (!targetWindow) {
        return state;
      }

      if (state.activeWindowId === windowId && targetWindow.focused && !targetWindow.minimized) {
        return state;
      }

      const nz = nextNormalZ(prev);
      return {
        activeWindowId: windowId,
        windows: prev.map((w) =>
          w.id === windowId
            ? {
                ...w,
                zIndex: w.alwaysOnTop ? nextAlwaysOnTopZ(prev) : nz,
                focused: true,
                minimized: false,
              }
            : withFocusedState(w, windowId)
        ),
      };
    });
  },

  requestWindowSnap: (windowId, mode) => {
    set((state) => {
      const targetWindow = state.windows.find((windowItem) => (
        windowItem.id === windowId && !windowItem.minimized
      ));

      if (!targetWindow) {
        return state;
      }

      return {
        snapRequest: {
          windowId,
          mode,
          requestId: (state.snapRequest?.requestId ?? 0) + 1,
        },
      };
    });
  },

  clearSnapRequest: (requestId = null) => {
    set((state) => {
      if (!state.snapRequest) {
        return state;
      }

      if (requestId !== null && state.snapRequest.requestId !== requestId) {
        return state;
      }

      return {
        snapRequest: null,
      };
    });
  },

  toggleAlwaysOnTop: (windowId) => {
    set((state) => {
      const prev = state.windows;
      if (!prev.some((w) => w.id === windowId)) {
        return state;
      }

      const next = prev.map((w) => {
          if (w.id !== windowId) return w;
          const nextAlwaysOnTop = !w.alwaysOnTop;
          const newZ = nextAlwaysOnTop ? nextAlwaysOnTopZ(prev) : nextNormalZ(prev);
          return {
            ...w,
            alwaysOnTop: nextAlwaysOnTop,
            zIndex: newZ,
            focused: true,
            minimized: false,
          };
        });
      return syncFocusedWindows(next, windowId);
    });
  },

  /** Remove janelas cujo app não é mais permitido ao perfil atual. */
  pruneWindowsNotAllowed: (allowedAppIds) => {
    const allowed =
      allowedAppIds instanceof Set ? allowedAppIds : new Set(allowedAppIds);
    set((state) => {
      const next = state.windows.filter((w) => allowed.has(w.appId));
      const preferredActiveId =
        state.activeWindowId && next.some((w) => w.id === state.activeWindowId)
          ? state.activeWindowId
          : null;
      return syncFocusedWindows(next, preferredActiveId);
    });
  },

  /** Hidrata janelas após carregar workspace remoto (já filtrado por perfil). */
  loadWorkspace: (windows, activeWindowId) => {
    const list = Array.isArray(windows) ? windows : [];
    set({
      ...syncFocusedWindows(list, activeWindowId),
      launchCounter: 0,
      snapRequest: null,
    });
  },

  /** Logout ou troca de usuário — limpa o shell. */
  resetShell: () => set({ windows: [], activeWindowId: null, launchCounter: 0, snapRequest: null }),
}));
