BEGIN;

CREATE TABLE IF NOT EXISTS student_photo_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  student_profile_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_email       TEXT NOT NULL,
  student_full_name   TEXT NOT NULL,
  current_avatar_url  TEXT,
  requested_avatar_url TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'aprovada', 'negada')),
  denial_reason       TEXT,
  next_allowed_at     TIMESTAMPTZ,
  reviewed_by_email   TEXT,
  reviewed_by_name    TEXT,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_photo_requests_student_profile
  ON student_photo_requests(student_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_photo_requests_status_created_at
  ON student_photo_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS trg_student_photo_requests_updated_at ON student_photo_requests;
CREATE TRIGGER trg_student_photo_requests_updated_at
  BEFORE UPDATE ON student_photo_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE student_photo_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read student photo requests" ON student_photo_requests;
DROP POLICY IF EXISTS "staff manage student photo requests" ON student_photo_requests;
DROP POLICY IF EXISTS "students read own photo requests" ON student_photo_requests;
DROP POLICY IF EXISTS "students create own photo requests" ON student_photo_requests;

CREATE POLICY "staff read student photo requests" ON student_photo_requests
  FOR SELECT USING (auth_profile_type() IN ('administrador', 'coordenador', 'secretario'));

CREATE POLICY "staff manage student photo requests" ON student_photo_requests
  FOR ALL USING (auth_profile_type() IN ('administrador', 'coordenador', 'secretario'))
  WITH CHECK (auth_profile_type() IN ('administrador', 'coordenador', 'secretario'));

CREATE POLICY "students read own photo requests" ON student_photo_requests
  FOR SELECT USING (
    auth_profile_type() = 'aluno'
    AND LOWER(student_email) = LOWER(auth.jwt() ->> 'email')
  );

CREATE POLICY "students create own photo requests" ON student_photo_requests
  FOR INSERT WITH CHECK (
    auth_profile_type() = 'aluno'
    AND LOWER(student_email) = LOWER(auth.jwt() ->> 'email')
    AND status = 'pendente'
    AND NOT EXISTS (
      SELECT 1
      FROM student_photo_requests existing
      WHERE existing.student_profile_id = student_photo_requests.student_profile_id
        AND (
          existing.status = 'pendente'
          OR (
            existing.status = 'negada'
            AND existing.next_allowed_at IS NOT NULL
            AND existing.next_allowed_at > NOW()
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION student_request_photo_change(
  p_student_profile_id UUID,
  p_student_email TEXT,
  p_student_name TEXT DEFAULT NULL,
  p_current_avatar_url TEXT DEFAULT NULL,
  p_requested_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_latest_request student_photo_requests%ROWTYPE;
  v_email TEXT := NULLIF(LOWER(TRIM(COALESCE(p_student_email, auth.jwt() ->> 'email', ''))), '');
  v_requested_avatar_url TEXT := NULLIF(TRIM(COALESCE(p_requested_avatar_url, '')), '');
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'E-mail do aluno e obrigatorio.';
  END IF;

  IF p_student_profile_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do aluno e obrigatorio.';
  END IF;

  IF v_requested_avatar_url IS NULL THEN
    RAISE EXCEPTION 'A foto proposta e obrigatoria.';
  END IF;

  SELECT *
    INTO v_profile
  FROM user_profiles
  WHERE id = p_student_profile_id
    AND LOWER(user_email) = v_email
    AND profile_type = 'aluno'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil do aluno nao encontrado.';
  END IF;

  SELECT *
    INTO v_latest_request
  FROM student_photo_requests
  WHERE student_profile_id = p_student_profile_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_latest_request.status = 'pendente' THEN
      RAISE EXCEPTION 'Existe uma solicitacao de foto em analise.';
    END IF;

    IF v_latest_request.status = 'negada'
      AND v_latest_request.next_allowed_at IS NOT NULL
      AND v_latest_request.next_allowed_at > NOW() THEN
      RAISE EXCEPTION 'Nova solicitacao bloqueada ate %.', v_latest_request.next_allowed_at;
    END IF;
  END IF;

  INSERT INTO student_photo_requests (
    student_profile_id,
    student_email,
    student_full_name,
    current_avatar_url,
    requested_avatar_url,
    status
  )
  VALUES (
    v_profile.id,
    v_email,
    COALESCE(NULLIF(TRIM(COALESCE(p_student_name, '')), ''), v_profile.full_name, 'Aluno'),
    NULLIF(TRIM(COALESCE(p_current_avatar_url, v_profile.avatar_url, '')), ''),
    v_requested_avatar_url,
    'pendente'
  )
  RETURNING * INTO v_latest_request;

  RETURN to_jsonb(v_latest_request);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_review_student_photo_request(
  p_request_id UUID,
  p_action TEXT,
  p_denial_reason TEXT DEFAULT NULL,
  p_next_allowed_at TIMESTAMPTZ DEFAULT NULL,
  p_reviewer_email TEXT DEFAULT NULL,
  p_reviewer_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_request student_photo_requests%ROWTYPE;
  v_updated_request student_photo_requests%ROWTYPE;
  v_action TEXT := LOWER(TRIM(COALESCE(p_action, '')));
  v_reviewer_email TEXT := NULLIF(LOWER(TRIM(COALESCE(p_reviewer_email, auth.jwt() ->> 'email', ''))), '');
  v_reviewer_name TEXT := NULLIF(TRIM(COALESCE(p_reviewer_name, '')), '');
BEGIN
  IF auth_profile_type() NOT IN ('administrador', 'coordenador', 'secretario') THEN
    RAISE EXCEPTION 'Permissao insuficiente para revisar foto de aluno.';
  END IF;

  SELECT *
    INTO v_request
  FROM student_photo_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao de foto nao encontrada.';
  END IF;

  IF v_request.status <> 'pendente' THEN
    RAISE EXCEPTION 'Somente solicitacoes pendentes podem ser revisadas.';
  END IF;

  IF v_action = 'aprovada' THEN
    UPDATE user_profiles
      SET avatar_url = v_request.requested_avatar_url
    WHERE id = v_request.student_profile_id;

    UPDATE students
      SET photo_url = v_request.requested_avatar_url
    WHERE email = v_request.student_email;

    UPDATE student_photo_requests
      SET status = 'aprovada',
          denial_reason = NULL,
          next_allowed_at = NULL,
          reviewed_by_email = v_reviewer_email,
          reviewed_by_name = COALESCE(v_reviewer_name, auth.jwt() ->> 'name', v_request.reviewed_by_name),
          reviewed_at = NOW()
    WHERE id = v_request.id
    RETURNING * INTO v_updated_request;

    RETURN jsonb_build_object(
      'request', to_jsonb(v_updated_request),
      'applied_avatar_url', v_request.requested_avatar_url
    );
  END IF;

  IF v_action = 'negada' THEN
    UPDATE student_photo_requests
      SET status = 'negada',
          denial_reason = NULLIF(TRIM(COALESCE(p_denial_reason, '')), ''),
          next_allowed_at = p_next_allowed_at,
          reviewed_by_email = v_reviewer_email,
          reviewed_by_name = COALESCE(v_reviewer_name, auth.jwt() ->> 'name', v_request.reviewed_by_name),
          reviewed_at = NOW()
    WHERE id = v_request.id
    RETURNING * INTO v_updated_request;

    RETURN jsonb_build_object(
      'request', to_jsonb(v_updated_request),
      'applied_avatar_url', NULL
    );
  END IF;

  RAISE EXCEPTION 'Acao invalida. Use aprovada ou negada.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION student_request_photo_change(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION student_request_photo_change(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION admin_review_student_photo_request(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_review_student_photo_request(UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

COMMIT;
