-- ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
BEGIN;

CREATE OR REPLACE FUNCTION register_security_request(
  p_tenant_id UUID,
  p_ip_hash TEXT,
  p_route_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_block_seconds INTEGER,
  p_user_id UUID DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  blocked BOOLEAN,
  rate_limited BOOLEAN,
  request_count INTEGER,
  limit_value INTEGER,
  window_seconds INTEGER,
  blocked_until TIMESTAMPTZ,
  retry_after_seconds INTEGER,
  scope_key TEXT,
  route_key TEXT
) AS $$
#variable_conflict use_column
DECLARE
  v_scope_key TEXT := COALESCE(p_tenant_id::TEXT, 'global');
  v_now TIMESTAMPTZ := NOW();
  v_window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 300), 1);
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 1), 1);
  v_block_seconds INTEGER := GREATEST(COALESCE(p_block_seconds, 300), 1);
  v_window_started_at TIMESTAMPTZ := TO_TIMESTAMP(
    FLOOR(EXTRACT(EPOCH FROM v_now) / v_window_seconds) * v_window_seconds
  );
  v_request_count INTEGER;
  v_blocked_until TIMESTAMPTZ;
  v_existing_blocked_until TIMESTAMPTZ;
BEGIN
  SELECT sib.blocked_until
    INTO v_existing_blocked_until
    FROM security_ip_blocks sib
   WHERE sib.scope_key = v_scope_key
     AND sib.ip_hash = p_ip_hash
     AND sib.blocked_until > v_now
   ORDER BY sib.blocked_until DESC
   LIMIT 1;

  IF v_existing_blocked_until IS NOT NULL THEN
    UPDATE security_ip_blocks
       SET block_count = security_ip_blocks.block_count + 1,
           last_route_key = p_route_key,
           last_user_id = p_user_id,
           last_user_email = p_user_email,
           last_seen_at = v_now,
           metadata = COALESCE(p_metadata, security_ip_blocks.metadata),
           updated_at = v_now
     WHERE security_ip_blocks.scope_key = v_scope_key
       AND security_ip_blocks.ip_hash = p_ip_hash;

    INSERT INTO security_events (
      scope_key,
      tenant_id,
      ip_hash,
      route_key,
      event_type,
      severity,
      user_id,
      user_email,
      details,
      created_at,
      updated_at
    ) VALUES (
      v_scope_key,
      p_tenant_id,
      p_ip_hash,
      p_route_key,
      'ip_blocked',
      'warning',
      p_user_id,
      p_user_email,
      jsonb_build_object(
        'blocked_until', v_existing_blocked_until,
        'metadata', COALESCE(p_metadata, '{}'::jsonb)
      ),
      v_now,
      v_now
    );

    blocked := TRUE;
    rate_limited := TRUE;
    request_count := NULL;
    limit_value := v_limit;
    window_seconds := v_window_seconds;
    blocked_until := v_existing_blocked_until;
    retry_after_seconds := GREATEST(CEIL(EXTRACT(EPOCH FROM (v_existing_blocked_until - v_now)))::INTEGER, 0);
    scope_key := v_scope_key;
    route_key := p_route_key;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO security_request_windows (
    scope_key,
    tenant_id,
    ip_hash,
    route_key,
    window_started_at,
    request_count,
    blocked_until,
    last_seen_at,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    v_scope_key,
    p_tenant_id,
    p_ip_hash,
    p_route_key,
    v_window_started_at,
    1,
    NULL,
    v_now,
    COALESCE(p_metadata, '{}'::jsonb),
    v_now,
    v_now
  )
  ON CONFLICT (scope_key, ip_hash, route_key, window_started_at)
  DO UPDATE SET
    request_count = security_request_windows.request_count + 1,
    last_seen_at = EXCLUDED.last_seen_at,
    metadata = COALESCE(EXCLUDED.metadata, security_request_windows.metadata),
    updated_at = EXCLUDED.updated_at
  RETURNING request_count
    INTO v_request_count;

  IF v_request_count > v_limit THEN
    v_blocked_until := v_now + make_interval(secs => v_block_seconds);

    INSERT INTO security_ip_blocks (
      scope_key,
      tenant_id,
      ip_hash,
      reason,
      block_count,
      blocked_until,
      last_route_key,
      last_user_id,
      last_user_email,
      last_seen_at,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      v_scope_key,
      p_tenant_id,
      p_ip_hash,
      'rate_limited',
      1,
      v_blocked_until,
      p_route_key,
      p_user_id,
      p_user_email,
      v_now,
      COALESCE(p_metadata, '{}'::jsonb),
      v_now,
      v_now
    )
    ON CONFLICT (scope_key, ip_hash)
    DO UPDATE SET
      block_count = security_ip_blocks.block_count + 1,
      reason = EXCLUDED.reason,
      blocked_until = EXCLUDED.blocked_until,
      last_route_key = EXCLUDED.last_route_key,
      last_user_id = EXCLUDED.last_user_id,
      last_user_email = EXCLUDED.last_user_email,
      last_seen_at = EXCLUDED.last_seen_at,
      metadata = COALESCE(EXCLUDED.metadata, security_ip_blocks.metadata),
      updated_at = EXCLUDED.updated_at;

    INSERT INTO security_events (
      scope_key,
      tenant_id,
      ip_hash,
      route_key,
      event_type,
      severity,
      user_id,
      user_email,
      details,
      created_at,
      updated_at
    ) VALUES (
      v_scope_key,
      p_tenant_id,
      p_ip_hash,
      p_route_key,
      'request_rate_limited',
      'warning',
      p_user_id,
      p_user_email,
      jsonb_build_object(
        'request_count', v_request_count,
        'limit', v_limit,
        'window_seconds', v_window_seconds,
        'block_seconds', v_block_seconds,
        'metadata', COALESCE(p_metadata, '{}'::jsonb)
      ),
      v_now,
      v_now
    );

    blocked := TRUE;
    rate_limited := TRUE;
    request_count := v_request_count;
    limit_value := v_limit;
    window_seconds := v_window_seconds;
    blocked_until := v_blocked_until;
    retry_after_seconds := v_block_seconds;
    scope_key := v_scope_key;
    route_key := p_route_key;
    RETURN NEXT;
    RETURN;
  END IF;

  blocked := FALSE;
  rate_limited := FALSE;
  request_count := v_request_count;
  limit_value := v_limit;
  window_seconds := v_window_seconds;
  blocked_until := NULL;
  retry_after_seconds := 0;
  scope_key := v_scope_key;
  route_key := p_route_key;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
