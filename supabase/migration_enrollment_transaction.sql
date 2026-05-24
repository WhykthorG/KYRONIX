-- ============================================================
-- Milestone 1 — Matrícula transacional server-side
-- ============================================================

CREATE OR REPLACE FUNCTION admin_create_enrollment_transaction(
  p_student JSONB,
  p_access JSONB DEFAULT '{}'::jsonb,
  p_requester JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_student_payload JSONB := COALESCE(p_student, '{}'::jsonb);
  v_access_payload JSONB := COALESCE(p_access, '{}'::jsonb);
  v_requester_payload JSONB := COALESCE(p_requester, '{}'::jsonb);
  v_create_access BOOLEAN := COALESCE(NULLIF(v_access_payload ->> 'create_access', '')::BOOLEAN, FALSE);
  v_student_email TEXT := NULLIF(LOWER(TRIM(COALESCE(v_student_payload ->> 'email', ''))), '');
  v_access_email TEXT := NULLIF(LOWER(TRIM(COALESCE(v_access_payload ->> 'email', ''))), '');
  v_effective_email TEXT := COALESCE(v_access_email, v_student_email);
  v_enrollment_status TEXT := CASE
    WHEN COALESCE(v_student_payload ->> 'enrollment_status', '') = 'ativo' THEN 'ativo'
    ELSE 'pendente'
  END;
  v_approved_at TIMESTAMPTZ := CASE WHEN v_enrollment_status = 'ativo' THEN NOW() ELSE NULL END;
  v_approved_by TEXT := CASE
    WHEN v_enrollment_status = 'ativo'
      THEN NULLIF(TRIM(COALESCE(v_requester_payload ->> 'requested_by_email', '')), '')
    ELSE NULL
  END;
  v_student_record students%ROWTYPE;
  v_profile_record user_profiles%ROWTYPE;
BEGIN
  IF NULLIF(TRIM(COALESCE(v_student_payload ->> 'full_name', '')), '') IS NULL
    OR NULLIF(TRIM(COALESCE(v_student_payload ->> 'cpf', '')), '') IS NULL
    OR NULLIF(TRIM(COALESCE(v_student_payload ->> 'birth_date', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatorios da matricula estao incompletos.';
  END IF;

  IF v_create_access AND v_effective_email IS NULL THEN
    RAISE EXCEPTION 'Informe um e-mail valido para criar acesso ao aluno.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM students
    WHERE cpf = NULLIF(TRIM(COALESCE(v_student_payload ->> 'cpf', '')), '')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ja existe um aluno cadastrado com este CPF.';
  END IF;

  IF NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM students
      WHERE registration_number = NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), '')
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'A matricula informada ja esta em uso.';
  END IF;

  IF v_create_access
    AND EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_email = v_effective_email
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ja existe um perfil vinculado a este e-mail.';
  END IF;

  INSERT INTO students (
    registration_number,
    full_name,
    birth_date,
    cpf,
    gender,
    nationality,
    place_of_birth,
    marital_status,
    photo_url,
    email,
    phone,
    mobile_phone,
    address,
    course,
    entry_period,
    entry_method,
    guardian_name,
    guardian_cpf,
    guardian_relationship,
    guardian_phone,
    guardian_mobile,
    attachments,
    notes,
    enrollment_status,
    enrollment_date,
    current_class_id,
    current_grade,
    shift,
    uses_transport,
    transport_route,
    scholarship_percentage,
    blood_type,
    allergies,
    medical_conditions,
    medications,
    special_needs,
    emergency_contact,
    emergency_phone
  )
  VALUES (
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'full_name', '')), ''),
    (v_student_payload ->> 'birth_date')::DATE,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'cpf', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'gender', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'nationality', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'place_of_birth', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'marital_status', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'photo_url', '')), ''),
    v_effective_email,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'phone', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'mobile_phone', '')), ''),
    CASE
      WHEN jsonb_typeof(v_student_payload -> 'address') = 'object' THEN v_student_payload -> 'address'
      ELSE NULL
    END,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'course', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'entry_period', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'entry_method', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_name', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_cpf', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_relationship', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_phone', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_mobile', '')), ''),
    COALESCE(v_student_payload -> 'attachments', '[]'::jsonb),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'notes', '')), ''),
    v_enrollment_status,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'enrollment_date', '')), '')::DATE,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'current_class_id', '')), '')::UUID,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'current_grade', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'shift', '')), ''),
    COALESCE(NULLIF(v_student_payload ->> 'uses_transport', '')::BOOLEAN, FALSE),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'transport_route', '')), ''),
    COALESCE(NULLIF(TRIM(COALESCE(v_student_payload ->> 'scholarship_percentage', '')), '')::NUMERIC(5,2), 0),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'blood_type', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'allergies', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'medical_conditions', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'medications', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'special_needs', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'emergency_contact', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'emergency_phone', '')), '')
  )
  RETURNING * INTO v_student_record;

  IF v_create_access THEN
    INSERT INTO user_profiles (
      user_email,
      full_name,
      profile_type,
      status,
      phone,
      birth_date,
      registration_number,
      approved_by,
      approved_at
    )
    VALUES (
      v_effective_email,
      v_student_record.full_name,
      'aluno',
      v_enrollment_status,
      v_student_record.phone,
      v_student_record.birth_date,
      v_student_record.registration_number,
      v_approved_by,
      v_approved_at
    )
    RETURNING * INTO v_profile_record;
  END IF;

  RETURN jsonb_build_object(
    'student', to_jsonb(v_student_record),
    'profile', CASE WHEN v_create_access THEN to_jsonb(v_profile_record) ELSE NULL END,
    'accessCreated', v_create_access
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_cleanup_enrollment_transaction(
  p_student_id UUID,
  p_profile_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_deleted_student_count INTEGER := 0;
  v_deleted_profile_count INTEGER := 0;
BEGIN
  IF p_profile_id IS NOT NULL THEN
    DELETE FROM user_profiles
    WHERE id = p_profile_id;

    GET DIAGNOSTICS v_deleted_profile_count = ROW_COUNT;
  END IF;

  DELETE FROM students
  WHERE id = p_student_id;

  GET DIAGNOSTICS v_deleted_student_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'studentDeleted', v_deleted_student_count > 0,
    'profileDeleted', v_deleted_profile_count > 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_create_enrollment_transaction(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_enrollment_transaction(JSONB, JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION admin_cleanup_enrollment_transaction(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_cleanup_enrollment_transaction(UUID, UUID) TO service_role;
