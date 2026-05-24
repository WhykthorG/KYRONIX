BEGIN;

-- Credenciais de teste criadas por este script (2 por perfil):
-- Senha padrao para todos: Escola@123
-- administradores: admin.teste@escola.com / diretoria.teste@escola.com
-- coordenadores: coordenacao1.teste@escola.com / coordenacao2.teste@escola.com
-- secretarios: secretaria1.teste@escola.com / secretaria2.teste@escola.com
-- professores: helena.duarte@escola.com / marcos.azevedo@escola.com
-- alunos: aluno01.teste@escola.com / aluno02.teste@escola.com
-- responsaveis: claudia.responsavel@escola.com / roberto.responsavel@escola.com
-- perfil adicional: victor.gabriel.etec@gmail.com

ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignment_views DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS class_diary DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lesson_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS library_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS library_loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goal_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS occurrences DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teacher_calendar_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS homework DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS homework_completions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS direct_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS guardian_student_links DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  truncate_targets TEXT[] := ARRAY[
    'assignment_views',
    'submissions',
    'assignments',
    'grades',
    'attendance',
    'class_diary',
    'lesson_plans',
    'messages',
    'direct_messages',
    'events',
    'schedules',
    'homework_completions',
    'homework',
    'library_loans',
    'library_items',
    'goal_tasks',
    'goals',
    'occurrences',
    'teacher_calendar_events',
    'guardian_student_links',
    'students',
    'classes',
    'teachers',
    'subjects',
    'user_profiles'
  ];
  existing_targets TEXT;
BEGIN
  SELECT string_agg(format('%I', table_name), ', ')
  INTO existing_targets
  FROM unnest(truncate_targets) AS table_name
  WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL;

  IF existing_targets IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || existing_targets || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

DO $$
DECLARE
  v_test_password TEXT := 'Escola@123';
  v_test_emails TEXT[] := ARRAY[
    'admin.teste@escola.com',
    'diretoria.teste@escola.com',
    'victor.gabriel.etec@gmail.com',
    'coordenacao1.teste@escola.com',
    'coordenacao2.teste@escola.com',
    'secretaria1.teste@escola.com',
    'secretaria2.teste@escola.com',
    'helena.duarte@escola.com',
    'marcos.azevedo@escola.com',
    'aluno01.teste@escola.com',
    'aluno02.teste@escola.com',
    'claudia.responsavel@escola.com',
    'roberto.responsavel@escola.com'
  ];
  v_email TEXT;
  v_user_id UUID;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('auth.identities') IS NOT NULL THEN
    DELETE FROM auth.identities
    WHERE provider = 'email'
      AND lower(provider_id) = ANY(v_test_emails);
  END IF;

  DELETE FROM auth.users
  WHERE lower(email) = ANY(v_test_emails);

  FOREACH v_email IN ARRAY v_test_emails LOOP
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
      crypt(v_test_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    IF to_regclass('auth.identities') IS NOT NULL THEN
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
  END LOOP;
END $$;

INSERT INTO app_settings (id, school_name, school_email, school_phone, school_address)
VALUES (
  'system',
  'Project WG Escola - Ambiente de Testes',
  'admin.teste@escola.com',
  '(11) 4000-1000',
  'Rua Ambiente de Testes, 100 - Sao Paulo/SP'
)
ON CONFLICT (id) DO UPDATE SET
  school_name = EXCLUDED.school_name,
  school_email = EXCLUDED.school_email,
  school_phone = EXCLUDED.school_phone,
  school_address = EXCLUDED.school_address,
  updated_at = NOW();

DO $$
DECLARE
  v_class_id UUID;
  v_class_ids UUID[] := ARRAY[]::UUID[];
  v_subject_ids UUID[] := ARRAY[]::UUID[];
  v_teacher_ids UUID[] := ARRAY[]::UUID[];
  v_student_ids UUID[] := ARRAY[]::UUID[];
  v_subject_id UUID;
  v_teacher_id UUID;
  v_student_id UUID;
  v_assignment_id UUID;
  v_guardian_profile_id UUID;
  v_due_date TIMESTAMPTZ;
  v_student_sequence INTEGER := 0;
  v_student_number TEXT;
  v_student_email TEXT;
  v_student_name TEXT;
  v_guardian_name TEXT;
  v_approved_by_email TEXT := 'diretoria.teste@escola.com';
  v_supports_guardian_profile BOOLEAN := EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_profile_type_check'
      AND pg_get_constraintdef(oid) ILIKE '%responsavel%'
  );
  v_subject_names TEXT[] := ARRAY[
    'Matematica',
    'Portugues',
    'Historia',
    'Geografia',
    'Fisica',
    'Quimica',
    'Biologia',
    'Ingles'
  ];
  v_subject_codes TEXT[] := ARRAY[
    'MAT-TESTE',
    'POR-TESTE',
    'HIS-TESTE',
    'GEO-TESTE',
    'FIS-TESTE',
    'QUI-TESTE',
    'BIO-TESTE',
    'ING-TESTE'
  ];
  v_teacher_names TEXT[] := ARRAY[
    'Helena Duarte',
    'Marcos Azevedo',
    'Luciana Prado',
    'Renato Tavares',
    'Bianca Monteiro',
    'Caio Nogueira',
    'Patricia Vasconcelos',
    'Thiago Barros'
  ];
  v_teacher_emails TEXT[] := ARRAY[
    'helena.duarte@escola.com',
    'marcos.azevedo@escola.com',
    'luciana.prado@escola.com',
    'renato.tavares@escola.com',
    'bianca.monteiro@escola.com',
    'caio.nogueira@escola.com',
    'patricia.vasconcelos@escola.com',
    'thiago.barros@escola.com'
  ];
  v_student_names TEXT[] := ARRAY[
    'Ana Clara Ribeiro',
    'Bruno Henrique Martins',
    'Camila Ferreira',
    'Daniel Lopes',
    'Eduarda Santana',
    'Felipe Rocha',
    'Gabriela Almeida',
    'Henrique Moura',
    'Isabela Campos',
    'Joao Pedro Lima',
    'Karina Mendes',
    'Leonardo Farias',
    'Mariana Costa',
    'Nicolas Teixeira',
    'Olivia Cardoso',
    'Pedro Henrique Souza',
    'Quezia Ramos',
    'Rafael Batista',
    'Sabrina Moreira',
    'Tiago Correia',
    'Ursula Martins',
    'Vinicius Freitas',
    'Wesley Andrade',
    'Yasmin Pires',
    'Zeca Mourao',
    'Amanda Borges',
    'Beatriz Neves',
    'Caua Rezende',
    'Debora Siqueira',
    'Enzo Vieira'
  ];
  v_guardian_names TEXT[] := ARRAY[
    'Claudia Ribeiro',
    'Roberto Martins',
    'Silvia Ferreira',
    'Paulo Lopes',
    'Fernanda Santana',
    'Ricardo Rocha',
    'Juliana Almeida',
    'Carlos Moura',
    'Tatiane Campos',
    'Marcelo Lima',
    'Patricia Mendes',
    'Anderson Farias',
    'Monica Costa',
    'Sergio Teixeira',
    'Vanessa Cardoso',
    'Rodrigo Souza',
    'Adriana Ramos',
    'Fabio Batista',
    'Cristiane Moreira',
    'Gustavo Correia',
    'Luciana Martins',
    'Daniel Freitas',
    'Priscila Andrade',
    'Eduardo Pires',
    'Rosana Mourao',
    'Mauricio Borges',
    'Tatiana Neves',
    'Alex Rezende',
    'Simone Siqueira',
    'Leandro Vieira'
  ];
  v_class_suffixes TEXT[] := ARRAY['A', 'B', 'C', 'D', 'E'];
BEGIN
  FOR i IN 1..array_length(v_subject_names, 1) LOOP
    v_subject_id := gen_random_uuid();
    v_teacher_id := gen_random_uuid();

    INSERT INTO subjects (
      id, code, name, description, area, grade_level, weekly_hours, total_hours,
      syllabus, objectives, competencies, bibliography, is_mandatory, is_active
    ) VALUES (
      v_subject_id,
      v_subject_codes[i],
      v_subject_names[i],
      'Disciplina de teste para validacao do fluxo academico.',
      CASE
        WHEN v_subject_names[i] IN ('Matematica', 'Fisica', 'Quimica') THEN 'Exatas'
        WHEN v_subject_names[i] IN ('Historia', 'Geografia') THEN 'Humanas'
        WHEN v_subject_names[i] = 'Biologia' THEN 'Biologicas'
        ELSE 'Linguagens'
      END,
      'Ensino Medio',
      2,
      80,
      'Conteudo demonstrativo',
      'Acompanhar o desempenho da turma de teste',
      'Leitura, analise e entrega de atividades',
      'Material interno de testes',
      TRUE,
      TRUE
    );

    INSERT INTO teachers (
      id, employee_id, full_name, cpf, birth_date, gender, email, phone,
      address, education_level, degree_area, institution, certifications,
      specializations, subject_ids, hire_date, contract_type, workload_hours,
      salary, status, bank_info, notes
    ) VALUES (
      v_teacher_id,
      'PROFTESTE' || LPAD(i::TEXT, 2, '0'),
      v_teacher_names[i],
      LPAD((90000000000 + i)::TEXT, 11, '0'),
      DATE '1985-01-01' + ((i - 1) * INTERVAL '90 days'),
      CASE WHEN MOD(i, 2) = 0 THEN 'feminino' ELSE 'masculino' END,
      v_teacher_emails[i],
      '(11) 95555-' || LPAD(i::TEXT, 4, '0'),
      jsonb_build_object('rua', 'Rua dos Professores', 'numero', i::TEXT, 'cidade', 'Sao Paulo', 'estado', 'SP'),
      'Licenciatura',
      v_subject_names[i],
      'Universidade de Testes',
      jsonb_build_array('Ambiente de testes'),
      jsonb_build_array(v_subject_names[i]),
      ARRAY[v_subject_id],
      DATE '2024-02-01',
      'clt',
      30,
      4200,
      'ativo',
      jsonb_build_object('banco', '001', 'agencia', '0001', 'conta', '12345-' || i::TEXT),
      'Professor alocado para o ambiente de testes'
    );

    INSERT INTO user_profiles (
      user_email, full_name, profile_type, status, phone, birth_date,
      document_id, address, department, approved_by, approved_at
    ) VALUES (
      v_teacher_emails[i],
      v_teacher_names[i],
      'professor',
      'ativo',
      '(11) 95555-' || LPAD(i::TEXT, 4, '0'),
      DATE '1985-01-01' + ((i - 1) * INTERVAL '90 days'),
      LPAD((90000000000 + i)::TEXT, 11, '0'),
      jsonb_build_object('rua', 'Rua dos Professores', 'numero', i::TEXT, 'cidade', 'Sao Paulo', 'estado', 'SP'),
      v_subject_names[i],
      v_approved_by_email,
      NOW()
    );

    v_subject_ids := array_append(v_subject_ids, v_subject_id);
    v_teacher_ids := array_append(v_teacher_ids, v_teacher_id);
  END LOOP;

  FOR turma_idx IN 1..array_length(v_class_suffixes, 1) LOOP
    v_class_id := gen_random_uuid();
    v_class_ids := array_append(v_class_ids, v_class_id);

    INSERT INTO classes (
      id, name, year, grade_level, shift, classroom, max_students, current_students,
      coordinator_id, teacher_ids, subject_ids, status, start_date, end_date, notes
    ) VALUES (
      v_class_id,
      '3 Ano ' || v_class_suffixes[turma_idx] || ' - Teste',
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
      '3 Ano Ensino Medio',
      'matutino',
      'Sala Teste ' || LPAD(turma_idx::TEXT, 2, '0'),
      30,
      30,
      v_teacher_ids[1],
      v_teacher_ids,
      v_subject_ids,
      'ativa',
      CURRENT_DATE - INTERVAL '30 days',
      CURRENT_DATE + INTERVAL '240 days',
      'Turma automatica para validacao de entregas, atraso e visualizacao'
    );

    FOR i IN 1..30 LOOP
      v_student_sequence := v_student_sequence + 1;
      v_student_id := gen_random_uuid();
      v_student_number := LPAD(v_student_sequence::TEXT, 3, '0');
      v_student_email := 'aluno' || v_student_number || '.teste@escola.com';
      v_student_name := v_student_names[i] || ' ' || v_class_suffixes[turma_idx];
      v_guardian_name := v_guardian_names[i] || ' ' || v_class_suffixes[turma_idx];

      INSERT INTO students (
        id, registration_number, full_name, birth_date, cpf, gender, nationality,
        marital_status, email, phone, mobile_phone, address, course, entry_period,
        entry_method, guardian_name, guardian_cpf, guardian_relationship, guardian_phone,
        guardian_mobile, attachments, notes, enrollment_status, enrollment_date,
        current_class_id, current_grade, shift, uses_transport, scholarship_percentage,
        emergency_contact, emergency_phone
      ) VALUES (
        v_student_id,
        'RA-TESTE-' || v_student_number,
        v_student_name,
        DATE '2007-01-01' + ((v_student_sequence - 1) * INTERVAL '3 days'),
        LPAD((10000000000 + v_student_sequence)::TEXT, 11, '0'),
        CASE WHEN MOD(v_student_sequence, 2) = 0 THEN 'feminino' ELSE 'masculino' END,
        'Brasileira',
        'solteiro',
        v_student_email,
        '(11) 94444-' || LPAD(v_student_sequence::TEXT, 4, '0'),
        '(11) 93333-' || LPAD(v_student_sequence::TEXT, 4, '0'),
        jsonb_build_object('rua', 'Rua dos Alunos', 'numero', v_student_sequence::TEXT, 'cidade', 'Sao Paulo', 'estado', 'SP'),
        'Ensino Medio',
        EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '.1',
        CASE WHEN MOD(v_student_sequence, 3) = 0 THEN 'transferencia' ELSE 'vestibular' END,
        v_guardian_name,
        LPAD((20000000000 + v_student_sequence)::TEXT, 11, '0'),
        CASE WHEN MOD(v_student_sequence, 2) = 0 THEN 'mae' ELSE 'pai' END,
        '(11) 92222-' || LPAD(v_student_sequence::TEXT, 4, '0'),
        '(11) 91111-' || LPAD(v_student_sequence::TEXT, 4, '0'),
        '[]'::JSONB,
        'Aluno gerado automaticamente para ambiente de testes',
        'ativo',
        CURRENT_DATE - INTERVAL '20 days',
        v_class_id,
        '3 Ano',
        'matutino',
        FALSE,
        0,
        v_guardian_name,
        '(11) 91111-' || LPAD(v_student_sequence::TEXT, 4, '0')
      );

      INSERT INTO user_profiles (
        user_email, full_name, profile_type, status, phone, birth_date,
        document_id, address, registration_number, approved_by, approved_at
      ) VALUES (
        v_student_email,
        v_student_name,
        'aluno',
        'ativo',
        '(11) 93333-' || LPAD(v_student_sequence::TEXT, 4, '0'),
        DATE '2007-01-01' + ((v_student_sequence - 1) * INTERVAL '3 days'),
        LPAD((10000000000 + v_student_sequence)::TEXT, 11, '0'),
        jsonb_build_object('rua', 'Rua dos Alunos', 'numero', v_student_sequence::TEXT, 'cidade', 'Sao Paulo', 'estado', 'SP'),
        'RA-TESTE-' || v_student_number,
        v_approved_by_email,
        NOW()
      );

      v_student_ids := array_append(v_student_ids, v_student_id);
    END LOOP;
  END LOOP;

  INSERT INTO user_profiles (
    user_email, full_name, profile_type, status, phone, document_id,
    address, department, approved_by, approved_at
  ) VALUES
  (
    'admin.teste@escola.com',
    'Aline Carvalho',
    'administrador',
    'ativo',
    '(11) 90000-0001',
    '55555555555',
    jsonb_build_object('rua', 'Rua Admin Teste', 'numero', '1', 'cidade', 'Sao Paulo', 'estado', 'SP'),
    'Administracao',
    v_approved_by_email,
    NOW()
  ),
  (
    'diretoria.teste@escola.com',
    'Clara Menezes',
    'administrador',
    'ativo',
    '(11) 90000-0002',
    '66666666666',
    jsonb_build_object('rua', 'Rua Clara', 'numero', '2', 'cidade', 'Sao Paulo', 'estado', 'SP'),
    'Administracao',
    v_approved_by_email,
    NOW()
  ),
  (
    'victor.gabriel.etec@gmail.com',
    'Victor Gabriel',
    'administrador',
    'ativo',
    '(11) 90000-0009',
    '12312312312',
    jsonb_build_object('rua', 'Rua Victor Gabriel', 'numero', '9', 'cidade', 'Sao Paulo', 'estado', 'SP'),
    'Administracao',
    v_approved_by_email,
    NOW()
  ),
  (
    'coordenacao1.teste@escola.com',
    'Fernanda Albuquerque',
    'coordenador',
    'ativo',
    '(11) 90000-0003',
    '77777777771',
    jsonb_build_object('rua', 'Rua da Coordenacao', 'numero', '3', 'cidade', 'Sao Paulo', 'estado', 'SP'),
    'Coordenacao Pedagogica',
    v_approved_by_email,
    NOW()
  ),
  (
    'coordenacao2.teste@escola.com',
    'Gustavo Peixoto',
    'coordenador',
    'ativo',
    '(11) 90000-0004',
    '77777777772',
    jsonb_build_object('rua', 'Rua da Coordenacao', 'numero', '4', 'cidade', 'Sao Paulo', 'estado', 'SP'),
    'Coordenacao Pedagogica',
    v_approved_by_email,
    NOW()
  ),
  (
    'secretaria1.teste@escola.com',
    'Renata Campos',
    'secretario',
    'ativo',
    '(11) 90000-0005',
    '88888888881',
    jsonb_build_object('rua', 'Rua da Secretaria', 'numero', '5', 'cidade', 'Sao Paulo', 'estado', 'SP'),
    'Secretaria Escolar',
    v_approved_by_email,
    NOW()
  ),
  (
    'secretaria2.teste@escola.com',
    'Paulo Esteves',
    'secretario',
    'ativo',
    '(11) 90000-0006',
    '88888888882',
    jsonb_build_object('rua', 'Rua da Secretaria', 'numero', '6', 'cidade', 'Sao Paulo', 'estado', 'SP'),
    'Secretaria Escolar',
    v_approved_by_email,
    NOW()
  );

  IF v_supports_guardian_profile THEN
    INSERT INTO user_profiles (
      user_email, full_name, profile_type, status, phone, document_id,
      address, department, approved_by, approved_at
    ) VALUES
    (
      'claudia.responsavel@escola.com',
      'Claudia Ribeiro',
      'responsavel',
      'ativo',
      '(11) 90000-0007',
      '99999999991',
      jsonb_build_object('rua', 'Rua das Familias', 'numero', '7', 'cidade', 'Sao Paulo', 'estado', 'SP'),
      'Familias',
      v_approved_by_email,
      NOW()
    ),
    (
      'roberto.responsavel@escola.com',
      'Roberto Martins',
      'responsavel',
      'ativo',
      '(11) 90000-0008',
      '99999999992',
      jsonb_build_object('rua', 'Rua das Familias', 'numero', '8', 'cidade', 'Sao Paulo', 'estado', 'SP'),
      'Familias',
      v_approved_by_email,
      NOW()
    );
  END IF;

  IF v_supports_guardian_profile AND to_regclass('public.guardian_student_links') IS NOT NULL THEN
    SELECT id
    INTO v_guardian_profile_id
    FROM user_profiles
    WHERE user_email = 'claudia.responsavel@escola.com'
    LIMIT 1;

    IF v_guardian_profile_id IS NOT NULL THEN
      INSERT INTO guardian_student_links (guardian_profile_id, student_id)
      VALUES (v_guardian_profile_id, v_student_ids[1]);
    END IF;

    SELECT id
    INTO v_guardian_profile_id
    FROM user_profiles
    WHERE user_email = 'roberto.responsavel@escola.com'
    LIMIT 1;

    IF v_guardian_profile_id IS NOT NULL THEN
      INSERT INTO guardian_student_links (guardian_profile_id, student_id)
      VALUES (v_guardian_profile_id, v_student_ids[2]);
    END IF;
  END IF;

  FOR i IN 1..array_length(v_subject_ids, 1) LOOP
    v_assignment_id := gen_random_uuid();
    v_due_date := timezone('utc', NOW()) - INTERVAL '1 day' + make_interval(hours => i);

    INSERT INTO assignments (
      id, title, description, instructions, class_id, subject_id, teacher_id, type,
      bimester, max_score, weight, due_date, allow_late_submission, late_penalty_percent,
      attachment_urls, is_group_work, plagiarism_check, status, published_at
    ) VALUES (
      v_assignment_id,
      'Atividade de ' || v_subject_names[i],
      'Atividade principal da disciplina de ' || v_subject_names[i],
      'Resolver a atividade e enviar pelo portal do aluno.',
      v_class_ids[1],
      v_subject_ids[i],
      v_teacher_ids[i],
      CASE WHEN MOD(i, 2) = 0 THEN 'trabalho' ELSE 'exercicio' END,
      1,
      10,
      1,
      v_due_date,
      TRUE,
      10,
      '[]'::JSONB,
      FALSE,
      FALSE,
      'publicado',
      timezone('utc', NOW()) - INTERVAL '7 days'
    );

    FOR j IN 1..10 LOOP
      INSERT INTO submissions (
        assignment_id, student_id, content, file_urls, submitted_at, is_late, status,
        score, feedback, graded_at, graded_by, revision_count
      ) VALUES (
        v_assignment_id,
        v_student_ids[j],
        'Entrega no prazo do aluno ' || LPAD(j::TEXT, 2, '0'),
        '[]'::JSONB,
        v_due_date - INTERVAL '6 hours',
        FALSE,
        CASE WHEN j <= 5 THEN 'corrigido' ELSE 'enviado' END,
        CASE WHEN j <= 5 THEN 8 + (j / 10.0) ELSE NULL END,
        CASE WHEN j <= 5 THEN 'Entrega dentro do esperado.' ELSE NULL END,
        CASE WHEN j <= 5 THEN timezone('utc', NOW()) - INTERVAL '12 hours' ELSE NULL END,
        CASE WHEN j <= 5 THEN v_teacher_ids[i] ELSE NULL END,
        0
      );
    END LOOP;

    FOR j IN 11..15 LOOP
      INSERT INTO submissions (
        assignment_id, student_id, content, file_urls, submitted_at, is_late, status,
        score, feedback, graded_at, graded_by, revision_count
      ) VALUES (
        v_assignment_id,
        v_student_ids[j],
        'Entrega com atraso do aluno ' || LPAD(j::TEXT, 2, '0'),
        '[]'::JSONB,
        v_due_date + INTERVAL '12 hours',
        TRUE,
        'enviado',
        NULL,
        NULL,
        NULL,
        NULL,
        0
      );
    END LOOP;

    IF to_regclass('public.assignment_views') IS NOT NULL THEN
      FOR j IN 1..20 LOOP
        INSERT INTO assignment_views (
          assignment_id, student_id, first_viewed_at, last_viewed_at, view_count
        ) VALUES (
          v_assignment_id,
          v_student_ids[j],
          v_due_date - INTERVAL '2 days',
          CASE
            WHEN j <= 15 THEN v_due_date + INTERVAL '1 hour'
            ELSE v_due_date - INTERVAL '8 hours'
          END,
          CASE WHEN j <= 15 THEN 2 ELSE 1 END
        );
      END LOOP;
    END IF;
  END LOOP;
END $$;

ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignment_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS class_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS library_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS goal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS teacher_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS homework_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS guardian_student_links ENABLE ROW LEVEL SECURITY;

COMMIT;
