// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import React, { Profiler, useCallback } from 'react';

const DEFAULT_MIN_DURATION_MS = 8;
const MAX_STORED_ENTRIES = 200;

function isProfilerEnabled() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false;
  }

  return window.localStorage?.getItem('debug:render-profiler') === '1';
}

function getProfilerStore() {
  if (typeof window === 'undefined') {
    return null;
  }

  const globalWindow = window;
  if (!Array.isArray(globalWindow.__PROJECT_WG_RENDER_PROFILER__)) {
    globalWindow.__PROJECT_WG_RENDER_PROFILER__ = [];
  }

  return globalWindow.__PROJECT_WG_RENDER_PROFILER__;
}

export default function RenderProfiler({
  id,
  children,
  minDuration = DEFAULT_MIN_DURATION_MS,
}) {
  const handleRender = useCallback((profileId, phase, actualDuration, baseDuration, startTime, commitTime) => {
    if (!isProfilerEnabled() || actualDuration < minDuration) {
      return;
    }

    const entry = {
      id: profileId,
      phase,
      actualDuration: Number(actualDuration.toFixed(2)),
      baseDuration: Number(baseDuration.toFixed(2)),
      startTime: Number(startTime.toFixed(2)),
      commitTime: Number(commitTime.toFixed(2)),
      capturedAt: new Date().toISOString(),
    };

    const store = getProfilerStore();
    if (store) {
      store.push(entry);
      if (store.length > MAX_STORED_ENTRIES) {
        store.splice(0, store.length - MAX_STORED_ENTRIES);
      }
    }

    // Intentionally compact: enough to compare baseline and reprofile in dev.
    console.info(
      `[render-profiler] ${profileId} ${phase} ${entry.actualDuration}ms (base ${entry.baseDuration}ms)`
    );
  }, [minDuration]);

  if (!isProfilerEnabled()) {
    return children;
  }

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
}
