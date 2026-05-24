import { getAccessTokenOrThrow } from '@/lib/supabase';
import {
  buildFrontendRoute,
  createObservabilityTraceId,
  OBSERVABILITY_EVENT_TYPES,
} from '@shared/contracts/observability';
import {
  isApiBaseUnavailable,
  isApiRouteMissing,
  markApiBaseUnavailable,
} from '@/lib/apiAvailability';

const DEFAULT_OBSERVABILITY_API_BASE = '/api/observability';
const OBSERVABILITY_API_BASE =
  import.meta.env.VITE_OBSERVABILITY_API_BASE_URL || DEFAULT_OBSERVABILITY_API_BASE;

const OBSERVABILITY_REPORTED_FLAG = '__wgObservabilityReported';

async function getAccessToken() {
  try {
    return await getAccessTokenOrThrow('Sessao expirada. Entre novamente para continuar.');
  } catch {
    return null;
  }
}

export function markObservabilityReported(value, traceId = createObservabilityTraceId()) {
  if (value && typeof value === 'object') {
    try {
      Object.defineProperty(value, OBSERVABILITY_REPORTED_FLAG, {
        value: traceId,
        configurable: true,
      });
    } catch {
      value[OBSERVABILITY_REPORTED_FLAG] = traceId;
    }
  }

  return traceId;
}

export function wasObservabilityReported(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value[OBSERVABILITY_REPORTED_FLAG] || null;
}

export async function logObservabilityEvent({
  eventType,
  message,
  route = null,
  metadata = {},
  traceId = createObservabilityTraceId(),
  accessToken = null,
}) {
  if (import.meta.env.DEV || isApiBaseUnavailable(OBSERVABILITY_API_BASE)) {
    return {
      skipped: true,
      traceId,
      reason: import.meta.env.DEV ? 'DEVELOPMENT_MODE' : 'API_UNAVAILABLE',
    };
  }

  const token = accessToken || await getAccessToken();

  if (!token) {
    return {
      skipped: true,
      traceId,
      reason: 'AUTH_SESSION_MISSING',
    };
  }

  const response = await fetch(`${OBSERVABILITY_API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      eventType,
      message,
      route,
      traceId,
      metadata,
    }),
  });

  if (isApiRouteMissing(response)) {
    markApiBaseUnavailable(OBSERVABILITY_API_BASE);
    return {
      skipped: true,
      traceId,
      reason: 'API_UNAVAILABLE',
    };
  }

  if (!response.ok) {
    const raw = await response.text();
    let payload = null;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    const error = new Error(
      payload?.error || 'Falha ao registrar evento de observabilidade.'
    );
    error.code = payload?.code || 'OBSERVABILITY_REQUEST_FAILED';
    error.traceId = payload?.traceId || traceId;
    throw error;
  }

  return response.json();
}

export async function reportFrontendError({
  eventType = OBSERVABILITY_EVENT_TYPES.FRONTEND_RUNTIME_ERROR,
  source,
  error,
  route = null,
  metadata = {},
  traceId = null,
}) {
  const normalizedError =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Erro inesperado no frontend.');
  const resolvedTraceId = traceId || wasObservabilityReported(normalizedError) || markObservabilityReported(normalizedError);

  return logObservabilityEvent({
    eventType,
    message: normalizedError.message,
    route: route || buildFrontendRoute(window.location?.pathname, window.location?.search),
    traceId: typeof resolvedTraceId === 'string' ? resolvedTraceId : createObservabilityTraceId(),
    metadata: {
      source,
      name: normalizedError.name,
      stack: normalizedError.stack,
      ...metadata,
    },
  });
}

export async function reportFrontendNavigation({
  route,
  metadata = {},
  traceId = createObservabilityTraceId(),
}) {
  return logObservabilityEvent({
    eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_NAVIGATION,
    message: `Navegacao registrada para ${route}`,
    route,
    traceId,
    metadata,
  });
}

export async function reportFrontendCallIssue({
  eventType = OBSERVABILITY_EVENT_TYPES.FRONTEND_CALL_FAILURE,
  message,
  route = null,
  metadata = {},
  traceId = createObservabilityTraceId(),
}) {
  return logObservabilityEvent({
    eventType,
    message,
    route: route || buildFrontendRoute(window.location?.pathname, window.location?.search),
    traceId,
    metadata,
  });
}
