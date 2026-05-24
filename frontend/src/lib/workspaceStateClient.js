/**
 * Persistência da área de trabalho (Supabase) — um JSON por usuário.
 */

import { supabase } from '@/lib/supabase';

export const WORKSPACE_STATE_VERSION = 1;
const workspaceStateRowKnownToExist = new Set();
const workspaceStatePersistInFlight = new Map();

/**
 * @typedef {Object} WorkspaceStateV1
 * @property {number} [v]
 * @property {string[]} [desktopShortcuts]
 * @property {string[]} [taskbarPins]
 * @property {Record<string, { col: number, row: number } | { x: number, y: number }>} [iconPositions]
 * @property {Array<{ id: string, appId: string, appProps?: object, minimized?: boolean, zIndex?: number, focused?: boolean, alwaysOnTop?: boolean }>} [windows]
 * @property {string | null} [activeWindowId]
 */

/**
 * Lê o estado remoto. Retorna null se não existir linha.
 * @param {string} userId
 * @returns {Promise<WorkspaceStateV1 | null>}
 */
export async function fetchWorkspaceState(userId) {
  const { data, error } = await supabase
    .from('user_workspace_state')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  const raw = data?.state;
  if (data?.state) {
    workspaceStateRowKnownToExist.add(userId);
  }
  if (!raw || typeof raw !== 'object') return null;
  return normalizeWorkspaceState(raw);
}

/**
 * @param {string} userId
 * @param {WorkspaceStateV1} state
 */
export async function upsertWorkspaceState(userId, state) {
  const existingInFlight = workspaceStatePersistInFlight.get(userId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const persistPromise = (async () => {
  const payload = {
    ...state,
    v: WORKSPACE_STATE_VERSION,
  };
  const row = {
    user_id: userId,
    state: payload,
    updated_at: new Date().toISOString(),
  };

  if (workspaceStateRowKnownToExist.has(userId)) {
    const { error: knownUpdateError } = await supabase
      .from('user_workspace_state')
      .update({
        state: payload,
        updated_at: row.updated_at,
      })
      .eq('user_id', userId);

    if (!knownUpdateError) {
      return;
    }
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('user_workspace_state')
    .update({
      state: payload,
      updated_at: row.updated_at,
    })
    .eq('user_id', userId)
    .select('user_id');

  if (updateError) throw updateError;

  if (Array.isArray(updatedRows) && updatedRows.length > 0) {
    workspaceStateRowKnownToExist.add(userId);
    return;
  }

  const { error: insertError } = await supabase
    .from('user_workspace_state')
    .insert(row);

  if (!insertError) {
    workspaceStateRowKnownToExist.add(userId);
    return;
  }

  const isConflict =
    insertError.code === '23505'
    || insertError.code === '409'
    || /conflict|duplicate/i.test(insertError.message || '');

  if (!isConflict) throw insertError;

  const { error: updateAfterConflictError } = await supabase
    .from('user_workspace_state')
    .update({
      state: payload,
      updated_at: row.updated_at,
    })
    .eq('user_id', userId);

  if (updateAfterConflictError) throw updateAfterConflictError;
  workspaceStateRowKnownToExist.add(userId);
  })();

  workspaceStatePersistInFlight.set(userId, persistPromise);

  try {
    return await persistPromise;
  } finally {
    workspaceStatePersistInFlight.delete(userId);
  }
}

function normalizeWorkspaceState(raw) {
  return {
    v: typeof raw.v === 'number' ? raw.v : WORKSPACE_STATE_VERSION,
    desktopShortcuts: Array.isArray(raw.desktopShortcuts) ? raw.desktopShortcuts : [],
    taskbarPins: Array.isArray(raw.taskbarPins) ? raw.taskbarPins : [],
    iconPositions:
      raw.iconPositions && typeof raw.iconPositions === 'object' ? raw.iconPositions : {},
    windows: Array.isArray(raw.windows) ? raw.windows : [],
    activeWindowId:
      raw.activeWindowId === null || typeof raw.activeWindowId === 'string'
        ? raw.activeWindowId
        : null,
  };
}

/**
 * Migração one-shot do localStorage legado (mesmas chaves que o Desktop usava).
 * @returns {WorkspaceStateV1 | null}
 */
export function readLegacyLocalWorkspace() {
  try {
    const shortcuts = localStorage.getItem('edu_desktop_shortcuts_v1');
    const pins = localStorage.getItem('edu_taskbar_pinned_v1');
    const positions = localStorage.getItem('desktop_icon_positions_v4');
    if (shortcuts === null && pins === null && positions === null) return null;
    return normalizeWorkspaceState({
      desktopShortcuts: shortcuts ? JSON.parse(shortcuts) : [],
      taskbarPins: pins ? JSON.parse(pins) : [],
      iconPositions: positions ? JSON.parse(positions) : {},
      windows: [],
      activeWindowId: null,
    });
  } catch {
    return null;
  }
}

/**
 * Filtra estado pelo perfil atual (apps permitidos).
 * @param {WorkspaceStateV1} state
 * @param {Set<string>} allowedAppIds
 * @returns {WorkspaceStateV1}
 */
/**
 * Sanitiza janelas vindas do JSON para a store do shell.
 * @param {unknown} raw
 * @returns {Array<{ id: string, appId: string, appProps?: object, minimized: boolean, zIndex: number, focused: boolean, alwaysOnTop: boolean }>}
 */
export function normalizeWindowsForShell(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((w) => {
      if (!w || typeof w !== 'object' || !w.id) return null;
      const appId = w.appId || String(w.id).split(':')[0];
      let appProps = w.appProps;
      if (appProps && typeof appProps === 'object') {
        try {
          appProps = JSON.parse(JSON.stringify(appProps));
        } catch {
          appProps = undefined;
        }
      } else {
        appProps = undefined;
      }
      return {
        id: String(w.id),
        appId: String(appId),
        ...(appProps !== undefined ? { appProps } : {}),
        minimized: !!w.minimized,
        zIndex: Number(w.zIndex) || 100,
        focused: !!w.focused,
        alwaysOnTop: !!w.alwaysOnTop,
      };
    })
    .filter(Boolean);
}

/** Para persistência — mesmo formato serializável. */
export function serializeWindowsForStorage(windows) {
  return normalizeWindowsForShell(windows);
}

export function filterWorkspaceForProfile(state, allowedAppIds) {
  const allowed = allowedAppIds instanceof Set ? allowedAppIds : new Set(allowedAppIds);
  const windows = normalizeWindowsForShell(state.windows).filter((w) => allowed.has(w.appId));
  const ids = new Set(windows.map((w) => w.id));
  let activeWindowId =
    state.activeWindowId && ids.has(state.activeWindowId)
      ? state.activeWindowId
      : null;
  if (!activeWindowId && windows.length > 0) {
    const top = [...windows].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0];
    activeWindowId = top ? top.id : null;
  }
  return {
    v: WORKSPACE_STATE_VERSION,
    desktopShortcuts: (state.desktopShortcuts || []).filter((id) => allowed.has(id)),
    taskbarPins: (state.taskbarPins || []).filter((id) => allowed.has(id)),
    iconPositions: Object.fromEntries(
      Object.entries(state.iconPositions || {}).filter(([k]) => allowed.has(k))
    ),
    windows,
    activeWindowId,
  };
}
