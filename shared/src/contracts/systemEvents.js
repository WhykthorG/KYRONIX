// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import { NOTIFICATION_EVENT_TYPES } from './notifications.js';

export const SYSTEM_EVENT_TYPES = Object.freeze({
  ENROLLMENT_CREATED: 'enrollment.created',
  ENROLLMENT_DOCUMENT_PENDING: 'enrollment.document_pending',
  MESSAGE_POSTED: 'message.posted',
  ACCESS_RESET: 'access.reset',
  NOTIFICATION_DISPATCH_REQUESTED: 'notification.dispatch.requested',
  NOTIFICATION_DISPATCH_COMPLETED: 'notification.dispatch.completed',
  SYSTEM_EXPORT_REQUESTED: 'system.export.requested',
  SYSTEM_EXPORT_COMPLETED: 'system.export.completed',
});

export const SYSTEM_JOB_TYPES = Object.freeze({
  NOTIFICATION_DISPATCH: 'notification.dispatch',
  SYSTEM_EXPORT_GENERATION: 'system.export.generation',
});

export const SYSTEM_JOB_EXECUTION_MODES = Object.freeze({
  INLINE: 'inline',
  QUEUED: 'queued',
});

export const SYSTEM_JOB_STATUSES = Object.freeze({
  PLANNED: 'planned',
  SKIPPED: 'skipped',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

export const SYSTEM_JOB_HEADER_NAMES = Object.freeze({
  TYPE: 'X-System-Job-Type',
  STATUS: 'X-System-Job-Status',
  EVENT_TYPE: 'X-System-Job-Event-Type',
  QUEUE: 'X-System-Job-Queue',
  EXECUTION_MODE: 'X-System-Job-Execution-Mode',
  IDEMPOTENCY_KEY: 'X-System-Job-Idempotency-Key',
  REQUEST_ID: 'X-System-Job-Request-Id',
});

const SENSITIVE_METADATA_PATTERNS = [
  /password/i,
  /token/i,
  /authorization/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
];

const SYSTEM_EVENT_MAP = Object.freeze({
  [SYSTEM_EVENT_TYPES.ENROLLMENT_CREATED]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.ENROLLMENT_CREATED,
    aggregate: 'enrollment',
    description: 'Matricula criada com sucesso e pronta para fluxos derivados.',
    currentProducers: Object.freeze(['api/admin/enrollments.js']),
    currentConsumers: Object.freeze(['server/notificationsServer.js']),
    futureConsumers: Object.freeze(['webhooks.crm', 'ai.enrollment-risk-review']),
    primaryJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  [SYSTEM_EVENT_TYPES.ENROLLMENT_DOCUMENT_PENDING]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.ENROLLMENT_DOCUMENT_PENDING,
    aggregate: 'enrollment',
    description: 'Matricula criada sem anexos obrigatorios no fluxo atual.',
    currentProducers: Object.freeze(['api/admin/enrollments.js']),
    currentConsumers: Object.freeze(['server/notificationsServer.js']),
    futureConsumers: Object.freeze(['webhooks.document-checklist', 'ai.document-follow-up']),
    primaryJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  [SYSTEM_EVENT_TYPES.MESSAGE_POSTED]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.MESSAGE_POSTED,
    aggregate: 'message',
    description: 'Comunicado persistido e apto a disparar inbox, e-mail e extensoes futuras.',
    currentProducers: Object.freeze(['api/messages/index.js']),
    currentConsumers: Object.freeze(['server/notificationsServer.js']),
    futureConsumers: Object.freeze(['webhooks.communication-feed', 'ai.message-summary']),
    primaryJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  [SYSTEM_EVENT_TYPES.ACCESS_RESET]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.ACCESS_RESET,
    aggregate: 'access',
    description: 'Redefinicao de acesso realizada para um usuario autenticavel.',
    currentProducers: Object.freeze(['api/admin/users/[userId].js']),
    currentConsumers: Object.freeze(['server/notificationsServer.js']),
    futureConsumers: Object.freeze(['webhooks.identity-sync', 'ai.support-assist']),
    primaryJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  [SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_REQUESTED]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_REQUESTED,
    aggregate: 'notification',
    description: 'Pedido de dispatch consolidado para inbox/e-mail.',
    currentProducers: Object.freeze(['server/notificationsServer.js']),
    currentConsumers: Object.freeze(['notifications table']),
    futureConsumers: Object.freeze(['queue.notifications', 'webhooks.notifications']),
    primaryJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  [SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_COMPLETED]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_COMPLETED,
    aggregate: 'notification',
    description: 'Dispatch de notificacao concluido no modo inline atual.',
    currentProducers: Object.freeze(['server/notificationsServer.js']),
    currentConsumers: Object.freeze(['api/messages/index.js', 'api/admin/enrollments.js']),
    futureConsumers: Object.freeze(['queue.notifications', 'ai.notification-insights']),
    primaryJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  [SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_REQUESTED]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_REQUESTED,
    aggregate: 'system_export',
    description: 'Solicitacao de exportacao autenticada no backend administrativo.',
    currentProducers: Object.freeze(['api/admin/system-export.js']),
    currentConsumers: Object.freeze(['server/systemExportServer.js']),
    futureConsumers: Object.freeze(['queue.exports', 'webhooks.backup-ready']),
    primaryJobType: SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
  }),
  [SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED]: Object.freeze({
    eventType: SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED,
    aggregate: 'system_export',
    description: 'Arquivo de exportacao gerado com manifesto e metadados rastreaveis.',
    currentProducers: Object.freeze(['server/systemExportServer.js']),
    currentConsumers: Object.freeze(['api/admin/system-export.js']),
    futureConsumers: Object.freeze(['queue.exports', 'ai.export-anomaly-scan']),
    primaryJobType: SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
  }),
});

const PRIORITY_JOB_DEFINITIONS = Object.freeze({
  [SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH]: Object.freeze({
    jobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
    queue: 'notifications',
    executionMode: SYSTEM_JOB_EXECUTION_MODES.INLINE,
    description: 'Centraliza inbox/e-mail com payload de evento unico e pronto para fila futura.',
    eventTypes: Object.freeze([
      SYSTEM_EVENT_TYPES.ENROLLMENT_CREATED,
      SYSTEM_EVENT_TYPES.ENROLLMENT_DOCUMENT_PENDING,
      SYSTEM_EVENT_TYPES.MESSAGE_POSTED,
      SYSTEM_EVENT_TYPES.ACCESS_RESET,
      SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_REQUESTED,
      SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_COMPLETED,
    ]),
  }),
  [SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION]: Object.freeze({
    jobType: SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
    queue: 'exports',
    executionMode: SYSTEM_JOB_EXECUTION_MODES.INLINE,
    description: 'Prepara geracao de backup/exportacao com contrato unico para futura execucao assincrona.',
    eventTypes: Object.freeze([
      SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_REQUESTED,
      SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED,
    ]),
  }),
});

const FUTURE_AI_BACKLOG = Object.freeze([
  Object.freeze({
    key: 'ai.message-summary',
    triggerEventType: SYSTEM_EVENT_TYPES.MESSAGE_POSTED,
    description: 'Gerar resumo e destaque curto de comunicados para inbox, responsavel e canais externos.',
    dependsOnJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  Object.freeze({
    key: 'ai.enrollment-risk-review',
    triggerEventType: SYSTEM_EVENT_TYPES.ENROLLMENT_DOCUMENT_PENDING,
    description: 'Priorizar matriculas com risco documental usando o evento ja consolidado.',
    dependsOnJobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
  }),
  Object.freeze({
    key: 'ai.export-anomaly-scan',
    triggerEventType: SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED,
    description: 'Rodar verificacoes e sumarizacao tecnica apos exportacoes administrativas.',
    dependsOnJobType: SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
  }),
]);

function normalizeString(value, fallback = null, maxLength = 240) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function sanitizeSystemMetadata(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeSystemMetadata(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (SENSITIVE_METADATA_PATTERNS.some((pattern) => pattern.test(key))) {
          return [key, '[redacted]'];
        }

        return [key, sanitizeSystemMetadata(entry)];
      })
    );
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value ?? null;
}

function cloneDefinition(definition) {
  if (!definition) {
    return null;
  }

  return {
    ...definition,
    currentProducers: [...(definition.currentProducers || [])],
    currentConsumers: [...(definition.currentConsumers || [])],
    futureConsumers: [...(definition.futureConsumers || [])],
    eventTypes: [...(definition.eventTypes || [])],
  };
}

export function resolveSystemEventTypeFromNotificationEvent(eventType) {
  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED:
      return SYSTEM_EVENT_TYPES.ENROLLMENT_CREATED;
    case NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING:
      return SYSTEM_EVENT_TYPES.ENROLLMENT_DOCUMENT_PENDING;
    case NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED:
      return SYSTEM_EVENT_TYPES.MESSAGE_POSTED;
    case NOTIFICATION_EVENT_TYPES.ACCESS_RESET:
      return SYSTEM_EVENT_TYPES.ACCESS_RESET;
    default:
      return null;
  }
}

export function getSystemEventDefinition(eventType) {
  return cloneDefinition(SYSTEM_EVENT_MAP[eventType]);
}

export function listSystemEventMap() {
  return Object.values(SYSTEM_EVENT_MAP).map((definition) => cloneDefinition(definition));
}

export function getPriorityJobDefinition(jobType) {
  return cloneDefinition(PRIORITY_JOB_DEFINITIONS[jobType]);
}

export function listPriorityJobs() {
  return Object.values(PRIORITY_JOB_DEFINITIONS).map((definition) => cloneDefinition(definition));
}

export function listFutureAiBacklog() {
  return FUTURE_AI_BACKLOG.map((item) => ({ ...item }));
}

export function createSystemJobDescriptor({
  jobType,
  eventType,
  status = SYSTEM_JOB_STATUSES.PLANNED,
  recordId = null,
  requestedBy = null,
  idempotencyParts = null,
  metadata = {},
} = {}) {
  const jobDefinition = PRIORITY_JOB_DEFINITIONS[jobType];
  const resolvedMetadata = sanitizeSystemMetadata(metadata || {});
  const normalizedIdempotencyParts = (
    Array.isArray(idempotencyParts) && idempotencyParts.length > 0
      ? idempotencyParts
      : [jobType, eventType, recordId ? String(recordId) : null]
  )
    .map((part) => normalizeString(part ? String(part) : null, null, 180))
    .filter(Boolean);

  return {
    jobType: normalizeString(jobType, null, 120),
    eventType: normalizeString(eventType, null, 120),
    status: normalizeString(status, SYSTEM_JOB_STATUSES.PLANNED, 40),
    queue: jobDefinition?.queue || 'default',
    executionMode: jobDefinition?.executionMode || SYSTEM_JOB_EXECUTION_MODES.INLINE,
    recordId: normalizeString(recordId ? String(recordId) : null, null, 180),
    requestedBy: normalizeString(requestedBy, null, 180),
    idempotencyKey: normalizedIdempotencyParts.length > 0
      ? normalizedIdempotencyParts.join(':')
      : [
          normalizeString(jobType, 'job', 120),
          normalizeString(eventType, 'event', 120),
          normalizeString(recordId ? String(recordId) : null, 'global', 180),
        ].join(':'),
    metadata: resolvedMetadata,
  };
}

export function finalizeSystemJobDescriptor(
  job,
  {
    eventType = null,
    status = SYSTEM_JOB_STATUSES.COMPLETED,
    metadata = {},
  } = {}
) {
  return {
    ...job,
    eventType: normalizeString(eventType, null, 120) || job?.eventType || null,
    status: normalizeString(status, SYSTEM_JOB_STATUSES.COMPLETED, 40),
    metadata: sanitizeSystemMetadata({
      ...(job?.metadata || {}),
      ...(metadata || {}),
    }),
  };
}

function getHeaderValue(headers, name) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return normalizeString(headers.get(name), null, 255);
  }

  const exact = headers[name];
  if (typeof exact === 'string') {
    return normalizeString(exact, null, 255);
  }

  const lowerName = name.toLowerCase();
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === lowerName);
  return matchedKey ? normalizeString(headers[matchedKey], null, 255) : null;
}

export function buildSystemJobResponseHeaders(job = null) {
  if (!job?.jobType) {
    return {};
  }

  return Object.fromEntries(
    Object.entries({
      [SYSTEM_JOB_HEADER_NAMES.TYPE]: job.jobType,
      [SYSTEM_JOB_HEADER_NAMES.STATUS]: job.status,
      [SYSTEM_JOB_HEADER_NAMES.EVENT_TYPE]: job.eventType,
      [SYSTEM_JOB_HEADER_NAMES.QUEUE]: job.queue,
      [SYSTEM_JOB_HEADER_NAMES.EXECUTION_MODE]: job.executionMode,
      [SYSTEM_JOB_HEADER_NAMES.IDEMPOTENCY_KEY]: job.idempotencyKey,
      [SYSTEM_JOB_HEADER_NAMES.REQUEST_ID]: job.metadata?.request_id || null,
    }).filter(([, value]) => normalizeString(value, null, 255))
  );
}

export function parseSystemJobResponseHeaders(headers) {
  const jobType = getHeaderValue(headers, SYSTEM_JOB_HEADER_NAMES.TYPE);
  if (!jobType) {
    return null;
  }

  return {
    jobType,
    status: getHeaderValue(headers, SYSTEM_JOB_HEADER_NAMES.STATUS),
    eventType: getHeaderValue(headers, SYSTEM_JOB_HEADER_NAMES.EVENT_TYPE),
    queue: getHeaderValue(headers, SYSTEM_JOB_HEADER_NAMES.QUEUE),
    executionMode: getHeaderValue(headers, SYSTEM_JOB_HEADER_NAMES.EXECUTION_MODE),
    idempotencyKey: getHeaderValue(headers, SYSTEM_JOB_HEADER_NAMES.IDEMPOTENCY_KEY),
    requestId: getHeaderValue(headers, SYSTEM_JOB_HEADER_NAMES.REQUEST_ID),
  };
}
