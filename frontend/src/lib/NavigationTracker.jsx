import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { buildFrontendRoute } from '@shared/contracts/observability';
import { reportFrontendNavigation } from '@/lib/observabilityClient';

export default function NavigationTracker() {
  const location = useLocation();
  const previousRouteRef = useRef(null);
  const hasCapturedInitialLoadRef = useRef(false);

  useEffect(() => {
    const route = buildFrontendRoute(location.pathname, location.search);
    if (!route) {
      return;
    }

    const previousRoute = previousRouteRef.current;
    const metadata = {
      kind: previousRoute ? 'route_change' : 'page_load',
      from: previousRoute,
      to: route,
    };

    if (!hasCapturedInitialLoadRef.current && typeof performance !== 'undefined') {
      const navigationEntry = performance.getEntriesByType?.('navigation')?.[0];
      if (navigationEntry) {
        metadata.duration_ms = Math.round(navigationEntry.duration || 0);
        metadata.dom_content_loaded_ms = Math.round(
          navigationEntry.domContentLoadedEventEnd || 0,
        );
        metadata.redirect_count = navigationEntry.redirectCount || 0;
      }
      hasCapturedInitialLoadRef.current = true;
    }

    previousRouteRef.current = route;

    reportFrontendNavigation({
      route,
      metadata,
    }).catch((error) => {
      console.warn('[observability] Falha ao registrar navegacao.', error);
    });
  }, [location.pathname, location.search]);

  return null;
}
