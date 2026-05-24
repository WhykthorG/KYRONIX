// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import { useCallback, useEffect, useState } from 'react';

import { UserProfileApi } from '@/services/supabaseApi';
import {
  DEFAULT_SHELL_BACKGROUND_ASSET_ID,
  DEFAULT_SHELL_BACKGROUND_MODE,
  getShellBackgroundDefaultAssetId,
  getShellBackgroundMatchingAssetId,
  getShellBackgroundOption,
  normalizeShellBackgroundMode,
} from '@/lib/shellBackground';

export const USER_SHELL_BACKGROUND_STORAGE_PREFIX = 'project-wg:user-shell-background';
export const USER_SHELL_BACKGROUND_UPDATED_EVENT = 'project-wg:user-shell-background-updated';
const USER_PROFILE_BACKGROUND_FIELDS = {
  mode: 'shell_background_mode',
  assetId: 'shell_background_asset_id',
};

function normalizeProfileKey(profileKey) {
  return String(profileKey ?? '')
    .trim()
    .toLowerCase() || 'guest';
}

function normalizePreference(preference = {}) {
  const backgroundMode = normalizeShellBackgroundMode(
    preference.backgroundMode ?? preference.shellBackgroundMode ?? DEFAULT_SHELL_BACKGROUND_MODE,
  );
  const backgroundAssetId = getShellBackgroundOption(
    backgroundMode,
    preference.backgroundAssetId ?? preference.shellBackgroundAssetId,
  )?.id || getShellBackgroundDefaultAssetId(backgroundMode) || DEFAULT_SHELL_BACKGROUND_ASSET_ID;

  return {
    backgroundMode,
    backgroundAssetId,
  };
}

function normalizeSelection(backgroundMode, backgroundAssetId) {
  const resolvedMode = normalizeShellBackgroundMode(backgroundMode);
  const resolvedAssetId = getShellBackgroundMatchingAssetId(resolvedMode, backgroundAssetId);

  return normalizePreference({
    backgroundMode: resolvedMode,
    backgroundAssetId: resolvedAssetId,
  });
}

function isEmailLike(value) {
  return typeof value === 'string' && value.includes('@');
}

async function fetchProfilePreference(profileKey) {
  if (!profileKey) return null;

  if (isEmailLike(profileKey)) {
    const rows = await UserProfileApi.filter({ user_email: String(profileKey).trim().toLowerCase() }, 'created_at', 1);
    return rows?.[0] || null;
  }

  return UserProfileApi.get(profileKey);
}

async function syncPreferenceToProfile(profileKey, preference) {
  if (!profileKey) return null;

  const payload = {
    [USER_PROFILE_BACKGROUND_FIELDS.mode]: preference.backgroundMode,
    [USER_PROFILE_BACKGROUND_FIELDS.assetId]: preference.backgroundAssetId,
  };

  if (isEmailLike(profileKey)) {
    const rows = await UserProfileApi.filter({ user_email: String(profileKey).trim().toLowerCase() }, 'created_at', 1);
    const profile = rows?.[0] || null;
    if (!profile?.id) return null;
    return UserProfileApi.update(profile.id, payload);
  }

  return UserProfileApi.update(profileKey, payload);
}

export function getUserShellBackgroundStorageKey(profileKey) {
  return `${USER_SHELL_BACKGROUND_STORAGE_PREFIX}:${normalizeProfileKey(profileKey)}`;
}

export function readUserShellBackgroundPreference(profileKey, storage = globalThis?.localStorage) {
  if (!storage?.getItem) return normalizePreference();

  try {
    const raw = storage.getItem(getUserShellBackgroundStorageKey(profileKey));
    if (!raw) return normalizePreference();
    return normalizePreference(JSON.parse(raw));
  } catch {
    return normalizePreference();
  }
}

function dispatchBackgroundPreferenceUpdate(profileKey, preference) {
  if (!globalThis?.dispatchEvent || typeof globalThis.CustomEvent !== 'function') return;

  globalThis.dispatchEvent(
    new globalThis.CustomEvent(USER_SHELL_BACKGROUND_UPDATED_EVENT, {
      detail: {
        profileKey: normalizeProfileKey(profileKey),
        preference,
      },
    }),
  );
}

export function writeUserShellBackgroundPreference(profileKey, preference, storage = globalThis?.localStorage) {
  const normalizedProfileKey = normalizeProfileKey(profileKey);
  const normalizedPreference = normalizePreference(preference);
  const storageKey = getUserShellBackgroundStorageKey(normalizedProfileKey);

  if (!storage?.setItem) {
    dispatchBackgroundPreferenceUpdate(normalizedProfileKey, normalizedPreference);
    return normalizedPreference;
  }

  storage.setItem(storageKey, JSON.stringify(normalizedPreference));
  dispatchBackgroundPreferenceUpdate(normalizedProfileKey, normalizedPreference);
  return normalizedPreference;
}

export function writeUserShellBackgroundSelection(profileKey, backgroundMode, backgroundAssetId, storage = globalThis?.localStorage) {
  const normalizedProfileKey = normalizeProfileKey(profileKey);
  const normalizedPreference = normalizeSelection(backgroundMode, backgroundAssetId);
  const storageKey = getUserShellBackgroundStorageKey(normalizedProfileKey);

  if (!storage?.setItem) {
    dispatchBackgroundPreferenceUpdate(normalizedProfileKey, normalizedPreference);
    return normalizedPreference;
  }

  storage.setItem(storageKey, JSON.stringify(normalizedPreference));
  dispatchBackgroundPreferenceUpdate(normalizedProfileKey, normalizedPreference);
  return normalizedPreference;
}

export function useUserShellBackgroundPreference(profileKey) {
  const normalizedProfileKey = normalizeProfileKey(profileKey);
  const [preference, setPreference] = useState(() => (
    readUserShellBackgroundPreference(normalizedProfileKey)
  ));

  useEffect(() => {
    let active = true;

    const loadPreference = async () => {
      setPreference(readUserShellBackgroundPreference(normalizedProfileKey));

      try {
        const profile = await fetchProfilePreference(normalizedProfileKey);
        if (!active || !profile) return;

        const nextPreference = normalizePreference({
          backgroundMode: profile?.shell_background_mode,
          backgroundAssetId: profile?.shell_background_asset_id,
        });

        const localPreference = writeUserShellBackgroundPreference(
          normalizedProfileKey,
          nextPreference,
        );

        if (active) {
          setPreference(localPreference);
        }
      } catch {
        if (active) {
          setPreference(readUserShellBackgroundPreference(normalizedProfileKey));
        }
      }
    };

    void loadPreference();

    return () => {
      active = false;
    };
  }, [normalizedProfileKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const storageKey = getUserShellBackgroundStorageKey(normalizedProfileKey);

    const handleStorage = (event) => {
      if (event.key !== storageKey) return;
      setPreference(readUserShellBackgroundPreference(normalizedProfileKey));
    };

    const handleCustomUpdate = (event) => {
      if (event?.detail?.profileKey !== normalizedProfileKey) return;
      setPreference(normalizePreference(event.detail.preference));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(USER_SHELL_BACKGROUND_UPDATED_EVENT, handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(USER_SHELL_BACKGROUND_UPDATED_EVENT, handleCustomUpdate);
    };
  }, [normalizedProfileKey]);

  const setBackgroundSelection = useCallback((backgroundMode, backgroundAssetId) => {
    const nextPreference = writeUserShellBackgroundSelection(
      normalizedProfileKey,
      backgroundMode,
      backgroundAssetId,
    );
    setPreference(nextPreference);
    void syncPreferenceToProfile(normalizedProfileKey, nextPreference).catch(() => {});
    return nextPreference;
  }, [normalizedProfileKey]);

  const setBackgroundMode = useCallback((backgroundMode) => {
    const nextPreference = setBackgroundSelection(
      backgroundMode,
      preference.backgroundAssetId,
    );
    return nextPreference;
  }, [preference.backgroundAssetId, setBackgroundSelection]);

  const setBackgroundAssetId = useCallback((backgroundAssetId) => {
    const nextPreference = setBackgroundSelection(
      preference.backgroundMode,
      backgroundAssetId,
    );
    return nextPreference;
  }, [preference.backgroundMode, setBackgroundSelection]);

  return {
    backgroundMode: preference.backgroundMode,
    backgroundAssetId: preference.backgroundAssetId,
    setBackgroundMode,
    setBackgroundAssetId,
    setBackgroundSelection,
  };
}
