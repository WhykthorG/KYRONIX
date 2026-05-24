-- Cria acesso completo para um aluno no Supabase.
-- Ajuste os valores no bloco DECLARE antes de executar.
--
-- O script:
-- 1) cria ou atualiza o registro do aluno em `students`
-- 2) cria ou atualiza o perfil em `user_profiles` com `profile_type = 'aluno'`
-- 3) cria ou atualiza o usuário em `auth.users`
-- 4) recria a identidade de email em `auth.identities` quando a tabela existir

DO $$
DECLARE
  v_email TEXT := LOWER(TRIM('aluno@escola.com'));
  v_password TEXT := '';
  v_full_name TEXT := 'Nome do Aluno';
  v_cpf TEXT := '12345678901';
  v_birth_date DATE := DATE '2010-01-01';

  v_student_id UUID;
  v_registration_number TEXT;
  v_user_id UUID;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Tabela auth.users nao encontrada.';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Informe um e-mail valido para o aluno.';
  END IF;

  IF v_password IS NULL OR LENGTH(v_password) < 8 THEN
    RAISE EXCEPTION 'Informe uma senha temporaria com pelo menos 8 caracteres.';
  END IF;

  IF v_full_name IS NULL OR TRIM(v_full_name) = '' THEN
    RAISE EXCEPTION 'Informe o nome completo do aluno.';
  END IF;

  IF v_cpf IS NULL OR TRIM(v_cpf) = '' THEN
    RAISE EXCEPTION 'Informe o CPF do aluno.';
  END IF;

  IF v_birth_date IS NULL THEN
    RAISE EXCEPTION 'Informe a data de nascimento do aluno.';
  END IF;

  INSERT INTO students (
    full_name,
    cpf,
    birth_date,
    email,
    enrollment_status
  )
  VALUES (
    v_full_name,
    v_cpf,
    v_birth_date,
    v_email,
    'pendente'
  )
  ON CONFLICT (cpf) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        birth_date = EXCLUDED.birth_date,
        email = EXCLUDED.email,
        updated_at = NOW()
  RETURNING id, registration_number
  INTO v_student_id, v_registration_number;

  INSERT INTO user_profiles (
    user_email,
    full_name,
    profile_type,
    status,
    birth_date,
    registration_number,
    approved_by,
    approved_at,
    is_first_login
  )
  VALUES (
    v_email,
    v_full_name,
    'aluno',
    'ativo',
    v_birth_date,
    v_registration_number,
    'sql-script',
    NOW(),
    TRUE
  )
  ON CONFLICT (user_email) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        profile_type = EXCLUDED.profile_type,
        status = EXCLUDED.status,
        birth_date = EXCLUDED.birth_date,
        registration_number = EXCLUDED.registration_number,
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        is_first_login = EXCLUDED.is_first_login,
        updated_at = NOW();

  SELECT id
    INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', v_full_name,
        'profile_type', 'aluno'
      ),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
           updated_at = NOW(),
           raw_user_meta_data = jsonb_build_object(
             'full_name', v_full_name,
             'profile_type', 'aluno'
           )
     WHERE id = v_user_id;
  END IF;

  IF to_regclass('auth.identities') IS NOT NULL THEN
    DELETE FROM auth.identities
     WHERE provider = 'email'
       AND LOWER(provider_id) = v_email;

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_email,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
END $$;
