export const AUDIT_TABLE_NAME = 'audit_logs';

export const AUDIT_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
});

export const AUDIT_EVENT_TYPES = Object.freeze({
  AUTH_LOGIN: 'auth_login',
  STORAGE_UPLOAD: 'storage_upload',
  ENROLLMENT_TRANSACTION: 'enrollment_transaction',
});

export const AUDIT_ACTION_LABELS = Object.freeze({
  [AUDIT_ACTIONS.CREATE]: 'Criação',
  [AUDIT_ACTIONS.UPDATE]: 'Edição',
  [AUDIT_ACTIONS.DELETE]: 'Exclusão',
});

export const AUDIT_ACTION_BADGE_CLASSNAMES = Object.freeze({
  [AUDIT_ACTIONS.CREATE]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [AUDIT_ACTIONS.UPDATE]: 'bg-amber-100 text-amber-800 border-amber-200',
  [AUDIT_ACTIONS.DELETE]: 'bg-rose-100 text-rose-700 border-rose-200',
});

const AUDIT_ACTION_ALIASES = Object.freeze({
  create: AUDIT_ACTIONS.CREATE,
  insert: AUDIT_ACTIONS.CREATE,
  update: AUDIT_ACTIONS.UPDATE,
  delete: AUDIT_ACTIONS.DELETE,
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
]);

const IGNORED_DIFF_KEYS = new Set(['updated_at']);

const AUDIT_EVENT_DEFINITIONS = Object.freeze({
  [AUDIT_EVENT_TYPES.AUTH_LOGIN]: Object.freeze({
    entityTable: 'auth_sessions',
    action: AUDIT_ACTIONS.CREATE,
    metadata: Object.freeze({
      operation: 'login',
    }),
    clientWritable: true,
    requiresProfile: false,
    clientSource: 'AuthContext.signIn',
  }),
  [AUDIT_EVENT_TYPES.STORAGE_UPLOAD]: Object.freeze({
    entityTable: 'storage_uploads',
    action: AUDIT_ACTIONS.CREATE,
    metadata: Object.freeze({
      operation: 'upload',
    }),
    clientWritable: true,
    requiresProfile: true,
    clientSource: 'storageFiles.uploadStorageFile',
  }),
  [AUDIT_EVENT_TYPES.ENROLLMENT_TRANSACTION]: Object.freeze({
    entityTable: 'enrollment_transactions',
    action: AUDIT_ACTIONS.CREATE,
    metadata: Object.freeze({
      operation: 'transaction',
    }),
    clientWritable: false,
    requiresProfile: true,
    clientSource: null,
  }),
});

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
);

function createAuditRequestValidationError(
  message,
  {
    statusCode = 400,
    code = 'AUDIT_EVENT_VALIDATION_ERROR',
  } = {}
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizeAuditString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeAuditAction(value) {
  const normalized = normalizeAuditString(value)?.toLowerCase();
  return normalized ? AUDIT_ACTION_ALIASES[normalized] || null : null;
}

function normalizeAuditNumber(value) {
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

function compactAuditMetadata(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => (
      entryValue !== null
      && entryValue !== undefined
      && entryValue !== ''
    ))
  );
}

export function sanitizeAuditRecord(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditRecord(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    const normalizedKey = key.toLowerCase();
    accumulator[key] = SENSITIVE_KEYS.has(normalizedKey)
      ? '[redacted]'
      : sanitizeAuditRecord(entryValue);
    return accumulator;
  }, {});
}

function valuesAreDifferent(left, right) {
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
}

export function buildChangedFields(previousRecord, nextRecord) {
  const previous = isPlainObject(previousRecord) ? previousRecord : {};
  const next = isPlainObject(nextRecord) ? nextRecord : {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);

  return [...keys]
    .filter((key) => !IGNORED_DIFF_KEYS.has(key))
    .filter((key) => valuesAreDifferent(previous[key], next[key]))
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

export function getAuditActorFromRequester(requester) {
  if (!requester?.user) return null;

  return {
    actor_user_id: requester.user.id || null,
    actor_email: requester.user.email || null,
    actor_tenant_id: requester.tenantId || requester.tenant_id || null,
    actor_name:
      requester.profile?.full_name
      || requester.user.user_metadata?.full_name
      || requester.user.email
      || 'Operador do sistema',
    actor_profile_type: requester.profile?.profile_type || null,
  };
}

export function getAuditActorTenantId(actor) {
  return normalizeAuditString(actor?.actor_tenant_id);
}

export function resolveAuditEventDefinition(eventType) {
  return AUDIT_EVENT_DEFINITIONS[eventType] || null;
}

export function buildStorageUploadAuditMetadata({
  bucket,
  folder,
  path,
  fileName,
  contentType,
  sizeBytes,
  source,
} = {}) {
  return compactAuditMetadata({
    bucket: normalizeAuditString(bucket),
    folder: normalizeAuditString(folder),
    path: normalizeAuditString(path),
    file_name: normalizeAuditString(fileName),
    content_type: normalizeAuditString(contentType),
    size_bytes: normalizeAuditNumber(sizeBytes),
    source: normalizeAuditString(source),
  });
}

export function resolveClientAuditEventRequest({
  eventType,
  requester,
  metadata = {},
}) {
  const definition = resolveAuditEventDefinition(eventType);

  if (!definition) {
    throw createAuditRequestValidationError(
      'Tipo de evento de auditoria invalido.',
      {
        code: 'AUDIT_EVENT_TYPE_INVALID',
      }
    );
  }

  if (!definition.clientWritable) {
    throw createAuditRequestValidationError(
      'Este evento de auditoria nao pode ser registrado pelo cliente.',
      {
        statusCode: 403,
        code: 'AUDIT_EVENT_CLIENT_FORBIDDEN',
      }
    );
  }

  if (definition.requiresProfile && !requester?.profile?.profile_type) {
    throw createAuditRequestValidationError(
      'Seu perfil nao esta habilitado para registrar este evento de auditoria.',
      {
        statusCode: 403,
        code: 'AUDIT_EVENT_PROFILE_REQUIRED',
      }
    );
  }

  const normalizedMetadata = isPlainObject(metadata) ? metadata : {};
  const source = definition.clientSource || normalizeAuditString(normalizedMetadata.source) || 'api/audit/events';

  if (eventType === AUDIT_EVENT_TYPES.AUTH_LOGIN) {
    return {
      definition,
      recordId: requester?.user?.id || requester?.user?.email || null,
      metadata: compactAuditMetadata({
        provider: normalizeAuditString(normalizedMetadata.provider) || 'password',
        source,
      }),
    };
  }

  if (eventType === AUDIT_EVENT_TYPES.STORAGE_UPLOAD) {
    const path = normalizeAuditString(normalizedMetadata.path);

    if (!path) {
      throw createAuditRequestValidationError(
        'Uploads auditaveis precisam informar o path do arquivo.',
        {
          code: 'AUDIT_EVENT_STORAGE_PATH_REQUIRED',
        }
      );
    }

    return {
      definition,
      recordId: path,
      metadata: compactAuditMetadata({
        bucket: normalizeAuditString(normalizedMetadata.bucket),
        folder: normalizeAuditString(normalizedMetadata.folder),
        path,
        file_name: normalizeAuditString(normalizedMetadata.file_name),
        content_type: normalizeAuditString(normalizedMetadata.content_type),
        size_bytes: normalizeAuditNumber(normalizedMetadata.size_bytes),
        source,
      }),
    };
  }

  return {
    definition,
    recordId: requester?.user?.id || requester?.user?.email || null,
    metadata: compactAuditMetadata({ source }),
  };
}

export function buildAuditLogEntry({
  action,
  entityTable,
  recordId,
  actor = null,
  previousRecord = null,
  newRecord = null,
  metadata = {},
}) {
  const normalizedAction = normalizeAuditAction(action);

  if (!normalizedAction) {
    throw new Error(`Unsupported audit action: ${String(action)}`);
  }

  const sanitizedPrevious = previousRecord ? sanitizeAuditRecord(previousRecord) : null;
  const sanitizedNext = newRecord ? sanitizeAuditRecord(newRecord) : null;

  return {
    tenant_id: getAuditActorTenantId(actor),
    entity_table: entityTable,
    record_id: recordId ? String(recordId) : null,
    action: normalizedAction,
    actor_user_id: actor?.actor_user_id || null,
    actor_email: actor?.actor_email || null,
    actor_name: actor?.actor_name || null,
    actor_profile_type: actor?.actor_profile_type || null,
    changed_fields: buildChangedFields(sanitizedPrevious, sanitizedNext),
    previous_record: sanitizedPrevious,
    new_record: sanitizedNext,
    metadata: sanitizeAuditRecord(metadata || {}),
  };
}

export function buildAuditEventLogEntry({
  eventType,
  recordId = null,
  actor = null,
  previousRecord = null,
  newRecord = null,
  metadata = {},
}) {
  const definition = resolveAuditEventDefinition(eventType);

  if (!definition) {
    throw new Error(`Unsupported audit event type: ${eventType}`);
  }

  return buildAuditLogEntry({
    action: definition.action,
    entityTable: definition.entityTable,
    recordId,
    actor,
    previousRecord,
    newRecord,
    metadata: {
      ...definition.metadata,
      event_type: eventType,
      ...(metadata || {}),
    },
  });
}
