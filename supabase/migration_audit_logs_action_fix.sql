-- Corrige o trigger de auditoria para mapear INSERT -> create.
-- Antes, lower(TG_OP) gravava "insert", mas a constraint aceita apenas
-- "create", "update" e "delete".

UPDATE audit_logs
SET action = 'create'
WHERE action = 'insert';

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
  has_tenant_column BOOLEAN := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'tenant_id'
  );
  resolved_tenant_id_text TEXT := COALESCE(next_row ->> 'tenant_id', previous_row ->> 'tenant_id');
  resolved_tenant_id UUID := CASE
    WHEN resolved_tenant_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN resolved_tenant_id_text::UUID
    ELSE NULL
  END;
BEGIN
  IF has_tenant_column AND resolved_tenant_id IS NULL AND to_regprocedure('current_tenant_id()') IS NOT NULL THEN
    EXECUTE 'SELECT current_tenant_id()' INTO resolved_tenant_id;
  END IF;

  IF has_tenant_column THEN
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
      resolved_tenant_id,
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
  ELSE
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
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
