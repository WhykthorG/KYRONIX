import { createApiError, createServiceRoleClient } from '../database/supabaseAdminServer.js';
import { PERMISSIONS, hasPermission } from '../../../shared/src/contracts/access.js';
import {
  MESSAGE_RECIPIENT_TYPES,
  normalizeMessageChannels,
  normalizeMessageRecipientType,
} from '../../../shared/src/contracts/messages.js';
import {
  buildNotificationRecord,
  buildNotificationTemplate,
  getDefaultNotificationChannels,
  isNotificationEventEnabled,
  isNotificationsTableUnavailable,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EMAIL_STATUSES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_TABLE_NAME,
} from '../../../shared/src/contracts/notifications.js';
import {
  createSystemJobDescriptor,
  finalizeSystemJobDescriptor,
  resolveSystemEventTypeFromNotificationEvent,
  SYSTEM_EVENT_TYPES,
  SYSTEM_JOB_STATUSES,
  SYSTEM_JOB_TYPES,
} from '../../../shared/src/contracts/systemEvents.js';
import {
  DEFAULT_SYSTEM_SETTINGS,
  mapSystemSettingsRecord,
  SYSTEM_SETTINGS_ROW_ID,
} from '../../../shared/src/contracts/settings.js';

const ACTIVE_PROFILE_STATUSES = ['ativo', 'pendente'];
const ACTIVE_ENROLLMENT_STATUSES = ['ativo', 'pendente'];

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

function normalizeRecipient(recipient = {}) {
  const email = normalizeEmail(recipient.email);
  if (!email) {
    return null;
  }

  return {
    email,
    name: normalizeString(recipient.name, null),
    profileType: normalizeString(recipient.profileType, null),
  };
}

function dedupeRecipients(recipients = []) {
  const byEmail = new Map();

  recipients.forEach((recipient) => {
    const normalized = normalizeRecipient(recipient);
    if (!normalized) {
      return;
    }

    if (!byEmail.has(normalized.email)) {
      byEmail.set(normalized.email, normalized);
      return;
    }

    const current = byEmail.get(normalized.email);
    byEmail.set(normalized.email, {
      email: normalized.email,
      name: current?.name || normalized.name,
      profileType: current?.profileType || normalized.profileType,
    });
  });

  return [...byEmail.values()];
}

function applyTenantScope(query, tenantId = null) {
  if (!tenantId) {
    return query;
  }

  return query.eq('tenant_id', tenantId);
}

function isNotificationInfrastructureMismatch(error) {
  const message = error?.message || '';

  return (
    isNotificationsTableUnavailable(error)
    || error?.code === '42703'
    || /column .*tenant_id.* does not exist/i.test(message)
    || /column .*action_label.* does not exist/i.test(message)
    || /column .*action_app.* does not exist/i.test(message)
    || /column .*dismissed_at.* does not exist/i.test(message)
    || /column .*email_status.* does not exist/i.test(message)
  );
}

function canBypassNotificationInfrastructure(error) {
  return process.env.NODE_ENV !== 'production'
    && isNotificationInfrastructureMismatch(error);
}

async function loadNotificationSettings(serviceClient, tenantId = null) {
  let query = serviceClient
    .from('app_settings')
    .select('*')
    .eq('id', SYSTEM_SETTINGS_ROW_ID)
    .limit(1);

  query = applyTenantScope(query, tenantId);

  const { data, error } = await query.maybeSingle();

  if (error && !['42P01', 'PGRST205', 'PGRST116'].includes(error.code)) {
    throw createApiError(
      error.message || 'Falha ao carregar configuracoes de notificacao.',
      {
        statusCode: 500,
        code: 'NOTIFICATION_SETTINGS_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return data ? mapSystemSettingsRecord(data) : { ...DEFAULT_SYSTEM_SETTINGS };
}

async function fetchAdministrativeRecipients(serviceClient) {
  const { data, error } = await serviceClient
    .from('user_profiles')
    .select('user_email, full_name, profile_type, status')
    .in('status', ACTIVE_PROFILE_STATUSES);

  if (error) {
    throw createApiError(
      error.message || 'Falha ao carregar destinatarios administrativos.',
      {
        statusCode: 500,
        code: 'NOTIFICATION_RECIPIENT_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return dedupeRecipients(
    (data || [])
      .filter((profile) => hasPermission(profile.profile_type, PERMISSIONS.ENROLLMENTS_MANAGE))
      .map((profile) => ({
        email: profile.user_email,
        name: profile.full_name,
        profileType: profile.profile_type,
      }))
  );
}

async function fetchStudentRecipients(serviceClient, queryBuilder) {
  const { data, error } = await queryBuilder
    .in('enrollment_status', ACTIVE_ENROLLMENT_STATUSES);

  if (error) {
    throw createApiError(
      error.message || 'Falha ao carregar destinatarios alunos.',
      {
        statusCode: 500,
        code: 'NOTIFICATION_RECIPIENT_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return dedupeRecipients(
    (data || []).map((student) => ({
      email: student.email,
      name: student.full_name,
      profileType: 'aluno',
    }))
  );
}

async function fetchProfileRecipients(serviceClient, profileType = null) {
  let query = serviceClient
    .from('user_profiles')
    .select('user_email, full_name, profile_type, status')
    .in('status', ACTIVE_PROFILE_STATUSES);

  if (profileType) {
    query = query.eq('profile_type', profileType);
  }

  const { data, error } = await query;

  if (error) {
    throw createApiError(
      error.message || 'Falha ao carregar destinatarios de perfil.',
      {
        statusCode: 500,
        code: 'NOTIFICATION_RECIPIENT_LOAD_FAILED',
        cause: error,
      }
    );
  }

  return dedupeRecipients(
    (data || []).map((profile) => ({
      email: profile.user_email,
      name: profile.full_name,
      profileType: profile.profile_type,
    }))
  );
}

async function resolveMessageRecipients(serviceClient, payload = {}) {
  const recipientType = normalizeMessageRecipientType(payload.recipientType);

  switch (recipientType) {
    case MESSAGE_RECIPIENT_TYPES.ALL: {
      const [profiles, students] = await Promise.all([
        fetchProfileRecipients(serviceClient),
        fetchStudentRecipients(
          serviceClient,
          serviceClient
            .from('students')
            .select('email, full_name, enrollment_status')
            .not('email', 'is', null)
        ),
      ]);

      return dedupeRecipients([...profiles, ...students]);
    }

    case MESSAGE_RECIPIENT_TYPES.CLASS:
      return fetchStudentRecipients(
        serviceClient,
        serviceClient
          .from('students')
          .select('email, full_name, enrollment_status')
          .eq('current_class_id', payload.classId)
          .not('email', 'is', null)
      );

    case MESSAGE_RECIPIENT_TYPES.STUDENT: {
      const recipientIds = Array.isArray(payload.recipientIds) ? payload.recipientIds.filter(Boolean) : [];
      if (recipientIds.length === 0) {
        return [];
      }

      return fetchStudentRecipients(
        serviceClient,
        serviceClient
          .from('students')
          .select('email, full_name, enrollment_status')
          .in('id', recipientIds)
          .not('email', 'is', null)
      );
    }

    case MESSAGE_RECIPIENT_TYPES.TEACHER:
    case MESSAGE_RECIPIENT_TYPES.COORDINATOR:
      return fetchProfileRecipients(serviceClient, recipientType);

    default:
      return [];
  }
}

async function resolveRecipientsForEvent(serviceClient, eventType, payload = {}) {
  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED:
    case NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING:
      return fetchAdministrativeRecipients(serviceClient);

    case NOTIFICATION_EVENT_TYPES.ACCESS_RESET:
      return dedupeRecipients([
        {
          email: payload.recipientEmail,
          name: payload.recipientName,
          profileType: payload.recipientProfileType,
        },
      ]);

    case NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED:
      return resolveMessageRecipients(serviceClient, payload);

    default:
      throw createApiError('Tipo de evento de notificacao nao suportado.', {
        statusCode: 400,
        code: 'NOTIFICATION_EVENT_UNSUPPORTED',
      });
  }
}

function resolveChannelsForEvent(eventType, payload = {}) {
  if (eventType === NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED) {
    return normalizeMessageChannels(payload.channels);
  }

  return getDefaultNotificationChannels();
}

function getEmailAdapterConfig() {
  const url = normalizeString(process.env.NOTIFICATION_EMAIL_WEBHOOK_URL, null);
  if (!url) {
    return null;
  }

  return {
    url,
    token: normalizeString(process.env.NOTIFICATION_EMAIL_WEBHOOK_TOKEN, null),
  };
}

async function sendNotificationEmail({
  adapter,
  notificationId,
  recipient,
  template,
  eventType,
}) {
  if (!adapter?.url) {
    return {
      status: NOTIFICATION_EMAIL_STATUSES.SKIPPED,
      error: null,
    };
  }

  const response = await fetch(adapter.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(adapter.token ? { Authorization: `Bearer ${adapter.token}` } : {}),
    },
    body: JSON.stringify({
      to: recipient.email,
      subject: template.emailSubject,
      text: template.emailText,
      metadata: {
        event_type: eventType,
        notification_id: notificationId,
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || 'Falha ao enviar e-mail transacional.');
  }

  return {
    status: NOTIFICATION_EMAIL_STATUSES.SENT,
    error: null,
  };
}

export async function dispatchNotificationEvent({
  actor = null,
  eventType,
  payload = {},
  recipients = null,
  channels = null,
  metadata = {},
  secrets = {},
}) {
  const serviceClient = createServiceRoleClient(actor);
  const settings = await loadNotificationSettings(serviceClient, actor?.actor_tenant_id || null);
  const sourceEventType = resolveSystemEventTypeFromNotificationEvent(eventType);
  const baseJob = createSystemJobDescriptor({
    jobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
    eventType: sourceEventType || SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_REQUESTED,
    recordId: payload.actionRecordId || payload.messageId || payload.studentId || payload.recipientEmail || eventType,
    requestedBy: actor?.actor_email || null,
    idempotencyParts: [
      SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
      sourceEventType || eventType,
      payload.actionRecordId || payload.messageId || payload.studentId || payload.recipientEmail || eventType,
      metadata?.trace_id || metadata?.request_id || null,
    ],
    metadata: {
      notification_event_type: eventType,
      source: metadata?.source || null,
      request_id: metadata?.request_id || null,
    },
  });

  if (!isNotificationEventEnabled(settings, eventType)) {
    return {
      success: true,
      skipped: true,
      reason: 'PREFERENCE_DISABLED',
      insertedCount: 0,
      emailSentCount: 0,
      emailFailedCount: 0,
      job: finalizeSystemJobDescriptor(baseJob, {
        status: SYSTEM_JOB_STATUSES.SKIPPED,
        metadata: {
          skip_reason: 'PREFERENCE_DISABLED',
        },
      }),
    };
  }

  const resolvedRecipients = recipients
    ? dedupeRecipients(recipients)
    : await resolveRecipientsForEvent(serviceClient, eventType, payload);

  if (resolvedRecipients.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: 'NO_RECIPIENTS',
      insertedCount: 0,
      emailSentCount: 0,
      emailFailedCount: 0,
      job: finalizeSystemJobDescriptor(baseJob, {
        status: SYSTEM_JOB_STATUSES.SKIPPED,
        metadata: {
          skip_reason: 'NO_RECIPIENTS',
        },
      }),
    };
  }

  const resolvedChannels = channels || resolveChannelsForEvent(eventType, payload);
  const adapter = getEmailAdapterConfig();
  const now = new Date().toISOString();

  const preparedNotifications = resolvedRecipients.map((recipient) => {
    const template = buildNotificationTemplate({
      eventType,
      payload,
      secrets,
    });

    const record = buildNotificationRecord({
      eventType,
      recipient,
      channels: resolvedChannels,
      template,
      tenantId: actor?.actor_tenant_id || null,
      metadata,
      actionRecordId: payload.actionRecordId || payload.messageId || payload.studentId || null,
      now,
    });

    if (!adapter && record.email_status === NOTIFICATION_EMAIL_STATUSES.PENDING) {
      record.email_status = NOTIFICATION_EMAIL_STATUSES.SKIPPED;
    }

    return {
      recipient,
      template,
      record,
    };
  });

  const { data, error } = await serviceClient
    .from(NOTIFICATION_TABLE_NAME)
    .insert(preparedNotifications.map((item) => item.record))
    .select('id, recipient_email, email_status');

  if (error) {
    throw createApiError(
      error.message || 'Falha ao persistir notificacoes.',
      {
        statusCode: 500,
        code: 'NOTIFICATION_INSERT_FAILED',
        cause: error,
      }
    );
  }

  let emailSentCount = 0;
  let emailFailedCount = 0;
  const insertedRows = data || [];
  const insertedByEmail = new Map(
    insertedRows.map((row) => [normalizeEmail(row.recipient_email), row])
  );

  if (adapter) {
    for (const item of preparedNotifications) {
      if (!item.record.channels.includes(NOTIFICATION_CHANNELS.EMAIL)) {
        continue;
      }

      const insertedRow = insertedByEmail.get(item.recipient.email);
      if (!insertedRow?.id) {
        continue;
      }

      try {
        await sendNotificationEmail({
          adapter,
          notificationId: insertedRow.id,
          recipient: item.recipient,
          template: item.template,
          eventType,
        });

        emailSentCount += 1;

        await serviceClient
          .from(NOTIFICATION_TABLE_NAME)
          .update({
            email_status: NOTIFICATION_EMAIL_STATUSES.SENT,
            email_error: null,
          })
          .eq('id', insertedRow.id);
      } catch (sendError) {
        emailFailedCount += 1;

        await serviceClient
          .from(NOTIFICATION_TABLE_NAME)
          .update({
            email_status: NOTIFICATION_EMAIL_STATUSES.FAILED,
            email_error: normalizeString(sendError.message, 'Falha ao enviar e-mail.'),
          })
          .eq('id', insertedRow.id);
      }
    }
  }

  return {
    success: true,
    skipped: false,
    insertedCount: insertedRows.length,
    emailSentCount,
    emailFailedCount,
    job: finalizeSystemJobDescriptor(baseJob, {
      eventType: SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_COMPLETED,
      status: SYSTEM_JOB_STATUSES.COMPLETED,
      metadata: {
        recipient_count: insertedRows.length,
        email_sent_count: emailSentCount,
        email_failed_count: emailFailedCount,
        channels: resolvedChannels,
      },
    }),
  };
}

export async function listNotificationsForRecipient({
  recipientEmail,
  limit = 30,
  includeDismissed = false,
  client = null,
  tenantId = null,
}) {
  const normalizedRecipientEmail = normalizeEmail(recipientEmail);
  if (!normalizedRecipientEmail) {
    throw createApiError('Destinatario autenticado sem e-mail valido.', {
      statusCode: 400,
      code: 'NOTIFICATION_RECIPIENT_EMAIL_REQUIRED',
    });
  }

  const parsedLimit = Number.parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 100)
    : 30;

  const scopedClient = client || createServiceRoleClient();
  let query = scopedClient
    .from(NOTIFICATION_TABLE_NAME)
    .select(`
      id,
      event_type,
      title,
      body,
      action_app,
      action_label,
      app_status,
      email_status,
      read_at,
      dismissed_at,
      created_at
    `)
    .eq('recipient_email', normalizedRecipientEmail)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  query = applyTenantScope(query, tenantId);

  if (!includeDismissed) {
    query = query.is('dismissed_at', null);
  }

  const { data, error } = await query;

  if (error) {
    if (canBypassNotificationInfrastructure(error)) {
      console.warn(
        `[notifications-bypass] Development bypass for recipient=${normalizedRecipientEmail} code=${error?.code || 'unknown'}`
      );
      return [];
    }

    throw createApiError(
      error.message || 'Falha ao listar notificacoes.',
      {
        statusCode: isNotificationsTableUnavailable(error) ? 503 : 500,
        code: isNotificationsTableUnavailable(error)
          ? 'NOTIFICATION_TABLE_UNAVAILABLE'
          : 'NOTIFICATION_LIST_FAILED',
        cause: error,
      }
    );
  }

  return data || [];
}

async function updateNotificationStateForRecipient({
  recipientEmail,
  notificationId,
  patch,
  requireUndismissed = false,
  client = null,
  tenantId = null,
}) {
  const scopedClient = client || createServiceRoleClient();
  let query = scopedClient
    .from(NOTIFICATION_TABLE_NAME)
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('recipient_email', normalizeEmail(recipientEmail))
    .select('id, app_status, read_at, dismissed_at')
    .maybeSingle();

  query = applyTenantScope(query, tenantId);

  if (requireUndismissed) {
    query = query.is('dismissed_at', null);
  }

  const { data, error } = await query;

  if (error) {
    if (canBypassNotificationInfrastructure(error)) {
      console.warn(
        `[notifications-bypass] Development bypass for update recipient=${normalizeEmail(recipientEmail)} code=${error?.code || 'unknown'}`
      );
      return {
        id: notificationId,
        app_status: patch?.app_status || null,
        read_at: patch?.read_at || null,
        dismissed_at: patch?.dismissed_at || null,
        bypassed: true,
      };
    }

    throw createApiError(
      error.message || 'Falha ao atualizar notificacao.',
      {
        statusCode: 500,
        code: 'NOTIFICATION_UPDATE_FAILED',
        cause: error,
      }
    );
  }

  if (!data?.id) {
    throw createApiError('Notificacao nao encontrada para o destinatario autenticado.', {
      statusCode: 404,
      code: 'NOTIFICATION_NOT_FOUND',
    });
  }

  return data;
}

export async function markNotificationAsRead({
  recipientEmail,
  notificationId,
  client = null,
  tenantId = null,
}) {
  return updateNotificationStateForRecipient({
    recipientEmail,
    notificationId,
    patch: {
      read_at: new Date().toISOString(),
      app_status: 'lida',
    },
    requireUndismissed: true,
    client,
    tenantId,
  });
}

export async function dismissNotification({
  recipientEmail,
  notificationId,
  client = null,
  tenantId = null,
}) {
  return updateNotificationStateForRecipient({
    recipientEmail,
    notificationId,
    patch: {
      dismissed_at: new Date().toISOString(),
      app_status: 'dispensada',
    },
    client,
    tenantId,
  });
}

export async function markAllNotificationsAsRead({
  recipientEmail,
  client = null,
  tenantId = null,
}) {
  const scopedClient = client || createServiceRoleClient();
  const now = new Date().toISOString();

  let query = scopedClient
    .from(NOTIFICATION_TABLE_NAME)
    .update({
      read_at: now,
      app_status: 'lida',
      updated_at: now,
    })
    .eq('recipient_email', normalizeEmail(recipientEmail))
    .is('read_at', null)
    .is('dismissed_at', null)
    .select('id');

  query = applyTenantScope(query, tenantId);

  const { data, error } = await query;

  if (error) {
    if (canBypassNotificationInfrastructure(error)) {
      console.warn(
        `[notifications-bypass] Development bypass for mark-all recipient=${normalizeEmail(recipientEmail)} code=${error?.code || 'unknown'}`
      );
      return {
        success: true,
        updatedCount: 0,
        bypassed: true,
      };
    }

    throw createApiError(
      error.message || 'Falha ao marcar notificacoes como lidas.',
      {
        statusCode: 500,
        code: 'NOTIFICATION_MARK_ALL_FAILED',
        cause: error,
      }
    );
  }

  return {
    success: true,
    updatedCount: data?.length || 0,
  };
}
