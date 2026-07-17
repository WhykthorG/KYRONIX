// ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
import { useEffect } from 'react';
import { OBSERVABILITY_EVENT_TYPES } from '@shared/contracts/observability';
import {
  markObservabilityReported,
  reportFrontendError,
  wasObservabilityReported,
} from '@/services/observabilityClient';

function normalizeRejectionReason(reason) {
  if (reason instanceof Error) {
    return reason;
  }

  if (typeof reason === 'string' && reason.trim()) {
    return new Error(reason);
  }

  return new Error('Promise rejeitada sem tratamento.');
}

export default function ClientRuntimeObservability() {
  useEffect(() => {
    const handleWindowError = (event) => {
      const runtimeError =
        event.error instanceof Error
          ? event.error
          : new Error(event.message || 'Erro inesperado no navegador.');

      if (wasObservabilityReported(runtimeError)) {
        return;
      }

      const traceId = markObservabilityReported(runtimeError);
      reportFrontendError({
        eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_RUNTIME_ERROR,
        source: 'window.error',
        error: runtimeError,
        traceId,
        metadata: {
          filename: event.filename || null,
          lineno: event.lineno || null,
          colno: event.colno || null,
        },
      }).catch((reportError) => {
        console.warn('[observability] Falha ao registrar erro global do navegador.', reportError);
      });
    };

    const handleUnhandledRejection = (event) => {
      if (wasObservabilityReported(event.reason)) {
        return;
      }

      const runtimeError = normalizeRejectionReason(event.reason);
      const traceId = markObservabilityReported(event.reason || runtimeError);

      reportFrontendError({
        eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_RUNTIME_ERROR,
        source: 'window.unhandledrejection',
        error: runtimeError,
        traceId,
        metadata: {
          rejection: true,
          reason:
            typeof event.reason === 'string'
              ? event.reason
              : event.reason?.message || null,
        },
      }).catch((reportError) => {
        console.warn('[observability] Falha ao registrar promise rejeitada.', reportError);
      });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
