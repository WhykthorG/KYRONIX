BEGIN;

ALTER TABLE public.observability_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.observability_logs ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_tenant_created_at
  ON public.notifications(recipient_email, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_logs_tenant_created_at
  ON public.observability_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_type_class_created_at
  ON public.messages(recipient_type, class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_ids_gin
  ON public.messages USING GIN (recipient_ids);

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_subject_not_blank_check,
  DROP CONSTRAINT IF EXISTS messages_content_not_blank_check,
  DROP CONSTRAINT IF EXISTS messages_channels_known_values_check,
  DROP CONSTRAINT IF EXISTS messages_recipient_class_required_check,
  DROP CONSTRAINT IF EXISTS messages_recipient_ids_required_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_subject_not_blank_check
    CHECK (NULLIF(BTRIM(subject), '') IS NOT NULL) NOT VALID,
  ADD CONSTRAINT messages_content_not_blank_check
    CHECK (NULLIF(BTRIM(content), '') IS NOT NULL) NOT VALID,
  ADD CONSTRAINT messages_channels_known_values_check
    CHECK (COALESCE(channels, '{}'::TEXT[]) <@ ARRAY['app','email']::TEXT[]) NOT VALID,
  ADD CONSTRAINT messages_recipient_class_required_check
    CHECK (recipient_type <> 'turma' OR class_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT messages_recipient_ids_required_check
    CHECK (recipient_type <> 'aluno' OR cardinality(COALESCE(recipient_ids, '{}'::UUID[])) > 0) NOT VALID;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users update own notifications" ON public.notifications;
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE
  USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  )
  WITH CHECK (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "staff read observability logs" ON public.observability_logs;
CREATE POLICY "staff read observability logs" ON public.observability_logs
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

COMMIT;
