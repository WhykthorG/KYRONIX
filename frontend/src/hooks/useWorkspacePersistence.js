// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import {
  fetchWorkspaceState,
  upsertWorkspaceState,
  readLegacyLocalWorkspace,
  filterWorkspaceForProfile,
  normalizeWindowsForShell,
  serializeWindowsForStorage,
} from '@/lib/workspaceStateClient';

const WORKSPACE_PERSIST_DEBOUNCE_MS = 1_000;

export function useWorkspacePersistence({
  userId,
  isMobile,
  profileType,
  apps,
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
}) {
  const [hydrationDone, setHydrationDone] = useState(false);
  const workspacePersistTimeoutRef = useRef(null);
  const workspacePersistIdleRef = useRef(null);
  const lastPersistedWorkspaceRef = useRef(null);

  const persistedWindows = useMemo(() => serializeWindowsForStorage(windows), [windows]);
  const workspacePersistencePayload = useMemo(() => ({
    desktopShortcuts: desktopAppsIds,
    taskbarPins: pinnedAppsIds,
    iconPositions,
    windows: persistedWindows,
    activeWindowId,
  }), [activeWindowId, desktopAppsIds, iconPositions, persistedWindows, pinnedAppsIds]);

  const markWorkspaceAsPersisted = useCallback((payload) => {
    lastPersistedWorkspaceRef.current = JSON.stringify(payload);
  }, []);

  useEffect(() => {
    setHydrationDone(false);
  }, [userId]);

  useEffect(() => {
    if (userId) return;
    resetShell();
  }, [resetShell, userId]);

  const { data: remoteWorkspace, isFetched: workspaceFetched } = useQuery({
    queryKey: ['workspace-state', userId],
    queryFn: async () => {
      try {
        return await fetchWorkspaceState(userId);
      } catch (error) {
        console.warn(
          '[workspace-state] Falha ao carregar (aplique migration_workspace_state.sql no Supabase se necessário).',
          error
        );
        return null;
      }
    },
    enabled: Boolean(userId && !isMobile),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (
      !userId
      || isMobile
      || !profileType
      || !workspaceFetched
      || hydrationDone
      || apps.length === 0
    ) {
      return;
    }

    let cancelled = false;

    (async () => {
      let state = remoteWorkspace;
      if (!state) {
        const legacy = readLegacyLocalWorkspace();
        if (legacy) {
          state = filterWorkspaceForProfile(legacy, allowedAppIds);
          try {
            await upsertWorkspaceState(userId, state);
          } catch {
            /* migração best-effort */
          }
        }
      }

      if (cancelled) return;

      if (state) {
        const filtered = filterWorkspaceForProfile(state, allowedAppIds);
        const hydratedDesktopShortcuts =
          filtered.desktopShortcuts.length > 0 ? filtered.desktopShortcuts : apps.map((app) => app.id);
        const hydratedWindows = normalizeWindowsForShell(filtered.windows);

        setDesktopAppsIds(hydratedDesktopShortcuts);
        setPinnedAppsIds(filtered.taskbarPins);
        setIconPositions(filtered.iconPositions);
        loadWorkspace(hydratedWindows, filtered.activeWindowId);
        markWorkspaceAsPersisted({
          desktopShortcuts: hydratedDesktopShortcuts,
          taskbarPins: filtered.taskbarPins,
          iconPositions: filtered.iconPositions,
          windows: serializeWindowsForStorage(hydratedWindows),
          activeWindowId: filtered.activeWindowId,
        });
      } else {
        const nextDesktopShortcuts = apps.map((app) => app.id);
        setDesktopAppsIds(nextDesktopShortcuts);
        setPinnedAppsIds([]);
        setIconPositions({});
        loadWorkspace([], null);
        markWorkspaceAsPersisted({
          desktopShortcuts: nextDesktopShortcuts,
          taskbarPins: [],
          iconPositions: {},
          windows: [],
          activeWindowId: null,
        });
      }

      setHydrationDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    allowedAppIds,
    apps,
    hydrationDone,
    isMobile,
    loadWorkspace,
    markWorkspaceAsPersisted,
    profileType,
    remoteWorkspace,
    setDesktopAppsIds,
    setIconPositions,
    setPinnedAppsIds,
    userId,
    workspaceFetched,
  ]);

  useEffect(() => {
    if (!hydrationDone || desktopAppsIds.length > 0 || apps.length === 0) return;
    setDesktopAppsIds(apps.map((app) => app.id));
  }, [apps, desktopAppsIds.length, hydrationDone, setDesktopAppsIds]);

  useEffect(() => {
    if (!profileType || !hydrationDone) return;
    setDesktopAppsIds((prev) => prev.filter((id) => allowedAppIds.has(id)));
    setPinnedAppsIds((prev) => prev.filter((id) => allowedAppIds.has(id)));
    pruneWindowsNotAllowed(allowedAppIds);
  }, [allowedAppIds, hydrationDone, profileType, pruneWindowsNotAllowed, setDesktopAppsIds, setPinnedAppsIds]);

  useEffect(() => {
    if (!userId || isMobile || !hydrationDone) return undefined;

    const workspacePersistenceSignature = JSON.stringify(workspacePersistencePayload);
    if (lastPersistedWorkspaceRef.current === workspacePersistenceSignature) return undefined;

    if (workspacePersistTimeoutRef.current) {
      clearTimeout(workspacePersistTimeoutRef.current);
    }

    if (workspacePersistIdleRef.current && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(workspacePersistIdleRef.current);
      workspacePersistIdleRef.current = null;
    }

    workspacePersistTimeoutRef.current = setTimeout(() => {
      const persistWorkspace = () => {
        upsertWorkspaceState(userId, workspacePersistencePayload)
          .then(() => {
            lastPersistedWorkspaceRef.current = workspacePersistenceSignature;
          })
          .catch(() => {});
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        workspacePersistIdleRef.current = window.requestIdleCallback(() => {
          workspacePersistIdleRef.current = null;
          persistWorkspace();
        }, { timeout: 700 });
        return;
      }

      persistWorkspace();
    }, WORKSPACE_PERSIST_DEBOUNCE_MS);

    return () => {
      if (workspacePersistTimeoutRef.current) {
        clearTimeout(workspacePersistTimeoutRef.current);
        workspacePersistTimeoutRef.current = null;
      }

      if (workspacePersistIdleRef.current && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(workspacePersistIdleRef.current);
        workspacePersistIdleRef.current = null;
      }
    };
  }, [hydrationDone, isMobile, userId, workspacePersistencePayload]);

  return {
    hydrationDone,
  };
}
