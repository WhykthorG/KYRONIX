-- Chat realtime suite: multimedia messages, conversations, calls and private storage

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT current_tenant_id(),
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS media_metadata JSONB,
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'direct_messages_message_type_check'
  ) THEN
    ALTER TABLE public.direct_messages
      ADD CONSTRAINT direct_messages_message_type_check
      CHECK (message_type IN ('text','voice','system','call_event'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID DEFAULT current_tenant_id(),
  type              TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  direct_key        TEXT,
  title             TEXT,
  created_by_email  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER trg_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.chat_conversation_participants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID DEFAULT current_tenant_id(),
  conversation_id    UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  participant_email  TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, participant_email)
);

CREATE TABLE IF NOT EXISTS public.chat_call_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID DEFAULT current_tenant_id(),
  conversation_id   TEXT NOT NULL,
  initiator_email   TEXT NOT NULL,
  recipient_email   TEXT NOT NULL,
  call_type         TEXT NOT NULL CHECK (call_type IN ('audio','video')),
  status            TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','missed','declined','failed')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.chat_call_signals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID DEFAULT current_tenant_id(),
  call_session_id  UUID NOT NULL REFERENCES public.chat_call_sessions(id) ON DELETE CASCADE,
  conversation_id  TEXT NOT NULL,
  sender_email     TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  signal_type      TEXT NOT NULL CHECK (signal_type IN ('offer','answer','ice_candidate','hangup')),
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_call_participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID DEFAULT current_tenant_id(),
  call_session_id   UUID NOT NULL REFERENCES public.chat_call_sessions(id) ON DELETE CASCADE,
  participant_email TEXT NOT NULL,
  joined_at         TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','joined','left','declined')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (call_session_id, participant_email)
);

CREATE TABLE IF NOT EXISTS public.chat_call_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID DEFAULT current_tenant_id(),
  call_session_id  UUID NOT NULL REFERENCES public.chat_call_sessions(id) ON DELETE CASCADE,
  bucket           TEXT NOT NULL DEFAULT 'chat-recordings',
  file_path        TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  duration_seconds INTEGER,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_tenant_created_at
  ON public.direct_messages(conversation_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_message_type
  ON public.direct_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_direct_messages_attachments_gin
  ON public.direct_messages USING GIN (attachments);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_participants_email
  ON public.chat_conversation_participants(participant_email, tenant_id, joined_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_direct_key_unique
  ON public.chat_conversations(tenant_id, direct_key) NULLS NOT DISTINCT
  WHERE type = 'direct' AND direct_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_call_sessions_conversation_started_at
  ON public.chat_call_sessions(conversation_id, tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_call_signals_session_created_at
  ON public.chat_call_signals(call_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_call_participants_session_email
  ON public.chat_call_participants(call_session_id, participant_email);
CREATE INDEX IF NOT EXISTS idx_chat_call_recordings_expires_at
  ON public.chat_call_recordings(expires_at);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_call_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_conversations_select_participant" ON public.chat_conversations;
CREATE POLICY "chat_conversations_select_participant" ON public.chat_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_conversation_participants participant
      WHERE participant.conversation_id = chat_conversations.id
        AND participant.participant_email = auth.jwt() ->> 'email'
        AND tenant_matches_current(participant.tenant_id)
    )
    AND tenant_matches_current(chat_conversations.tenant_id)
  );

DROP POLICY IF EXISTS "chat_conversations_insert_authenticated" ON public.chat_conversations;
CREATE POLICY "chat_conversations_insert_authenticated" ON public.chat_conversations
  FOR INSERT WITH CHECK (
    created_by_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_conversation_participants_select_own" ON public.chat_conversation_participants;
CREATE POLICY "chat_conversation_participants_select_own" ON public.chat_conversation_participants
  FOR SELECT USING (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_conversation_participants_insert_owner" ON public.chat_conversation_participants;
CREATE POLICY "chat_conversation_participants_insert_owner" ON public.chat_conversation_participants
  FOR INSERT WITH CHECK (
    tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "dm_select_own" ON public.direct_messages;
CREATE POLICY "dm_select_own" ON public.direct_messages
  FOR SELECT USING (
    (
      sender_email = auth.jwt() ->> 'email'
      OR recipient_email = auth.jwt() ->> 'email'
      OR EXISTS (
        SELECT 1
        FROM public.chat_conversation_participants participant
        WHERE participant.participant_email = auth.jwt() ->> 'email'
          AND participant.conversation_id::text = direct_messages.conversation_id
      )
    )
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "dm_insert_sender_only" ON public.direct_messages;
CREATE POLICY "dm_insert_sender_only" ON public.direct_messages
  FOR INSERT WITH CHECK (
    sender_email = auth.jwt() ->> 'email'
    AND content IS NOT NULL
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "dm_update_recipient_read" ON public.direct_messages;
CREATE POLICY "dm_update_recipient_read" ON public.direct_messages
  FOR UPDATE
  USING (
    (
      recipient_email = auth.jwt() ->> 'email'
      OR EXISTS (
        SELECT 1
        FROM public.chat_conversation_participants participant
        WHERE participant.participant_email = auth.jwt() ->> 'email'
          AND participant.conversation_id::text = direct_messages.conversation_id
      )
    )
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    (
      recipient_email = auth.jwt() ->> 'email'
      OR EXISTS (
        SELECT 1
        FROM public.chat_conversation_participants participant
        WHERE participant.participant_email = auth.jwt() ->> 'email'
          AND participant.conversation_id::text = direct_messages.conversation_id
      )
    )
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_sessions_select_participant" ON public.chat_call_sessions;
CREATE POLICY "chat_call_sessions_select_participant" ON public.chat_call_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_call_participants participant
      WHERE participant.call_session_id = chat_call_sessions.id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_sessions_insert_initiator" ON public.chat_call_sessions;
CREATE POLICY "chat_call_sessions_insert_initiator" ON public.chat_call_sessions
  FOR INSERT WITH CHECK (
    initiator_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_sessions_update_participant" ON public.chat_call_sessions;
CREATE POLICY "chat_call_sessions_update_participant" ON public.chat_call_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.chat_call_participants participant
      WHERE participant.call_session_id = chat_call_sessions.id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_call_participants participant
      WHERE participant.call_session_id = chat_call_sessions.id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_signals_select_participant" ON public.chat_call_signals;
CREATE POLICY "chat_call_signals_select_participant" ON public.chat_call_signals
  FOR SELECT USING (
    (sender_email = auth.jwt() ->> 'email' OR recipient_email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_signals_insert_sender" ON public.chat_call_signals;
CREATE POLICY "chat_call_signals_insert_sender" ON public.chat_call_signals
  FOR INSERT WITH CHECK (
    sender_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_participants_select_participant" ON public.chat_call_participants;
CREATE POLICY "chat_call_participants_select_participant" ON public.chat_call_participants
  FOR SELECT USING (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_participants_insert_participant" ON public.chat_call_participants;
CREATE POLICY "chat_call_participants_insert_participant" ON public.chat_call_participants
  FOR INSERT WITH CHECK (
    tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_participants_update_participant" ON public.chat_call_participants;
CREATE POLICY "chat_call_participants_update_participant" ON public.chat_call_participants
  FOR UPDATE USING (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_call_recordings_select_participant" ON public.chat_call_recordings;
CREATE POLICY "chat_call_recordings_select_participant" ON public.chat_call_recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_call_participants participant
      WHERE participant.call_session_id = chat_call_recordings.call_session_id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "chat_voice_upload_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_voice_read_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_voice_delete_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_recordings_upload_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_recordings_read_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_recordings_delete_participant" ON storage.objects;

CREATE POLICY "chat_voice_upload_participant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-voice'
    AND split_part(name, '/', 1) = 'direct'
    AND position(lower(auth.jwt() ->> 'email') IN split_part(name, '/', 2)) > 0
  );

CREATE POLICY "chat_voice_read_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND split_part(name, '/', 1) = 'direct'
    AND position(lower(auth.jwt() ->> 'email') IN split_part(name, '/', 2)) > 0
  );

CREATE POLICY "chat_voice_delete_participant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND split_part(name, '/', 1) = 'direct'
    AND position(lower(auth.jwt() ->> 'email') IN split_part(name, '/', 2)) > 0
  );

CREATE POLICY "chat_recordings_upload_participant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-recordings'
    AND split_part(name, '/', 1) = 'recordings'
    AND EXISTS (
      SELECT 1
      FROM public.chat_call_participants participant
      WHERE participant.call_session_id::text = split_part(name, '/', 2)
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "chat_recordings_read_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-recordings'
    AND split_part(name, '/', 1) = 'recordings'
    AND EXISTS (
      SELECT 1
      FROM public.chat_call_participants participant
      WHERE participant.call_session_id::text = split_part(name, '/', 2)
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "chat_recordings_delete_participant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-recordings'
    AND split_part(name, '/', 1) = 'recordings'
    AND EXISTS (
      SELECT 1
      FROM public.chat_call_participants participant
      WHERE participant.call_session_id::text = split_part(name, '/', 2)
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
  );
