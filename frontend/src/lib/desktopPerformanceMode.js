import { useCallback, useEffect, useState } from 'react';

export const DESKTOP_PERFORMANCE_MODE_STORAGE_KEY = 'project-wg:desktop-performance-mode';
export const DESKTOP_PERFORMANCE_MODE_UPDATED_EVENT = 'project-wg:desktop-performance-mode-updated';
export const DEFAULT_DESKTOP_PERFORMANCE_MODE = 'standard';

function normalizeMode(mode) {
  return mode === 'light' ? 'light' : 'standard';
}

export function readDesktopPerformanceMode(storage = globalThis?.localStorage) {
  if (!storage?.getItem) return DEFAULT_DESKTOP_PERFORMANCE_MODE;

  try {
    return normalizeMode(storage.getItem(DESKTOP_PERFORMANCE_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_DESKTOP_PERFORMANCE_MODE;
  }
}

function dispatchModeUpdate(mode) {
  if (!globalThis?.dispatchEvent || typeof globalThis.CustomEvent !== 'function') return;

  globalThis.dispatchEvent(
    new globalThis.CustomEvent(DESKTOP_PERFORMANCE_MODE_UPDATED_EVENT, {
      detail: { mode: normalizeMode(mode) },
    }),
  );
}

export function writeDesktopPerformanceMode(mode, storage = globalThis?.localStorage) {
  const normalizedMode = normalizeMode(mode);

  if (!storage?.setItem) {
    dispatchModeUpdate(normalizedMode);
    return normalizedMode;
  }

  storage.setItem(DESKTOP_PERFORMANCE_MODE_STORAGE_KEY, normalizedMode);
  dispatchModeUpdate(normalizedMode);
  return normalizedMode;
}

export function useDesktopPerformanceMode() {
  const [mode, setMode] = useState(() => readDesktopPerformanceMode());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (event) => {
      if (event.key !== DESKTOP_PERFORMANCE_MODE_STORAGE_KEY) return;
      setMode(readDesktopPerformanceMode());
    };

    const handleCustomUpdate = (event) => {
      setMode(normalizeMode(event?.detail?.mode));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(DESKTOP_PERFORMANCE_MODE_UPDATED_EVENT, handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(DESKTOP_PERFORMANCE_MODE_UPDATED_EVENT, handleCustomUpdate);
    };
  }, []);

  const setDesktopPerformanceMode = useCallback((nextMode) => {
    const normalizedMode = writeDesktopPerformanceMode(nextMode);
    setMode(normalizedMode);
    return normalizedMode;
  }, []);

  const toggleDesktopPerformanceMode = useCallback(() => {
    const nextMode = mode === 'light' ? 'standard' : 'light';
    return setDesktopPerformanceMode(nextMode);
  }, [mode, setDesktopPerformanceMode]);

  return {
    desktopPerformanceMode: mode,
    isLightMode: mode === 'light',
    setDesktopPerformanceMode,
    toggleDesktopPerformanceMode,
  };
}
