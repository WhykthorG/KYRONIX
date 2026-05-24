import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildDirectConversationId,
  CHAT_CALL_RINGING_TIMEOUT_MS,
  buildDirectMessagePayload,
  CHAT_BUCKETS,
  CHAT_CALL_TYPES,
  CHAT_MESSAGE_TYPES,
  CHAT_SIGNAL_TYPES,
} from '../shared/src/contracts/chat.js';
import {
  chatCallSignalSchema,
  chatCallStartSchema,
  chatMediaUrlSchema,
} from '../backend/src/middlewares/requestSchemas.js';

test('buildDirectConversationId sorts e-mails deterministically', () => {
  const conversationId = buildDirectConversationId('professor@escola.com', 'aluno@escola.com');
  assert.equal(conversationId, 'aluno@escola.com__professor@escola.com');
});

test('buildDirectMessagePayload supports text and voice messages', () => {
  const baseArgs = {
    currentUser: {
      email: 'professor@escola.com',
      full_name: 'Professora Ana',
    },
    contact: {
      email: 'aluno@escola.com',
      name: 'Aluno',
    },
  };

  const textPayload = buildDirectMessagePayload({
    ...baseArgs,
    content: 'Mensagem de teste',
  });

  const voicePayload = buildDirectMessagePayload({
    ...baseArgs,
    content: '',
    messageType: CHAT_MESSAGE_TYPES.VOICE,
    attachments: [{
      type: 'audio',
      bucket: CHAT_BUCKETS.VOICE,
      path: 'direct/aluno@escola.com__professor@escola.com/audio.webm',
      durationMs: 4200,
    }],
  });

  assert.equal(textPayload.message_type, CHAT_MESSAGE_TYPES.TEXT);
  assert.equal(voicePayload.message_type, CHAT_MESSAGE_TYPES.VOICE);
  assert.equal(voicePayload.attachments[0].bucket, CHAT_BUCKETS.VOICE);
});

test('chat request schemas validate media and signaling payloads', () => {
  const uploadParse = chatMediaUrlSchema.safeParse({
    action: 'upload',
    bucket: CHAT_BUCKETS.VOICE,
    conversationId: 'aluno@escola.com__professor@escola.com',
    fileName: 'audio.webm',
    contentType: 'audio/webm',
  });
  const startParse = chatCallStartSchema.safeParse({
    conversationId: 'aluno@escola.com__professor@escola.com',
    recipientEmail: 'aluno@escola.com',
    callType: CHAT_CALL_TYPES.VIDEO,
  });
  const signalParse = chatCallSignalSchema.safeParse({
    signalType: CHAT_SIGNAL_TYPES.OFFER,
    recipientEmail: 'aluno@escola.com',
    payload: { type: 'offer', sdp: 'v=0' },
  });

  assert.equal(uploadParse.success, true);
  assert.equal(startParse.success, true);
  assert.equal(signalParse.success, true);
});

test('chat migration and schema snapshot include multimedia and rtc tables', () => {
  const migration = fs.readFileSync(new URL('../supabase/migration_chat_realtime_suite.sql', import.meta.url), 'utf8');
  const academicGroupsMigration = fs.readFileSync(new URL('../supabase/migration_chat_academic_groups.sql', import.meta.url), 'utf8');
  const directDedupMigration = fs.readFileSync(new URL('../supabase/migration_chat_direct_conversation_dedup.sql', import.meta.url), 'utf8');
  const callHardeningMigration = fs.readFileSync(new URL('../supabase/migration_chat_call_hardening.sql', import.meta.url), 'utf8');
  const schema = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

  assert.match(migration, /ALTER TABLE public\.direct_messages/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_conversations/);
  assert.match(migration, /direct_key\s+TEXT/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_call_sessions/);
  assert.match(migration, /CREATE POLICY "chat_call_signals_insert_sender"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.chat_call_participants/);
  assert.match(migration, /CREATE POLICY "chat_voice_upload_participant"/);
  assert.match(migration, /CREATE POLICY "chat_recordings_read_participant"/);
  assert.match(directDedupMigration, /ADD COLUMN IF NOT EXISTS direct_key TEXT/);
  assert.match(directDedupMigration, /UPDATE public\.direct_messages message/);
  assert.match(directDedupMigration, /UPDATE public\.chat_call_sessions session/);
  assert.match(directDedupMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_direct_key_unique/);
  assert.match(callHardeningMigration, /idx_chat_call_sessions_status_started_at/);
  assert.match(callHardeningMigration, /idx_chat_call_sessions_conversation_status_started_at/);
  assert.match(callHardeningMigration, /idx_chat_call_participants_email_session/);
  assert.match(academicGroupsMigration, /CREATE TABLE IF NOT EXISTS public\.chat_academic_groups/);
  assert.match(academicGroupsMigration, /idx_chat_academic_groups_unique/);
  assert.match(academicGroupsMigration, /CREATE OR REPLACE FUNCTION public\.sync_chat_academic_group/);
  assert.match(academicGroupsMigration, /CREATE OR REPLACE FUNCTION public\.sync_all_chat_academic_groups/);
  assert.match(academicGroupsMigration, /CREATE TRIGGER trg_sync_chat_academic_groups_schedules/);
  assert.match(academicGroupsMigration, /CREATE TRIGGER trg_sync_chat_academic_groups_students/);
  assert.match(academicGroupsMigration, /CREATE TRIGGER trg_sync_chat_academic_groups_classes/);
  assert.match(academicGroupsMigration, /CREATE TRIGGER trg_sync_chat_academic_groups_subjects/);
  assert.match(academicGroupsMigration, /CREATE TRIGGER trg_sync_chat_academic_groups_teachers/);
  assert.match(academicGroupsMigration, /CREATE TRIGGER trg_sync_chat_academic_groups_user_profiles/);

  assert.match(schema, /message_type\s+TEXT NOT NULL DEFAULT 'text'/);
  assert.match(schema, /direct_key\s+TEXT/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS chat_academic_groups/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_direct_key_unique/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_academic_groups_unique/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS chat_call_signals/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS chat_call_participants/);
  assert.match(schema, /idx_chat_call_sessions_status_started_at/);
  assert.match(schema, /idx_chat_call_participants_email_session/);
  assert.match(schema, /CREATE POLICY "chat_call_sessions_select_participant"/);
  assert.match(schema, /CREATE POLICY "chat_voice_read_participant"/);
});

test('chat API routes are wired to signed media URLs and signaling storage', () => {
  const mediaRoute = fs.readFileSync(new URL('../backend/src/routes/chat/media-url.js', import.meta.url), 'utf8');
  const signalRoute = fs.readFileSync(new URL('../backend/src/routes/chat/calls/[callId]/signals.js', import.meta.url), 'utf8');
  const endRoute = fs.readFileSync(new URL('../backend/src/routes/chat/calls/[callId]/end.js', import.meta.url), 'utf8');
  const recordingsRoute = fs.readFileSync(new URL('../backend/src/routes/chat/calls/[callId]/recordings.js', import.meta.url), 'utf8');
  const startRoute = fs.readFileSync(new URL('../backend/src/routes/chat/calls/start.js', import.meta.url), 'utf8');
  const conversationsRoute = fs.readFileSync(new URL('../backend/src/routes/chat/conversations/index.js', import.meta.url), 'utf8');
  const chatWindow = fs.readFileSync(new URL('../frontend/src/components/chat/ChatWindow.jsx', import.meta.url), 'utf8');

  assert.match(mediaRoute, /createSignedUploadUrl/);
  assert.match(mediaRoute, /createSignedUrl/);
  assert.match(signalRoute, /chat_call_signals/);
  assert.match(endRoute, /chatCallEndSchema/);
  assert.match(endRoute, /payload\.status/);
  assert.match(recordingsRoute, /chat_call_recordings/);
  assert.match(recordingsRoute, /duration_seconds/);
  assert.match(startRoute, /findLatestLiveCallForConversation/);
  assert.match(startRoute, /ensureCallParticipants/);
  assert.match(startRoute, /reused: true/);
  assert.match(conversationsRoute, /hydrateConversationParticipants/);
  assert.match(conversationsRoute, /hydrateConversationLatestMessages/);
  assert.match(conversationsRoute, /CHAT_DIRECT_PARTICIPANTS_INVALID/);
  assert.match(conversationsRoute, /direct_key/);
  assert.match(conversationsRoute, /buildDirectConversationId/);
  assert.match(conversationsRoute, /onConflict: 'conversation_id,participant_email'/);
  assert.match(conversationsRoute, /chat_conversations\(\*\)/);
  assert.match(chatWindow, /CHAT_CALL_RINGING_TIMEOUT_MS/);
  assert.match(chatWindow, /buildRtcConfiguration/);
  assert.match(chatWindow, /queuePendingSignal/);
  assert.match(chatWindow, /finishCall\(CHAT_CALL_STATUSES\.DECLINED\)/);
  assert.equal(typeof CHAT_CALL_RINGING_TIMEOUT_MS, 'number');
});
