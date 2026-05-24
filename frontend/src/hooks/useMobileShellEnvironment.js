// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import { useEffect, useState } from 'react';

export function useMobileShellEnvironment() {
  const [now, setNow] = useState(() => new Date());
  const [systemDarkMode, setSystemDarkMode] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  ));
  const [browserOnline, setBrowserOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateScheme = (event) => setSystemDarkMode(event.matches);
    setSystemDarkMode(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateScheme);
      return () => mediaQuery.removeEventListener('change', updateScheme);
    }

    mediaQuery.addListener(updateScheme);
    return () => mediaQuery.removeListener(updateScheme);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    now,
    systemDarkMode,
    browserOnline,
  };
}
