// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildSystemJobResponseHeaders,
  listFutureAiBacklog,
  listSystemEventMap,
  parseSystemJobResponseHeaders,
  SYSTEM_EVENT_TYPES,
  SYSTEM_JOB_HEADER_NAMES,
  SYSTEM_JOB_TYPES,
} from '../shared/src/contracts/systemEvents.js';

test('system event map keeps current producers and future extension points documented', () => {
  const eventMap = listSystemEventMap();
  const messagePosted = eventMap.find((event) => event.eventType === SYSTEM_EVENT_TYPES.MESSAGE_POSTED);
  const exportCompleted = eventMap.find((event) => event.eventType === SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED);

  assert.ok(messagePosted.currentProducers.includes('api/messages/index.js'));
  assert.equal(messagePosted.primaryJobType, SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH);
  assert.ok(messagePosted.futureConsumers.includes('ai.message-summary'));

  assert.ok(exportCompleted.currentProducers.includes('backend/src/services/systemExportServer.js'));
  assert.equal(exportCompleted.primaryJobType, SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION);
  assert.ok(exportCompleted.futureConsumers.includes('ai.export-anomaly-scan'));
});

test('premium foundation documentation lists event map, jobs and ai backlog', () => {
  const documentation = fs.readFileSync(
    new URL('../docs/premium-foundation.md', import.meta.url),
    'utf8'
  );
  const backlog = listFutureAiBacklog();

  assert.match(documentation, /Event map prioritario/);
  assert.match(documentation, /notification\.dispatch/);
  assert.match(documentation, /system\.export\.generation/);
  assert.match(documentation, /Backlog tecnico de IA futura/);

  assert.equal(backlog.length, 3);
  assert.equal(backlog[0].dependsOnJobType, SYSTEM_JOB_TYPES.NOTIFICATION_DISPATCH);
  assert.equal(backlog[2].triggerEventType, SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED);
});

test('system job headers expose the same contract to backend downloads and frontend clients', () => {
  const headers = buildSystemJobResponseHeaders({
    jobType: SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
    status: 'completed',
    eventType: SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED,
    queue: 'exports',
    executionMode: 'inline',
    idempotencyKey: 'system.export.generation:xlsx:all:admin@example.com:req-1',
    metadata: {
      request_id: 'req-1',
    },
  });

  assert.equal(headers[SYSTEM_JOB_HEADER_NAMES.TYPE], SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION);
  assert.equal(headers[SYSTEM_JOB_HEADER_NAMES.REQUEST_ID], 'req-1');

  const parsed = parseSystemJobResponseHeaders({
    'X-System-Job-Type': SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
    'X-System-Job-Status': 'completed',
    'X-System-Job-Event-Type': SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED,
    'X-System-Job-Queue': 'exports',
    'X-System-Job-Execution-Mode': 'inline',
    'X-System-Job-Idempotency-Key': 'system.export.generation:xlsx:all:admin@example.com:req-1',
    'X-System-Job-Request-Id': 'req-1',
  });

  assert.equal(parsed.jobType, SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION);
  assert.equal(parsed.eventType, SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED);
  assert.equal(parsed.requestId, 'req-1');
});

test('notification-producing http routes and clients reuse the same system job header contract', () => {
  const messageHandler = fs.readFileSync(
    new URL('../backend/src/routes/messages/index.js', import.meta.url),
    'utf8'
  );
  const resetHandler = fs.readFileSync(
    new URL('../backend/src/routes/admin/users/[userId].js', import.meta.url),
    'utf8'
  );
  const notificationsClient = fs.readFileSync(
    new URL('../frontend/src/lib/notificationsClient.js', import.meta.url),
    'utf8'
  );
  const adminClient = fs.readFileSync(
    new URL('../frontend/src/lib/supabaseAdmin.js', import.meta.url),
    'utf8'
  );
  const documentation = fs.readFileSync(
    new URL('../docs/premium-foundation.md', import.meta.url),
    'utf8'
  );

  assert.match(messageHandler, /buildSystemJobResponseHeaders\(notificationDispatch\?\.job\)/);
  assert.match(resetHandler, /buildSystemJobResponseHeaders\(notificationDispatch\?\.job\)/);
  assert.match(notificationsClient, /parseSystemJobResponseHeaders\(response\.headers\)/);
  assert.match(adminClient, /parseSystemJobResponseHeaders\(response\.headers\)/);
  assert.match(documentation, /notification\.dispatch/);
  assert.match(documentation, /X-System-Job-\*/);
});
