import { useEffect, useState } from 'react';

export function useNow({ enabled = true, intervalMs = 1000 } = {}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return undefined;

    setNow(new Date());
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [enabled, intervalMs]);

  return now;
}
