import { useEffect, useRef } from 'react';

export function useGlobalSearchNavigation({
  entityKey,
  globalSearch,
  isReady = true,
  onNavigate,
}) {
  const handledTokenRef = useRef(null);

  useEffect(() => {
    if (!isReady || !globalSearch || globalSearch.entityKey !== entityKey) {
      return;
    }

    if (!globalSearch.token || handledTokenRef.current === globalSearch.token) {
      return;
    }

    onNavigate?.(globalSearch);
    handledTokenRef.current = globalSearch.token;
  }, [entityKey, globalSearch, isReady, onNavigate]);
}
