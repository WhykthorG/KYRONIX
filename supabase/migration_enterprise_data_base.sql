-- ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
BEGIN;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
DECLARE
  raw_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  raw_headers TEXT := NULLIF(current_setting('request.headers', true), '');
  claims_payload JSONB := '{}'::jsonb;
  headers_payload JSONB := '{}'::jsonb;
  tenant_candidate TEXT;
BEGIN
  IF raw_claims IS NOT NULL THEN
    claims_payload := raw_claims::jsonb;
  END IF;

  IF raw_headers IS NOT NULL THEN
    headers_payload := raw_headers::jsonb;
  END IF;

  tenant_candidate := COALESCE(
    NULLIF(claims_payload ->> 'tenant_id', ''),
    NULLIF(claims_payload -> 'app_metadata' ->> 'tenant_id', ''),
    NULLIF(headers_payload ->> 'x-tenant-id', ''),
    NULLIF(current_setting('app.current_tenant_id', true), '')
  );

  IF tenant_candidate IS NULL
     OR tenant_candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  RETURN tenant_candidate::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE notifications ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();

CREATE TABLE IF NOT EXISTS system_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  event_type          TEXT NOT NULL,
  aggregate_type      TEXT,
  aggregate_id        TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  available_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  scope               TEXT NOT NULL,
  idempotency_key     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  response_code       INTEGER,
  response_body       JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications" ON notifications;
CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "staff read system events" ON system_events;
CREATE POLICY "staff read system events" ON system_events
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "staff read idempotency keys" ON idempotency_keys;
CREATE POLICY "staff read idempotency keys" ON idempotency_keys
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
DECLARE
  previous_row JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  next_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  actor_email TEXT := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), audit_request_header('x-audit-actor-email'));
  actor_name TEXT := COALESCE(
    audit_request_header('x-audit-actor-name'),
    (SELECT full_name FROM user_profiles WHERE user_email = actor_email LIMIT 1),
    actor_email
  );
  actor_profile_type TEXT := COALESCE(
    audit_request_header('x-audit-actor-profile-type'),
    (SELECT profile_type FROM user_profiles WHERE user_email = actor_email LIMIT 1)
  );
  actor_user_id_text TEXT := COALESCE(NULLIF(auth.uid()::TEXT, ''), audit_request_header('x-audit-actor-id'));
  actor_user_id UUID := CASE
    WHEN actor_user_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN actor_user_id_text::UUID
    ELSE NULL
  END;
  resolved_record_id TEXT := COALESCE(next_row ->> 'id', previous_row ->> 'id');
  resolved_action TEXT := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
    ELSE lower(TG_OP)
  END;
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    entity_table,
    record_id,
    action,
    actor_user_id,
    actor_email,
    actor_name,
    actor_profile_type,
    changed_fields,
    previous_record,
    new_record,
    metadata
  )
  VALUES (
    COALESCE((next_row ->> 'tenant_id')::uuid, (previous_row ->> 'tenant_id')::uuid, current_tenant_id()),
    TG_TABLE_NAME,
    resolved_record_id,
    resolved_action,
    actor_user_id,
    actor_email,
    actor_name,
    actor_profile_type,
    audit_changed_fields(previous_row, next_row),
    previous_row,
    next_row,
    jsonb_build_object('schema', TG_TABLE_SCHEMA)
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Base enterprise queue tables (`system_events`) and idempotency registry.

COMMIT;
