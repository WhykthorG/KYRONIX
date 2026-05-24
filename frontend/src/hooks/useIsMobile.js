import { useState, useEffect } from 'react';

/**
 * useIsMobile — Detects if the viewport is below a mobile breakpoint.
 * Uses matchMedia for event-driven updates (no resize polling).
 *
 * @param {number} breakpoint - Width threshold in pixels (default: 768)
 * @returns {boolean} true if viewport width < breakpoint
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches); // sync on mount
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
