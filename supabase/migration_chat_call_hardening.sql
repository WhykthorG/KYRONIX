-- Hardening for chat call session lookup and timeout/conflict checks.

CREATE INDEX IF NOT EXISTS idx_chat_call_sessions_status_started_at
  ON public.chat_call_sessions(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_call_sessions_conversation_status_started_at
  ON public.chat_call_sessions(conversation_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_call_participants_email_session
  ON public.chat_call_participants(participant_email, call_session_id);
