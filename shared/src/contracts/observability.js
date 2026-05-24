// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
export const OBSERVABILITY_TABLE_NAME = 'observability_logs';

export const OBSERVABILITY_CHANNELS = Object.freeze({
  FRONTEND: 'frontend',
  BACKEND: 'backend',
});

export const OBSERVABILITY_LEVELS = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
});

export const OBSERVABILITY_EVENT_TYPES = Object.freeze({
  FRONTEND_RENDER_ERROR: 'frontend_render_error',
  FRONTEND_RUNTIME_ERROR: 'frontend_runtime_error',
  FRONTEND_NAVIGATION: 'frontend_navigation',
  FRONTEND_CALL_FAILURE: 'frontend_call_failure',
  FRONTEND_CALL_STUCK: 'frontend_call_stuck',
  BACKEND_API_ERROR: 'backend_api_error',
  BACKEND_CALL_STATE: 'backend_call_state',
});

const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'apikey',
  'service_role_key',
  'cookie',
]);

const CLIENT_EVENT_DEFINITIONS = Object.freeze({
  [OBSERVABILITY_EVENT_TYPES.FRONTEND_RENDER_ERROR]: Object.freeze({
    channel: OBSERVABILITY_CHANNELS.FRONTEND,
    level: OBSERVABILITY_LEVELS.ERROR,
    operation: 'ui.render',
    source: 'ErrorBoundary.componentDidCatch',
    clientWritable: true,
    requiresAuth: true,
  }),
  [OBSERVABILITY_EVENT_TYPES.FRONTEND_RUNTIME_ERROR]: Object.freeze({
    channel: OBSERVABILITY_CHANNELS.FRONTEND,
    level: OBSERVABILITY_LEVELS.ERROR,
    operation: 'ui.runtime',
    source: 'window.error',
    clientWritable: true,
    requiresAuth: true,
  }),
  [OBSERVABILITY_EVENT_TYPES.FRONTEND_NAVIGATION]: Object.freeze({
    channel: OBSERVABILITY_CHANNELS.FRONTEND,
    level: OBSERVABILITY_LEVELS.INFO,
    operation: 'ui.navigation',
    source: 'NavigationTracker',
    clientWritable: true,
    requiresAuth: true,
  }),
  [OBSERVABILITY_EVENT_TYPES.FRONTEND_CALL_FAILURE]: Object.freeze({
    channel: OBSERVABILITY_CHANNELS.FRONTEND,
    level: OBSERVABILITY_LEVELS.ERROR,
    operation: 'chat.call',
    source: 'ChatWindow',
    clientWritable: true,
    requiresAuth: true,
  }),
  [OBSERVABILITY_EVENT_TYPES.FRONTEND_CALL_STUCK]: Object.freeze({
    channel: OBSERVABILITY_CHANNELS.FRONTEND,
    level: OBSERVABILITY_LEVELS.WARNING,
    operation: 'chat.call',
    source: 'ChatWindow',
    clientWritable: true,
    requiresAuth: true,
  }),
  [OBSERVABILITY_EVENT_TYPES.BACKEND_API_ERROR]: Object.freeze({
    channel: OBSERVABILITY_CHANNELS.BACKEND,
    level: OBSERVABILITY_LEVELS.ERROR,
    operation: 'server.api',
    source: 'handleApiError',
    clientWritable: false,
    requiresAuth: false,
  }),
  [OBSERVABILITY_EVENT_TYPES.BACKEND_CALL_STATE]: Object.freeze({
    channel: OBSERVABILITY_CHANNELS.BACKEND,
    level: OBSERVABILITY_LEVELS.WARNING,
    operation: 'chat.call',
    source: 'chatServer',
    clientWritable: false,
    requiresAuth: false,
  }),
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function createObservabilityValidationError(
  message,
  {
    statusCode = 400,
    code = 'OBSERVABILITY_EVENT_VALIDATION_ERROR',
  } = {}
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function trimString(value, { maxLength = 1024 } = {}) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => (
      entryValue !== null
      && entryValue !== undefined
      && entryValue !== ''
    ))
  );
}

export function buildFrontendRoute(pathname = '', search = '') {
  const normalizedPath = trimString(pathname, { maxLength: 512 }) || '';
  const normalizedSearch = trimString(search, { maxLength: 512 }) || '';

  if (!normalizedPath && !normalizedSearch) {
    return null;
  }

  if (!normalizedSearch) {
    return normalizedPath || null;
  }

  const searchWithoutPrefix = normalizedSearch.replace(/^\?+/, '');
  if (!searchWithoutPrefix) {
    return normalizedPath || null;
  }

  return `${normalizedPath}?${searchWithoutPrefix}`;
}

export function createObservabilityTraceId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeObservabilityContext(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeObservabilityContext(entry));
  }

  if (typeof value === 'string') {
    return value.slice(0, 4000);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    const normalizedKey = key.toLowerCase();

    accumulator[key] = SENSITIVE_KEYS.has(normalizedKey)
      ? '[redacted]'
      : sanitizeObservabilityContext(entryValue);

    return accumulator;
  }, {});
}

export function resolveObservabilityEventDefinition(eventType) {
  return CLIENT_EVENT_DEFINITIONS[eventType] || null;
}

export function resolveClientObservabilityEventRequest({
  eventType,
  requester,
  message,
  route = null,
  metadata = {},
  traceId = null,
}) {
  const normalizedEventType = trimString(eventType, { maxLength: 120 });
  const definition = resolveObservabilityEventDefinition(normalizedEventType);

  if (!definition) {
    throw createObservabilityValidationError(
      'Tipo de evento de observabilidade invalido.',
      {
        code: 'OBSERVABILITY_EVENT_TYPE_INVALID',
      }
    );
  }

  if (!definition.clientWritable) {
    throw createObservabilityValidationError(
      'Este evento de observabilidade nao pode ser registrado pelo cliente.',
      {
        statusCode: 403,
        code: 'OBSERVABILITY_EVENT_CLIENT_FORBIDDEN',
      }
    );
  }

  if (definition.requiresAuth && !requester?.user?.id) {
    throw createObservabilityValidationError(
      'Sessao autenticada obrigatoria para registrar este evento.',
      {
        statusCode: 401,
        code: 'OBSERVABILITY_AUTH_REQUIRED',
      }
    );
  }

  const normalizedMetadata = isPlainObject(metadata) ? metadata : {};
  const normalizedTraceId = trimString(traceId, { maxLength: 120 }) || createObservabilityTraceId();
  const normalizedRoute =
    trimString(route, { maxLength: 512 })
    || trimString(normalizedMetadata.route, { maxLength: 512 });
  const normalizedSource =
    trimString(normalizedMetadata.source, { maxLength: 180 })
    || definition.source;

  if (normalizedEventType === OBSERVABILITY_EVENT_TYPES.FRONTEND_NAVIGATION) {
    if (!normalizedRoute) {
      throw createObservabilityValidationError(
        'Eventos de navegacao precisam informar a rota.',
        {
          code: 'OBSERVABILITY_ROUTE_REQUIRED',
        }
      );
    }

    return {
      eventType: normalizedEventType,
      channel: definition.channel,
      level: definition.level,
      traceId: normalizedTraceId,
      operation: definition.operation,
      source: normalizedSource,
      route: normalizedRoute,
      message:
        trimString(message, { maxLength: 512 })
        || `Navegacao registrada para ${normalizedRoute}`,
      context: compactObject(sanitizeObservabilityContext({
        kind: trimString(normalizedMetadata.kind, { maxLength: 64 }) || 'route_change',
        from: trimString(normalizedMetadata.from, { maxLength: 512 }),
        to: trimString(normalizedMetadata.to, { maxLength: 512 }) || normalizedRoute,
        duration_ms: normalizeNumber(normalizedMetadata.duration_ms),
        dom_content_loaded_ms: normalizeNumber(normalizedMetadata.dom_content_loaded_ms),
        redirect_count: normalizeNumber(normalizedMetadata.redirect_count),
      })),
    };
  }

  const normalizedMessage = trimString(message, { maxLength: 1200 });
  if (!normalizedMessage) {
    throw createObservabilityValidationError(
      'Eventos de erro precisam informar uma mensagem.',
      {
        code: 'OBSERVABILITY_MESSAGE_REQUIRED',
      }
    );
  }

  return {
    eventType: normalizedEventType,
    channel: definition.channel,
    level: definition.level,
    traceId: normalizedTraceId,
    operation: definition.operation,
    source: normalizedSource,
    route: normalizedRoute,
    message: normalizedMessage,
    context: compactObject(sanitizeObservabilityContext({
      name: trimString(normalizedMetadata.name, { maxLength: 255 }),
      stack: trimString(normalizedMetadata.stack, { maxLength: 4000 }),
      component_stack: trimString(normalizedMetadata.component_stack, { maxLength: 4000 }),
      filename: trimString(normalizedMetadata.filename, { maxLength: 512 }),
      lineno: normalizeNumber(normalizedMetadata.lineno),
      colno: normalizeNumber(normalizedMetadata.colno),
      rejection: Boolean(normalizedMetadata.rejection),
      reason: trimString(normalizedMetadata.reason, { maxLength: 1200 }),
    })),
  };
}

export function buildObservabilityLogEntry({
  eventType,
  actor = null,
  traceId = null,
  channel = null,
  level = null,
  message,
  operation = null,
  source = null,
  route = null,
  context = {},
}) {
  const definition = resolveObservabilityEventDefinition(eventType);

  return {
    tenant_id: trimString(actor?.actor_tenant_id, { maxLength: 120 }) || null,
    channel: channel || definition?.channel || OBSERVABILITY_CHANNELS.BACKEND,
    event_type: trimString(eventType, { maxLength: 120 }) || OBSERVABILITY_EVENT_TYPES.BACKEND_API_ERROR,
    level: level || definition?.level || OBSERVABILITY_LEVELS.ERROR,
    trace_id: trimString(traceId, { maxLength: 120 }) || null,
    message: trimString(message, { maxLength: 1200 }) || 'Evento de observabilidade sem mensagem.',
    operation: trimString(operation, { maxLength: 180 }) || definition?.operation || null,
    source: trimString(source, { maxLength: 180 }) || definition?.source || null,
    route: trimString(route, { maxLength: 512 }) || null,
    actor_user_id: actor?.actor_user_id || null,
    actor_email: actor?.actor_email || null,
    actor_name: actor?.actor_name || null,
    actor_profile_type: actor?.actor_profile_type || null,
    context: sanitizeObservabilityContext(context || {}),
  };
}
