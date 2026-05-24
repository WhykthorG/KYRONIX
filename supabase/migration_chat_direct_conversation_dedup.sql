-- Canonical direct conversations: collapse duplicates and enforce one conversation per pair.

CREATE OR REPLACE FUNCTION public.normalize_chat_participant_email(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(trim(COALESCE(p_value, ''))), '');
$$;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS direct_key TEXT;

WITH direct_participants AS (
  SELECT
    conversation_id,
    MIN(normalize_chat_participant_email(participant_email)) AS first_email,
    MAX(normalize_chat_participant_email(participant_email)) AS second_email,
    COUNT(DISTINCT normalize_chat_participant_email(participant_email)) AS participant_count
  FROM public.chat_conversation_participants
  GROUP BY conversation_id
)
UPDATE public.chat_conversations conversation
   SET direct_key = CASE
     WHEN direct_participants.participant_count = 2
       AND direct_participants.first_email IS NOT NULL
       AND direct_participants.second_email IS NOT NULL
       THEN direct_participants.first_email || '__' || direct_participants.second_email
     ELSE NULL
   END
  FROM direct_participants
 WHERE conversation.id = direct_participants.conversation_id
   AND conversation.type = 'direct';

CREATE TEMP TABLE tmp_chat_direct_duplicates ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    tenant_id,
    direct_key,
    FIRST_VALUE(id) OVER (
      PARTITION BY tenant_id, direct_key
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, direct_key
      ORDER BY created_at ASC, id ASC
    ) AS row_number
  FROM public.chat_conversations
  WHERE type = 'direct'
    AND direct_key IS NOT NULL
)
SELECT
  id AS duplicate_id,
  canonical_id
FROM ranked
WHERE row_number > 1;

UPDATE public.direct_messages message
   SET conversation_id = duplicate.canonical_id::TEXT
  FROM tmp_chat_direct_duplicates duplicate
 WHERE message.conversation_id = duplicate.duplicate_id::TEXT;

UPDATE public.chat_call_sessions session
   SET conversation_id = duplicate.canonical_id::TEXT
  FROM tmp_chat_direct_duplicates duplicate
 WHERE session.conversation_id = duplicate.duplicate_id::TEXT;

UPDATE public.chat_call_signals signal
   SET conversation_id = duplicate.canonical_id::TEXT
  FROM tmp_chat_direct_duplicates duplicate
 WHERE signal.conversation_id = duplicate.duplicate_id::TEXT;

WITH merged_participants AS (
  SELECT
    participant.tenant_id,
    duplicate.canonical_id AS conversation_id,
    participant.participant_email,
    CASE
      WHEN BOOL_OR(participant.role = 'owner') THEN 'owner'
      ELSE 'member'
    END AS role,
    MIN(participant.joined_at) AS joined_at
  FROM public.chat_conversation_participants participant
  JOIN tmp_chat_direct_duplicates duplicate
    ON duplicate.duplicate_id = participant.conversation_id
  GROUP BY
    participant.tenant_id,
    duplicate.canonical_id,
    participant.participant_email
)
INSERT INTO public.chat_conversation_participants (
  tenant_id,
  conversation_id,
  participant_email,
  role,
  joined_at
)
SELECT
  tenant_id,
  conversation_id,
  participant_email,
  role,
  joined_at
FROM merged_participants
ON CONFLICT (conversation_id, participant_email) DO UPDATE
SET
  role = CASE
    WHEN EXCLUDED.role = 'owner' THEN 'owner'
    ELSE public.chat_conversation_participants.role
  END,
  joined_at = LEAST(public.chat_conversation_participants.joined_at, EXCLUDED.joined_at);

DELETE FROM public.chat_conversations conversation
USING tmp_chat_direct_duplicates duplicate
WHERE conversation.id = duplicate.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_direct_key_unique
  ON public.chat_conversations(tenant_id, direct_key) NULLS NOT DISTINCT
  WHERE type = 'direct' AND direct_key IS NOT NULL;

