// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildMessagePayload,
  filterMessagesForStudent,
  MESSAGE_CHANNELS,
  MESSAGE_PRIORITIES,
  MESSAGE_RECIPIENT_TYPES,
  MESSAGE_STATUSES,
  normalizeMessageRecipientType,
  normalizeMessageStatus,
} from '../shared/src/contracts/messages.js';

test('buildMessagePayload creates a schema-compatible class message for staff', () => {
  const payload = buildMessagePayload({
    formData: {
      recipient_type: MESSAGE_RECIPIENT_TYPES.CLASS,
      class_id: 'class-1',
      subject: 'Aviso',
      content: 'Entrega amanhã',
      priority: MESSAGE_PRIORITIES.HIGH,
      category: 'comunicado',
      channels: [MESSAGE_CHANNELS.APP, MESSAGE_CHANNELS.EMAIL],
    },
    sender: {
      id: 'auth-user-1',
      email: 'professor@escola.com',
    },
    senderType: 'professor',
    now: '2026-03-30T12:00:00.000Z',
  });

  assert.equal(payload.recipient_type, MESSAGE_RECIPIENT_TYPES.CLASS);
  assert.equal(payload.class_id, 'class-1');
  assert.equal(payload.status, MESSAGE_STATUSES.SENT);
  assert.deepEqual(payload.channels, [MESSAGE_CHANNELS.APP, MESSAGE_CHANNELS.EMAIL]);
});

test('buildMessagePayload forces student messages to the current class', () => {
  const payload = buildMessagePayload({
    formData: {
      recipient_type: MESSAGE_RECIPIENT_TYPES.ALL,
      subject: 'Dúvida',
      content: 'Professor, preciso de ajuda.',
      channels: [MESSAGE_CHANNELS.APP, MESSAGE_CHANNELS.EMAIL],
    },
    sender: {
      id: 'student-auth-id',
      email: 'aluno@escola.com',
    },
    senderType: 'aluno',
    studentContext: {
      id: 'student-record-id',
      current_class_id: 'class-42',
    },
    now: '2026-03-30T12:00:00.000Z',
  });

  assert.equal(payload.recipient_type, MESSAGE_RECIPIENT_TYPES.CLASS);
  assert.equal(payload.class_id, 'class-42');
  assert.equal(payload.status, MESSAGE_STATUSES.SENT);
  assert.deepEqual(payload.channels, [MESSAGE_CHANNELS.APP]);
});

test('buildMessagePayload normalizes blank class ids to null for broadcast messages', () => {
  const payload = buildMessagePayload({
    formData: {
      recipient_type: MESSAGE_RECIPIENT_TYPES.ALL,
      class_id: '',
      subject: 'Aviso geral',
      content: 'Comunicado para todos.',
      channels: [MESSAGE_CHANNELS.APP],
    },
    sender: {
      id: 'staff-auth-id',
      email: 'coord@escola.com',
    },
    senderType: 'coordenador',
    now: '2026-03-31T15:00:00.000Z',
  });

  assert.equal(payload.recipient_type, MESSAGE_RECIPIENT_TYPES.ALL);
  assert.equal(payload.class_id, null);
});

test('message contracts normalize legacy aliases and keep student visibility coherent', () => {
  assert.equal(normalizeMessageRecipientType('individual'), MESSAGE_RECIPIENT_TYPES.STUDENT);
  assert.equal(normalizeMessageStatus('enviada'), MESSAGE_STATUSES.SENT);

  const visibleMessages = filterMessagesForStudent([
    { id: '1', recipient_type: 'todos' },
    { id: '2', recipient_type: 'turma', class_id: 'class-1' },
    { id: '3', recipient_type: 'aluno', recipient_ids: ['student-1'] },
    { id: '4', recipient_type: 'aluno', recipient_ids: ['student-2'] },
  ], {
    id: 'student-1',
    current_class_id: 'class-1',
  });

  assert.deepEqual(visibleMessages.map((message) => message.id), ['1', '2', '3']);
});

test('security migrations preserve student class-message insert policy', () => {
  const baselineMigration = fs.readFileSync(new URL('../supabase/migration_security_baseline.sql', import.meta.url), 'utf8');
  const hardeningMigration = fs.readFileSync(new URL('../supabase/migration_permissions_hardening.sql', import.meta.url), 'utf8');

  assert.match(baselineMigration, /CREATE POLICY "messages_insert_student_class"/);
  assert.match(baselineMigration, /auth_profile_type\(\) = 'aluno'/);
  assert.match(hardeningMigration, /CREATE POLICY "messages_insert_student_class"/);
  assert.match(hardeningMigration, /recipient_type = 'turma'/);
});

test('enterprise hardening adds message integrity constraints and audience indexes', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_hardening_enterprise.sql', import.meta.url),
    'utf8'
  );
  const schema = fs.readFileSync(
    new URL('../supabase/schema.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /messages_subject_not_blank_check/);
  assert.match(migration, /messages_content_not_blank_check/);
  assert.match(migration, /messages_channels_known_values_check/);
  assert.match(migration, /messages_recipient_class_required_check/);
  assert.match(migration, /messages_recipient_ids_required_check/);
  assert.match(migration, /idx_messages_recipient_type_class_created_at/);
  assert.match(migration, /idx_messages_recipient_ids_gin/);

  assert.match(schema, /subject\s+TEXT NOT NULL CHECK \(NULLIF\(BTRIM\(subject\), ''\) IS NOT NULL\)/);
  assert.match(schema, /content\s+TEXT NOT NULL CHECK \(NULLIF\(BTRIM\(content\), ''\) IS NOT NULL\)/);
  assert.match(schema, /channels\s+TEXT\[\] NOT NULL DEFAULT '\{\}' CHECK \(channels <@ ARRAY\['app','email'\]::TEXT\[\]\)/);
  assert.match(schema, /CONSTRAINT messages_recipient_class_required_check/);
  assert.match(schema, /CONSTRAINT messages_recipient_ids_required_check/);
  assert.match(schema, /CREATE INDEX idx_messages_recipient_type_class_created_at/);
  assert.match(schema, /CREATE INDEX idx_messages_recipient_ids_gin/);
});
