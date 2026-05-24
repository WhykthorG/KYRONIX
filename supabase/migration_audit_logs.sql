-- Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_table        TEXT NOT NULL,
  record_id           TEXT,
  action              TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  actor_user_id       UUID,
  actor_email         TEXT,
  actor_name          TEXT,
  actor_profile_type  TEXT,
  changed_fields      TEXT[] NOT NULL DEFAULT '{}',
  previous_record     JSONB,
  new_record          JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_table ON audit_logs(entity_table);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION audit_request_header(header_name TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(
    COALESCE((current_setting('request.headers', true)::jsonb ->> lower(header_name)), ''),
    ''
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION audit_changed_fields(previous_row JSONB, next_row JSONB)
RETURNS TEXT[] AS $$
DECLARE
  keys TEXT[];
  current_key TEXT;
  changed TEXT[] := '{}';
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT key_value
    FROM (
      SELECT jsonb_object_keys(COALESCE(previous_row, '{}'::jsonb)) AS key_value
      UNION
      SELECT jsonb_object_keys(COALESCE(next_row, '{}'::jsonb)) AS key_value
    ) keys_union
    ORDER BY key_value
  ) INTO keys;

  IF keys IS NULL THEN
    RETURN changed;
  END IF;

  FOREACH current_key IN ARRAY keys LOOP
    IF current_key = 'updated_at' THEN
      CONTINUE;
    END IF;

    IF COALESCE(previous_row -> current_key, 'null'::jsonb) IS DISTINCT FROM COALESCE(next_row -> current_key, 'null'::jsonb) THEN
      changed := array_append(changed, current_key);
    END IF;
  END LOOP;

  RETURN changed;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read audit logs" ON audit_logs;
CREATE POLICY "staff read audit logs" ON audit_logs
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario'));

DO $$
DECLARE
  audited_table TEXT;
BEGIN
  FOREACH audited_table IN ARRAY ARRAY[
    'user_profiles',
    'students',
    'teachers',
    'subjects',
    'classes',
    'attendance',
    'grades',
    'assignments',
    'submissions',
    'messages',
    'events',
    'schedules',
    'class_diary',
    'lesson_plans',
    'library_items',
    'library_loans',
    'goals',
    'goal_tasks',
    'occurrences',
    'app_settings',
    'teacher_calendar_events',
    'homework',
    'homework_completions',
    'direct_messages'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_audit_' || audited_table, audited_table);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION create_audit_log_entry()',
      'trg_audit_' || audited_table,
      audited_table
    );
  END LOOP;
END;
$$;

COMMIT;
