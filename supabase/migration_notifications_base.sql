BEGIN;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS notify_document_pending BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_message_posted BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_access_reset BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID DEFAULT current_tenant_id(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_profile_type TEXT
    CHECK (recipient_profile_type IN ('aluno', 'professor', 'coordenador', 'secretario', 'administrador', 'responsavel')),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('enrollment_created', 'document_pending', 'message_posted', 'access_reset')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}'
    CHECK (channels <@ ARRAY['app', 'email']::TEXT[]),
  app_status TEXT NOT NULL DEFAULT 'entregue'
    CHECK (app_status IN ('entregue', 'lida', 'dispensada')),
  email_status TEXT NOT NULL DEFAULT 'dispensado'
    CHECK (email_status IN ('pendente', 'enviado', 'falhou', 'dispensado')),
  email_error TEXT,
  action_app TEXT,
  action_label TEXT,
  action_record_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email_created_at
  ON notifications(recipient_email, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications" ON notifications;
DROP POLICY IF EXISTS "users update own notifications" ON notifications;
CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );
CREATE POLICY "users update own notifications" ON notifications
  FOR UPDATE
  USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  )
  WITH CHECK (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "messages_insert_staff" ON messages;
DROP POLICY IF EXISTS "student write class messages" ON messages;

COMMIT;
