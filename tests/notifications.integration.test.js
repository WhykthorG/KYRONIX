// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildNotificationRecord,
  buildNotificationTemplate,
  isNotificationEventEnabled,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EMAIL_STATUSES,
  NOTIFICATION_EVENT_TYPES,
  resolveNotificationPreferenceKey,
} from '../shared/src/contracts/notifications.js';
import {
  createSystemJobDescriptor,
  finalizeSystemJobDescriptor,
  listPriorityJobs,
  resolveSystemEventTypeFromNotificationEvent,
  SYSTEM_EVENT_TYPES,
  SYSTEM_JOB_TYPES,
} from '../shared/src/contracts/systemEvents.js';

test('notification preference mapping covers the base milestone 6 events', () => {
  assert.equal(
    resolveNotificationPreferenceKey(NOTIFICATION_EVENT_TYPES.ENROLLMENT_CREATED),
    'notifyNewEnrollment'
  );
  assert.equal(
    resolveNotificationPreferenceKey(NOTIFICATION_EVENT_TYPES.DOCUMENT_PENDING),
    'notifyDocumentPending'
  );
  assert.equal(
    resolveNotificationPreferenceKey(NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED),
    'notifyMessagePosted'
  );
  assert.equal(
    resolveNotificationPreferenceKey(NOTIFICATION_EVENT_TYPES.ACCESS_RESET),
    'notifyAccessReset'
  );

  assert.equal(
    isNotificationEventEnabled({ notifyMessagePosted: false }, NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED),
    false
  );
});

test('access reset templates keep inbox and email bodies free from temporary passwords', () => {
  const template = buildNotificationTemplate({
    eventType: NOTIFICATION_EVENT_TYPES.ACCESS_RESET,
    payload: {
      actorName: 'Coordenacao',
    },
    secrets: {
      tempPassword: 'Senha#123',
    },
  });

  assert.match(template.body, /Coordenacao redefiniu seu acesso/);
  assert.doesNotMatch(template.body, /Senha#123/);
  assert.doesNotMatch(template.emailText, /Senha#123/);
  assert.equal(template.emailText, template.body);
});

test('notification records normalize recipient email, channels and redact sensitive metadata', () => {
  const record = buildNotificationRecord({
    eventType: NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED,
    recipient: {
      email: 'Aluno@Escola.com',
      name: 'Aluno Teste',
      profileType: 'aluno',
    },
    channels: [NOTIFICATION_CHANNELS.APP, NOTIFICATION_CHANNELS.EMAIL, 'sms'],
    template: buildNotificationTemplate({
      eventType: NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED,
      payload: {
        subject: 'Aviso',
        content: 'Aula suspensa amanha.',
        senderName: 'Prof. Ana',
      },
    }),
    metadata: {
      temp_password: 'nao-persistir',
      nested: {
        authorization: 'Bearer secret',
      },
    },
    tenantId: '11111111-1111-1111-1111-111111111111',
  });

  assert.equal(record.tenant_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(record.recipient_email, 'aluno@escola.com');
  assert.deepEqual(record.channels, ['app', 'email']);
  assert.equal(record.email_status, NOTIFICATION_EMAIL_STATUSES.PENDING);
  assert.deepEqual(record.metadata, {
    temp_password: '[redacted]',
    nested: {
      authorization: '[redacted]',
    },
  });
});

test('notification premium foundation maps event types and keeps dispatch job metadata ready for future queueing', () => {
  const sourceEventType = resolveSystemEventTypeFromNotificationEvent(
    NOTIFICATION_EVENT_TYPES.MESSAGE_POSTED
  );

  const baseJob = createSystemJobDescriptor({
    jobType: SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
    eventType: sourceEventType,
    recordId: 'message-123',
    requestedBy: 'admin@example.com',
    idempotencyParts: [
      SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH,
      SYSTEM_EVENT_TYPES.MESSAGE_POSTED,
      'message-123',
      'req-1',
    ],
    metadata: {
      source: 'api/messages',
      request_id: 'req-1',
      temp_password: 'nao-persistir',
    },
  });

  const completedJob = finalizeSystemJobDescriptor(baseJob, {
    eventType: SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_COMPLETED,
    metadata: {
      recipient_count: 3,
    },
  });

  assert.equal(sourceEventType, SYSTEM_EVENT_TYPES.MESSAGE_POSTED);
  assert.equal(completedJob.jobType, SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH);
  assert.equal(completedJob.eventType, SYSTEM_EVENT_TYPES.NOTIFICATION_DISPATCH_COMPLETED);
  assert.equal(completedJob.queue, 'notifications');
  assert.equal(completedJob.metadata.temp_password, '[redacted]');
  assert.equal(completedJob.metadata.recipient_count, 3);
  assert.equal(completedJob.metadata.request_id, 'req-1');
  assert.equal(
    completedJob.idempotencyKey,
    'notification.dispatch:message.posted:message-123:req-1'
  );
});

test('notifications migration provisions app settings toggles and the persisted inbox table', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_notifications_base.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /notify_document_pending/);
  assert.match(migration, /notify_message_posted/);
  assert.match(migration, /notify_access_reset/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS notifications/);
  assert.match(migration, /idx_notifications_recipient_email_created_at/);
  assert.match(migration, /ALTER TABLE notifications ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE POLICY "users read own notifications"/);
  assert.match(migration, /DROP POLICY IF EXISTS "messages_insert_staff" ON messages/);
  assert.match(migration, /DROP POLICY IF EXISTS "student write class messages" ON messages/);
});

test('priority jobs catalog keeps notifications and exports prepared for inline-to-queue evolution', () => {
  const jobs = listPriorityJobs();
  const notificationJob = jobs.find((job) => job.jobType === SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH);
  const exportJob = jobs.find((job) => job.jobType === SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION);

  assert.equal(notificationJob.executionMode, 'inline');
  assert.ok(notificationJob.eventTypes.includes(SYSTEM_EVENT_TYPES.MESSAGE_POSTED));
  assert.equal(exportJob.executionMode, 'inline');
  assert.ok(exportJob.eventTypes.includes(SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED));
});

test('notifications inbox endpoint supports authenticated GET listing alongside mark-all-read', () => {
  const handlerSource = fs.readFileSync(
    new URL('../backend/src/routes/notifications/index.js', import.meta.url),
    'utf8'
  );

  assert.match(handlerSource, /if \(req\.method === 'GET'\)/);
  assert.match(handlerSource, /const notificationClient = createRequestScopedClient\(req\);/);
  assert.match(handlerSource, /listNotificationsForRecipient\(\{/);
  assert.match(handlerSource, /recipientEmail: requester\.user\.email/);
  assert.match(handlerSource, /client: notificationClient/);
  assert.match(handlerSource, /tenantId: requester\.tenantId \|\| null/);
  assert.match(handlerSource, /includeDismissed: dismissed === 'true'/);
  assert.match(handlerSource, /if \(req\.method === 'PATCH'\)/);
  assert.match(handlerSource, /res\.setHeader\('Allow', 'GET, PATCH'\)/);
});

test('notifications server lists inbox rows by authenticated recipient with stable ordering and optional dismissed filter', () => {
  const serverSource = fs.readFileSync(
    new URL('../backend/src/services/notificationsServer.js', import.meta.url),
    'utf8'
  );

  assert.match(serverSource, /export async function listNotificationsForRecipient\(/);
  assert.match(serverSource, /function applyTenantScope\(query, tenantId = null\)/);
  assert.match(serverSource, /\.eq\('recipient_email', normalizedRecipientEmail\)/);
  assert.match(serverSource, /query = applyTenantScope\(query, tenantId\);/);
  assert.match(serverSource, /\.order\('created_at', \{ ascending: false \}\)/);
  assert.match(serverSource, /\.limit\(safeLimit\)/);
  assert.match(serverSource, /if \(!includeDismissed\) \{\s*query = query\.is\('dismissed_at', null\);/s);
  assert.match(serverSource, /code: isNotificationsTableUnavailable\(error\)\s*\?\s*'NOTIFICATION_TABLE_UNAVAILABLE'/);
});

test('multi-tenant administrative export is blocked until all datasets become tenant-aware', () => {
  const handlerSource = fs.readFileSync(
    new URL('../backend/src/routes/admin/system-export.js', import.meta.url),
    'utf8'
  );

  assert.match(handlerSource, /if \(requester\.tenantId\)/);
  assert.match(handlerSource, /SYSTEM_EXPORT_MULTI_TENANT_FORBIDDEN/);
});
