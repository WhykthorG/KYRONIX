// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
export const NOTIFICATION_TABLE_NAME = 'notifications';

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  ENROLLMENT_CREATED: 'enrollment_created',
  DOCUMENT_PENDING: 'document_pending',
  MESSAGE_POSTED: 'message_posted',
  ACCESS_RESET: 'access_reset',
});

export const NOTIFICATION_CHANNELS = Object.freeze({
  APP: 'app',
  EMAIL: 'email',
});

export const NOTIFICATION_APP_STATUSES = Object.freeze({
  DELIVERED: 'entregue',
  READ: 'lida',
  DISMISSED: 'dispensada',
});

export const NOTIFICATION_EMAIL_STATUSES = Object.freeze({
  PENDING: 'pendente',
  SENT: 'enviado',
  FAILED: 'falhou',
  SKIPPED: 'dispensado',
});

const VALID_EVENT_TYPES = new Set(Object.values(NOTIFICATION_EVENT_TYPES));
const VALID_CHANNELS = new Set(Object.values(NOTIFICATION_CHANNELS));

const DEFAULT_CHANNELS = Object.freeze([
  NOTIFICATION_CHANNELS.APP,
  NOTIFICATION_CHANNELS.EMAIL,
]);

const NOTIFICATION_PREFERENCE_KEYS = Object.freeze({
  [NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED]: 'notifyNewEnrollment',
  [NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING]: 'notifyDocumentPending',
  [NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED]: 'notifyMessagePosted',
  [NOTIFICATION_EVENT_TYPES.ACCESS_RESET]: 'notifyAccessReset',
});

const SENSITIVE_METADATA_PATTERNS = [
  /password/i,
  /token/i,
  /authorization/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
];

function normalizeString(value, fallback = null) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeEmail(value) {
  const email = normalizeString(value, null);
  return email ? email.toLowerCase() : null;
}

function truncateText(value, maxLength = 140) {
  const text = normalizeString(value, '');
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function sanitizeMetadata(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (SENSITIVE_METADATA_PATTERNS.some((pattern) => pattern.test(key))) {
          return [key, '[redacted]'];
        }

        return [key, sanitizeMetadata(item)];
      })
    );
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return value ?? null;
}

export function normalizeNotificationChannels(channels, fallback = DEFAULT_CHANNELS) {
  const values = Array.isArray(channels) ? channels : fallback;
  const normalized = values.filter((channel) => VALID_CHANNELS.has(channel));
  return normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULT_CHANNELS];
}

export function resolveNotificationPreferenceKey(eventType) {
  return NOTIFICATION_PREFERENCE_KEYS[eventType] || null;
}

export function isNotificationEventEnabled(settings = {}, eventType) {
  const key = resolveNotificationPreferenceKey(eventType);
  if (!key) {
    return true;
  }

  return settings[key] ?? true;
}

export function getNotificationPresentation(eventType) {
  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED:
      return {
        icon: '🎓',
        actionApp: 'students',
        actionLabel: 'Abrir alunos',
      };
    case NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING:
      return {
        icon: '📎',
        actionApp: 'registration',
        actionLabel: 'Revisar matricula',
      };
    case NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED:
      return {
        icon: '📣',
        actionApp: 'messages',
        actionLabel: 'Abrir comunicados',
      };
    case NOTIFICATION_EVENT_TYPES.ACCESS_RESET:
      return {
        icon: '🔑',
        actionApp: null,
        actionLabel: null,
      };
    default:
      return {
        icon: '🔔',
        actionApp: null,
        actionLabel: null,
      };
  }
}

export function buildNotificationTemplate({
  eventType,
  payload = {},
  secrets = {},
}) {
  const presentation = getNotificationPresentation(eventType);

  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED: {
      const studentName = normalizeString(payload.studentName, 'Aluno sem identificacao');
      const className = normalizeString(payload.className, null);
      const title = 'Nova matricula registrada';
      const body = className
        ? `${studentName} foi matriculado(a) na turma ${className}.`
        : `${studentName} foi matriculado(a) e aguarda acompanhamento da equipe.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: `${body}\n\nOrigem: fluxo de matricula.`,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING: {
      const studentName = normalizeString(payload.studentName, 'Aluno sem identificacao');
      const title = 'Documentacao pendente na matricula';
      const body = `${studentName} foi matriculado(a) sem anexos obrigatorios enviados.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: `${body}\n\nAcesse o modulo de matriculas para acompanhar a regularizacao.`,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED: {
      const subject = normalizeString(payload.subject, 'Novo comunicado');
      const senderName = normalizeString(payload.senderName, 'Equipe escolar');
      const preview = truncateText(payload.content, 120);
      const title = `Novo comunicado: ${subject}`;
      const body = preview
        ? `${senderName} enviou um comunicado. ${preview}`
        : `${senderName} enviou um novo comunicado para voce.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: `${senderName} enviou um comunicado.\n\nAssunto: ${subject}\n\n${payload.content || ''}`.trim(),
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    case NOTIFICATION_EVENT_TYPES.ACCESS_RESET: {
      const actorName = normalizeString(payload.actorName, 'A equipe da escola');
      const title = 'Acesso redefinido';
      const body = `${actorName} redefiniu seu acesso ao sistema. Use o fluxo seguro de recuperacao para definir uma nova senha.`;

      return {
        title,
        body,
        emailSubject: title,
        emailText: body,
        actionApp: presentation.actionApp,
        actionLabel: presentation.actionLabel,
      };
    }

    default:
      throw Object.assign(new Error('Tipo de notificacao invalido.'), {
        code: 'NOTIFICATION_EVENT_INVALID',
        statusCode: 400,
      });
  }
}

export function buildNotificationRecord({
  eventType,
  recipient,
  channels,
  template,
  tenantId = null,
  metadata = {},
  actionRecordId = null,
  now = new Date().toISOString(),
}) {
  if (!VALID_EVENT_TYPES.has(eventType)) {
    throw Object.assign(new Error('Tipo de notificacao invalido.'), {
      code: 'NOTIFICATION_EVENT_INVALID',
      statusCode: 400,
    });
  }

  const recipientEmail = normalizeEmail(recipient?.email);
  if (!recipientEmail) {
    throw Object.assign(new Error('Destinatario da notificacao sem e-mail valido.'), {
      code: 'NOTIFICATION_RECIPIENT_EMAIL_REQUIRED',
      statusCode: 400,
    });
  }

  const resolvedTemplate = template || buildNotificationTemplate({ eventType });
  const normalizedChannels = normalizeNotificationChannels(channels);
  const hasAppChannel = normalizedChannels.includes(NOTIFICATION_CHANNELS.APP);
  const hasEmailChannel = normalizedChannels.includes(NOTIFICATION_CHANNELS.EMAIL);

  return {
    tenant_id: normalizeString(tenantId, null),
    recipient_email: recipientEmail,
    recipient_name: normalizeString(recipient?.name, null),
    recipient_profile_type: normalizeString(recipient?.profileType, null),
    event_type: eventType,
    title: normalizeString(resolvedTemplate.title, 'Notificacao'),
    body: normalizeString(resolvedTemplate.body, 'Voce recebeu uma nova notificacao.'),
    channels: normalizedChannels,
    app_status: hasAppChannel
      ? NOTIFICATION_APP_STATUSES.DELIVERED
      : NOTIFICATION_APP_STATUSES.DISMISSED,
    email_status: hasEmailChannel
      ? NOTIFICATION_EMAIL_STATUSES.PENDING
      : NOTIFICATION_EMAIL_STATUSES.SKIPPED,
    email_error: null,
    action_app: normalizeString(resolvedTemplate.actionApp, null),
    action_label: normalizeString(resolvedTemplate.actionLabel, null),
    action_record_id: normalizeString(actionRecordId, null),
    metadata: sanitizeMetadata(metadata),
    created_at: now,
    updated_at: now,
  };
}

export function getDefaultNotificationChannels() {
  return [...DEFAULT_CHANNELS];
}

export function isNotificationsTableUnavailable(error) {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || /notifications/i.test(error?.message || '');
}
