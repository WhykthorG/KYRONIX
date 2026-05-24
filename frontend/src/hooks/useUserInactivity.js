// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { useCallback, useEffect, useRef, useState } from 'react';

export const DEFAULT_IDLE_TIMEOUT_MS = 90_000;

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
const POINTER_ACTIVITY_THROTTLE_MS = 250;

export function useUserInactivity({
  timeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  disabled = false,
} = {}) {
  const [isIdle, setIsIdle] = useState(false);
  const [idleSince, setIdleSince] = useState(null);
  const idleRef = useRef(false);
  const idleTimerRef = useRef(null);
  const lastActivityAtRef = useRef(0);

  const clearIdleTimer = useCallback(() => {
    if (typeof window === 'undefined' || idleTimerRef.current === null) return;

    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const scheduleIdleTimer = useCallback(() => {
    clearIdleTimer();

    if (typeof window === 'undefined' || disabled) return;

    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      if (idleRef.current) return;

      idleRef.current = true;
      setIsIdle(true);
      setIdleSince(Date.now());
    }, timeoutMs);
  }, [clearIdleTimer, disabled, timeoutMs]);

  const markActive = useCallback(() => {
    lastActivityAtRef.current = Date.now();
    scheduleIdleTimer();

    if (!idleRef.current) return;

    idleRef.current = false;
    setIsIdle(false);
    setIdleSince(null);
  }, [scheduleIdleTimer]);

  const markIdle = useCallback(() => {
    clearIdleTimer();
    if (idleRef.current) return;

    idleRef.current = true;
    setIsIdle(true);
    setIdleSince(Date.now());
  }, [clearIdleTimer]);

  useEffect(() => {
    if (disabled) {
      clearIdleTimer();
      idleRef.current = false;
      setIsIdle(false);
      setIdleSince(null);
      return undefined;
    }

    const handleActivity = (event) => {
      const now = Date.now();

      if (
        event.type === 'pointermove'
        && !idleRef.current
        && now - lastActivityAtRef.current < POINTER_ACTIVITY_THROTTLE_MS
      ) {
        return;
      }

      markActive();
    };

    scheduleIdleTimer();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, true);
    });

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity, true);
      });
      clearIdleTimer();
    };
  }, [clearIdleTimer, disabled, markActive, scheduleIdleTimer]);

  return {
    isIdle,
    idleSince,
    markActive,
    markIdle,
  };
}
