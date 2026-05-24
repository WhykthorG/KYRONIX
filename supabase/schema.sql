-- ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
-- ============================================================
-- SCRIPT UNIFICADO — Sistema de Gestão Escolar (Project WG)
-- Gerado a partir de todos os scripts recebidos
-- Ordem: Extensions → Core Functions → Tables → Indexes →
--        Triggers → RLS → Policies → RPCs → Seed Data
-- ============================================================


-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================
-- 1. FUNÇÕES CORE (sem dependências de tabelas)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION tenant_matches_current(row_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT row_tenant_id IS NULL OR row_tenant_id = current_tenant_id();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

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


-- ============================================================
-- 2. TABELAS CORE
-- ============================================================

-- 2.1 USER PROFILES
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  user_email          TEXT NOT NULL UNIQUE,
  full_name           TEXT,
  profile_type        TEXT NOT NULL DEFAULT 'aluno'
                      CHECK (profile_type IN ('aluno','professor','coordenador','secretario','administrador','responsavel')),
  status              TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','pendente')),
  phone               TEXT,
  birth_date          DATE,
  document_id         TEXT,
  address             JSONB,
  avatar_url          TEXT,
  registration_number TEXT,
  department          TEXT,
  notes               TEXT,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  is_first_login      BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.2 APP SETTINGS
CREATE TABLE IF NOT EXISTS app_settings (
  id                          TEXT PRIMARY KEY DEFAULT 'system' CHECK (id = 'system'),
  school_name                 TEXT NOT NULL DEFAULT 'Project WG Escola',
  school_email                TEXT,
  school_phone                TEXT,
  school_address              TEXT,
  notify_new_enrollment       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_document_pending     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_message_posted       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_access_reset         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_payment_due          BOOLEAN NOT NULL DEFAULT TRUE,
  notify_grade_posted         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_attendance_issue     BOOLEAN NOT NULL DEFAULT TRUE,
  allow_student_photo_upload  BOOLEAN NOT NULL DEFAULT TRUE,
  require_guardian_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  primary_color               TEXT NOT NULL DEFAULT '#6366f1',
  language                    TEXT NOT NULL DEFAULT 'pt-BR',
  timezone                    TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.3 AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
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

-- 2.4 OBSERVABILITY LOGS
CREATE TABLE IF NOT EXISTS observability_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  channel             TEXT NOT NULL CHECK (channel IN ('frontend', 'backend')),
  event_type          TEXT NOT NULL,
  level               TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  trace_id            TEXT,
  operation           TEXT,
  source              TEXT,
  route               TEXT,
  message             TEXT NOT NULL,
  actor_user_id       UUID,
  actor_email         TEXT,
  actor_name          TEXT,
  actor_profile_type  TEXT,
  context             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);


-- ============================================================
-- 3. TABELAS DE DOMÍNIO
-- ============================================================

-- 3.1 STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number   TEXT UNIQUE,
  full_name             TEXT NOT NULL,
  birth_date            DATE NOT NULL,
  cpf                   TEXT NOT NULL UNIQUE,
  gender                TEXT CHECK (gender IN ('masculino','feminino','outro')),
  nationality           TEXT,
  place_of_birth        TEXT,
  marital_status        TEXT CHECK (marital_status IN ('solteiro','casado','viuvo','divorciado','outro')),
  photo_url             TEXT,
  email                 TEXT,
  phone                 TEXT,
  mobile_phone          TEXT,
  address               JSONB,
  course                TEXT,
  entry_period          TEXT,
  entry_method          TEXT CHECK (entry_method IN ('vestibular','enem','transferencia','portador_diploma','outro')),
  guardian_name         TEXT,
  guardian_cpf          TEXT,
  guardian_relationship TEXT CHECK (guardian_relationship IN ('pai','mae','avo','tio','responsavel_legal','outro')),
  guardian_phone        TEXT,
  guardian_mobile       TEXT,
  attachments           JSONB DEFAULT '[]',
  notes                 TEXT,
  enrollment_status     TEXT NOT NULL DEFAULT 'pendente'
                        CHECK (enrollment_status IN ('ativo','inativo','transferido','formado','evadido','pendente')),
  enrollment_date       DATE,
  current_class_id      UUID,
  current_grade         TEXT,
  shift                 TEXT CHECK (shift IN ('matutino','vespertino','noturno','integral')),
  uses_transport        BOOLEAN DEFAULT FALSE,
  transport_route       TEXT,
  scholarship_percentage NUMERIC(5,2) DEFAULT 0,
  blood_type            TEXT,
  allergies             TEXT,
  medical_conditions    TEXT,
  medications           TEXT,
  special_needs         TEXT,
  emergency_contact     TEXT,
  emergency_phone       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.registration_number IS NULL THEN
    NEW.registration_number := 'RA' || TO_CHAR(NOW(), 'YYYY') ||
      LPAD(NEXTVAL('students_ra_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS students_ra_seq START 1;

DROP TRIGGER IF EXISTS trg_students_ra ON students;
CREATE TRIGGER trg_students_ra
  BEFORE INSERT ON students
  FOR EACH ROW EXECUTE FUNCTION generate_registration_number();

-- 3.2 TEACHERS
CREATE TABLE IF NOT EXISTS teachers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     TEXT UNIQUE,
  full_name       TEXT NOT NULL,
  cpf             TEXT NOT NULL UNIQUE,
  rg              TEXT,
  birth_date      DATE,
  gender          TEXT CHECK (gender IN ('masculino','feminino','outro')),
  photo_url       TEXT,
  email           TEXT,
  phone           TEXT,
  address         JSONB,
  education_level TEXT,
  degree_area     TEXT,
  institution     TEXT,
  certifications  JSONB DEFAULT '[]',
  specializations JSONB DEFAULT '[]',
  subject_ids     UUID[] DEFAULT '{}',
  hire_date       DATE,
  contract_type   TEXT CHECK (contract_type IN ('clt','pj','temporario','substituto')),
  workload_hours  INTEGER,
  salary          NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','licenca','demitido')),
  bank_info       JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_teachers_updated_at ON teachers;
CREATE TRIGGER trg_teachers_updated_at
  BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.3 SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  area          TEXT,
  grade_level   TEXT,
  weekly_hours  INTEGER,
  total_hours   INTEGER,
  syllabus      TEXT,
  objectives    TEXT,
  competencies  TEXT,
  bibliography  TEXT,
  is_mandatory  BOOLEAN DEFAULT TRUE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON subjects;
CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.4 CLASSES
CREATE TABLE IF NOT EXISTS classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  year             INTEGER NOT NULL,
  grade_level      TEXT,
  shift            TEXT CHECK (shift IN ('matutino','vespertino','noturno','integral')),
  classroom        TEXT,
  max_students     INTEGER DEFAULT 40,
  current_students INTEGER DEFAULT 0,
  coordinator_id   UUID REFERENCES teachers(id) ON DELETE SET NULL,
  teacher_ids      UUID[] DEFAULT '{}',
  subject_ids      UUID[] DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada','planejada')),
  start_date       DATE,
  end_date         DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_classes_updated_at ON classes;
CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FK: students → classes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_students_class') THEN
    ALTER TABLE students
      ADD CONSTRAINT fk_students_class
      FOREIGN KEY (current_class_id) REFERENCES classes(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- 3.5 GUARDIAN STUDENT LINKS
CREATE TABLE IF NOT EXISTS guardian_student_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guardian_profile_id, student_id)
);

DROP TRIGGER IF EXISTS trg_guardian_student_links_updated_at ON guardian_student_links;
CREATE TRIGGER trg_guardian_student_links_updated_at
  BEFORE UPDATE ON guardian_student_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.6 ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                 UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id                   UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  subject_id                 UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id                 UUID REFERENCES teachers(id) ON DELETE SET NULL,
  date                       DATE NOT NULL,
  status                     TEXT NOT NULL CHECK (status IN ('presente','ausente','justificado','atrasado')),
  lesson_number              INTEGER,
  justification              TEXT,
  justification_document_url TEXT,
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.7 GRADES
CREATE TABLE IF NOT EXISTS grades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  teacher_id      UUID REFERENCES teachers(id) ON DELETE SET NULL,
  assignment_id   UUID,
  grade_slot      TEXT CHECK (grade_slot IN ('atividade_1','atividade_2','atividade_3','atividade_4','recuperacao')),
  evaluation_type TEXT,
  evaluation_name TEXT,
  bimester        INTEGER CHECK (bimester BETWEEN 1 AND 4),
  year            INTEGER,
  max_score       NUMERIC(5,2) DEFAULT 10,
  score           NUMERIC(5,2),
  weight          NUMERIC(4,2) DEFAULT 1,
  evaluation_date DATE,
  feedback        TEXT,
  status          TEXT DEFAULT 'publicado' CHECK (status IN ('rascunho','publicado','revisado')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_grades_updated_at ON grades;
CREATE TRIGGER trg_grades_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.8 ASSIGNMENTS
CREATE TABLE IF NOT EXISTS assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  instructions          TEXT,
  class_id              UUID REFERENCES classes(id)  ON DELETE CASCADE,
  subject_id            UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id            UUID REFERENCES teachers(id) ON DELETE SET NULL,
  type                  TEXT,
  bimester              INTEGER CHECK (bimester BETWEEN 1 AND 4),
  max_score             NUMERIC(5,2) DEFAULT 10,
  weight                NUMERIC(4,2) DEFAULT 1,
  due_date              TIMESTAMPTZ,
  allow_late_submission BOOLEAN DEFAULT FALSE,
  late_penalty_percent  NUMERIC(5,2) DEFAULT 0,
  attachment_urls       JSONB DEFAULT '[]',
  allowed_formats       TEXT[],
  is_group_work         BOOLEAN DEFAULT FALSE,
  min_group_size        INTEGER,
  max_group_size        INTEGER,
  plagiarism_check      BOOLEAN DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho','publicado','encerrado','arquivado')),
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON assignments;
CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FK: grades → assignments
DO $$
BEGIN
  -- Garante que as colunas existem (caso a tabela já existisse sem elas)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grades' AND column_name='assignment_id') THEN
    ALTER TABLE grades ADD COLUMN assignment_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='grades' AND column_name='grade_slot') THEN
    ALTER TABLE grades ADD COLUMN grade_slot TEXT
      CHECK (grade_slot IN ('atividade_1','atividade_2','atividade_3','atividade_4','recuperacao'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_grades_assignment') THEN
    ALTER TABLE grades
      ADD CONSTRAINT fk_grades_assignment
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- 3.9 SUBMISSIONS
CREATE TABLE IF NOT EXISTS submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id      UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id)    ON DELETE CASCADE,
  group_members      UUID[] DEFAULT '{}',
  content            TEXT,
  file_urls          JSONB DEFAULT '[]',
  submitted_at       TIMESTAMPTZ,
  is_late            BOOLEAN DEFAULT FALSE,
  status             TEXT DEFAULT 'enviado'
                     CHECK (status IN ('rascunho','enviado','em_revisao','corrigido','devolvido')),
  score              NUMERIC(5,2),
  feedback           TEXT,
  feedback_file_url  TEXT,
  graded_at          TIMESTAMPTZ,
  graded_by          UUID REFERENCES teachers(id) ON DELETE SET NULL,
  plagiarism_score   NUMERIC(5,2),
  revision_count     INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_submissions_updated_at ON submissions;
CREATE TRIGGER trg_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.9.1 ASSIGNMENT VIEWS
CREATE TABLE IF NOT EXISTS assignment_views (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id      UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id)    ON DELETE CASCADE,
  first_viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count         INTEGER NOT NULL DEFAULT 1 CHECK (view_count >= 1),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

DROP TRIGGER IF EXISTS trg_assignment_views_updated_at ON assignment_views;
CREATE TRIGGER trg_assignment_views_updated_at
  BEFORE UPDATE ON assignment_views
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.10 MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID,
  sender_name     TEXT,
  sender_type     TEXT CHECK (sender_type IN ('professor','coordenador','secretario','administrador','aluno')),
  recipient_type  TEXT CHECK (recipient_type IN ('todos','turma','aluno','professor','coordenador')),
  recipient_ids   UUID[] DEFAULT '{}',
  class_id        UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL CHECK (NULLIF(BTRIM(subject), '') IS NOT NULL),
  content         TEXT NOT NULL CHECK (NULLIF(BTRIM(content), '') IS NOT NULL),
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  category        TEXT,
  attachment_urls JSONB DEFAULT '[]',
  channels        TEXT[] NOT NULL DEFAULT '{}' CHECK (channels <@ ARRAY['app','email']::TEXT[]),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  status          TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','agendado','enviado','falhou')),
  read_count      INTEGER DEFAULT 0,
  read_by         UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_recipient_class_required_check CHECK (recipient_type <> 'turma' OR class_id IS NOT NULL) NOT VALID,
  CONSTRAINT messages_recipient_ids_required_check CHECK (recipient_type <> 'aluno' OR cardinality(COALESCE(recipient_ids, '{}'::UUID[])) > 0) NOT VALID
);

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.11 EVENTS (school calendar)
CREATE TABLE IF NOT EXISTS events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  description          TEXT,
  type                 TEXT,
  start_date           DATE NOT NULL,
  end_date             DATE,
  all_day              BOOLEAN DEFAULT TRUE,
  location             TEXT,
  is_online            BOOLEAN DEFAULT FALSE,
  meeting_url          TEXT,
  target_audience      TEXT,
  class_ids            UUID[] DEFAULT '{}',
  color                TEXT DEFAULT '#6366f1',
  is_mandatory         BOOLEAN DEFAULT FALSE,
  reminder_days_before INTEGER DEFAULT 1,
  status               TEXT DEFAULT 'confirmado' CHECK (status IN ('planejado','confirmado','cancelado','concluido')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.12 SCHEDULES
CREATE TABLE IF NOT EXISTS schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id  UUID REFERENCES teachers(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  room        TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  year        INTEGER,
  semester    INTEGER CHECK (semester IN (1,2)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_schedules_updated_at ON schedules;
CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.13 CLASS DIARY
CREATE TABLE IF NOT EXISTS class_diary (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id              UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  subject_id            UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id            UUID REFERENCES teachers(id) ON DELETE SET NULL,
  date                  DATE NOT NULL,
  lesson_number         INTEGER,
  start_time            TIME,
  end_time              TIME,
  content               TEXT,
  objectives            TEXT,
  methodology           TEXT,
  homework              TEXT,
  observations          TEXT,
  attachment_urls       JSONB DEFAULT '[]',
  lesson_plan_id        UUID,
  status                TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','revisado')),
  attendance_registered BOOLEAN DEFAULT FALSE,
  total_students        INTEGER DEFAULT 0,
  present_count         INTEGER DEFAULT 0,
  absent_count          INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_class_diary_updated_at ON class_diary;
CREATE TRIGGER trg_class_diary_updated_at
  BEFORE UPDATE ON class_diary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.14 LESSON PLANS
CREATE TABLE IF NOT EXISTS lesson_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  subject_id       UUID REFERENCES subjects(id) ON DELETE SET NULL,
  grade_level      TEXT,
  teacher_id       UUID REFERENCES teachers(id) ON DELETE SET NULL,
  duration_minutes INTEGER,
  theme            TEXT,
  objectives       TEXT,
  content          TEXT,
  methodology      TEXT,
  resources        TEXT,
  evaluation       TEXT,
  homework         TEXT,
  "references"     TEXT,
  competencies     TEXT,
  attachment_urls  JSONB DEFAULT '[]',
  status           TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','arquivado')),
  times_used       INTEGER DEFAULT 0,
  tags             TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_lesson_plans_updated_at ON lesson_plans;
CREATE TRIGGER trg_lesson_plans_updated_at
  BEFORE UPDATE ON lesson_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.15 LIBRARY ITEMS
CREATE TABLE IF NOT EXISTS library_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  type             TEXT CHECK (type IN ('livro','periodico','dvd','ebook','outro')),
  author           TEXT,
  isbn             TEXT,
  publisher        TEXT,
  publication_year INTEGER,
  edition          TEXT,
  category         TEXT,
  subject_area     TEXT,
  description      TEXT,
  cover_url        TEXT,
  file_url         TEXT,
  total_copies     INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  location         TEXT,
  tags             TEXT[] DEFAULT '{}',
  is_digital       BOOLEAN DEFAULT FALSE,
  is_available     BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_library_items_updated_at ON library_items;
CREATE TRIGGER trg_library_items_updated_at
  BEFORE UPDATE ON library_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.16 LIBRARY LOANS
CREATE TABLE IF NOT EXISTS library_loans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       UUID NOT NULL REFERENCES library_items(id) ON DELETE RESTRICT,
  borrower_id   UUID NOT NULL,
  borrower_type TEXT CHECK (borrower_type IN ('aluno','professor','funcionario')),
  loan_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date      DATE NOT NULL,
  return_date   DATE,
  renewed_count INTEGER DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'emprestado'
                CHECK (status IN ('emprestado','devolvido','atrasado','perdido')),
  fine_amount   NUMERIC(8,2) DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_library_loans_updated_at ON library_loans;
CREATE TRIGGER trg_library_loans_updated_at
  BEFORE UPDATE ON library_loans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.17 GOALS
CREATE TABLE IF NOT EXISTS goals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT,
  subject_id          UUID REFERENCES subjects(id) ON DELETE SET NULL,
  target_metric       TEXT,
  current_value       NUMERIC,
  target_value        NUMERIC,
  unit                TEXT,
  start_date          DATE,
  target_date         DATE,
  time_frame          TEXT,
  priority            TEXT DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status              TEXT DEFAULT 'ativo'
                      CHECK (status IN ('ativo','concluido','pausado','cancelado')),
  progress_percentage NUMERIC(5,2) DEFAULT 0,
  shared_with         UUID[] DEFAULT '{}',
  milestones          JSONB DEFAULT '[]',
  reflections         TEXT,
  obstacles           TEXT,
  strategies          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.18 GOAL TASKS
CREATE TABLE IF NOT EXISTS goal_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  estimated_hours NUMERIC(5,2),
  actual_hours    NUMERIC(5,2),
  priority        TEXT DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status          TEXT DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_progresso','concluido','cancelado')),
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_goal_tasks_updated_at ON goal_tasks;
CREATE TRIGGER trg_goal_tasks_updated_at
  BEFORE UPDATE ON goal_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.19 OCCURRENCES
CREATE TABLE IF NOT EXISTS occurrences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reporter_id       UUID,
  reporter_name     TEXT,
  type              TEXT,
  severity          TEXT CHECK (severity IN ('leve','moderada','grave','critica')),
  title             TEXT NOT NULL,
  description       TEXT,
  date              DATE NOT NULL,
  location          TEXT,
  witnesses         TEXT,
  action_taken      TEXT,
  guardian_notified BOOLEAN DEFAULT FALSE,
  notification_date DATE,
  guardian_response TEXT,
  follow_up_date    DATE,
  follow_up_notes   TEXT,
  status            TEXT DEFAULT 'aberta'
                    CHECK (status IN ('aberta','em_acompanhamento','resolvida','arquivada')),
  attachment_urls   JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_occurrences_updated_at ON occurrences;
CREATE TRIGGER trg_occurrences_updated_at
  BEFORE UPDATE ON occurrences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.20 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID DEFAULT current_tenant_id(),
  recipient_email        TEXT NOT NULL,
  recipient_name         TEXT,
  recipient_profile_type TEXT
    CHECK (recipient_profile_type IN ('aluno','professor','coordenador','secretario','administrador','responsavel')),
  event_type             TEXT NOT NULL
    CHECK (event_type IN ('enrollment_created','document_pending','message_posted','access_reset')),
  title                  TEXT NOT NULL,
  body                   TEXT NOT NULL,
  channels               TEXT[] NOT NULL DEFAULT '{}'
    CHECK (channels <@ ARRAY['app','email']::TEXT[]),
  app_status             TEXT NOT NULL DEFAULT 'entregue'
    CHECK (app_status IN ('entregue','lida','dispensada')),
  email_status           TEXT NOT NULL DEFAULT 'dispensado'
    CHECK (email_status IN ('pendente','enviado','falhou','dispensado')),
  email_error            TEXT,
  action_app             TEXT,
  action_label           TEXT,
  action_record_id       UUID,
  metadata               JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at                TIMESTAMPTZ,
  dismissed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.21 SYSTEM EVENTS
CREATE TABLE IF NOT EXISTS system_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  event_type          TEXT NOT NULL,
  aggregate_type      TEXT NOT NULL,
  aggregate_id        TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','processed','failed','discarded')),
  idempotency_key     TEXT,
  available_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_system_events_updated_at ON system_events;
CREATE TRIGGER trg_system_events_updated_at
  BEFORE UPDATE ON system_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.22 IDEMPOTENCY KEYS
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  scope               TEXT NOT NULL DEFAULT 'global',
  idempotency_key     TEXT NOT NULL,
  request_hash        TEXT,
  status              TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','completed','failed','expired')),
  response_code       INTEGER,
  response_body       JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_until        TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_idempotency_keys_updated_at ON idempotency_keys;
CREATE TRIGGER trg_idempotency_keys_updated_at
  BEFORE UPDATE ON idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.23 TEACHER CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS teacher_calendar_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id              UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  description             TEXT,
  event_type              TEXT,
  start_datetime          TIMESTAMPTZ NOT NULL,
  end_datetime            TIMESTAMPTZ,
  all_day                 BOOLEAN DEFAULT FALSE,
  location                TEXT,
  is_online               BOOLEAN DEFAULT FALSE,
  meeting_url             TEXT,
  related_class_id        UUID REFERENCES classes(id) ON DELETE SET NULL,
  related_student_ids     UUID[] DEFAULT '{}',
  visibility              TEXT DEFAULT 'privado' CHECK (visibility IN ('privado','equipe','todos')),
  color                   TEXT DEFAULT '#6366f1',
  reminder_minutes_before INTEGER DEFAULT 30,
  recurrence              TEXT,
  external_calendar_id    TEXT,
  external_calendar_type  TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_teacher_cal_updated_at ON teacher_calendar_events;
CREATE TRIGGER trg_teacher_cal_updated_at
  BEFORE UPDATE ON teacher_calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.24 HOMEWORK
CREATE TABLE IF NOT EXISTS homework (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  subject_id        UUID REFERENCES subjects(id) ON DELETE SET NULL,
  class_id          UUID REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id        TEXT,
  teacher_name      TEXT,
  due_date          DATE NOT NULL,
  estimated_minutes INTEGER,
  attachment_urls   JSONB DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada','cancelada')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_homework_updated_at ON homework;
CREATE TRIGGER trg_homework_updated_at
  BEFORE UPDATE ON homework
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.25 HOMEWORK COMPLETIONS
CREATE TABLE IF NOT EXISTS homework_completions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id   UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_email TEXT,
  status        TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluido')),
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_hw_completions_updated_at ON homework_completions;
CREATE TRIGGER trg_hw_completions_updated_at
  BEFORE UPDATE ON homework_completions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3.26 DIRECT MESSAGES
CREATE TABLE IF NOT EXISTS direct_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID DEFAULT current_tenant_id(),
  conversation_id  TEXT NOT NULL,
  sender_email     TEXT NOT NULL,
  sender_name      TEXT,
  recipient_email  TEXT NOT NULL,
  recipient_name   TEXT,
  content          TEXT NOT NULL,
  message_type     TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','voice','system','call_event')),
  attachments      JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_metadata   JSONB,
  reply_to_message_id UUID REFERENCES direct_messages(id) ON DELETE SET NULL,
  edited_at        TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_dm_updated_at ON direct_messages;
CREATE TRIGGER trg_dm_updated_at
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS chat_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID DEFAULT current_tenant_id(),
  type              TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  direct_key        TEXT,
  title             TEXT,
  created_by_email  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER trg_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS chat_conversation_participants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID DEFAULT current_tenant_id(),
  conversation_id    UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  participant_email  TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, participant_email)
);

CREATE TABLE IF NOT EXISTS chat_academic_groups (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID DEFAULT current_tenant_id(),
  conversation_id        UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  class_id               UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id             UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id             UUID REFERENCES teachers(id) ON DELETE SET NULL,
  coordinator_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_chat_academic_groups_updated_at ON chat_academic_groups;
CREATE TRIGGER trg_chat_academic_groups_updated_at
  BEFORE UPDATE ON chat_academic_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION normalize_chat_participant_email(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(trim(COALESCE(p_value, ''))), '');
$$;

CREATE OR REPLACE FUNCTION sync_chat_academic_group(
  p_class_id UUID,
  p_subject_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_record RECORD;
  v_group_record RECORD;
  v_conversation_id UUID;
  v_created_by_email TEXT;
BEGIN
  IF p_class_id IS NULL OR p_subject_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    (array_remove(array_agg(s.teacher_id), NULL))[1] AS teacher_id,
    c.coordinator_id AS coordinator_teacher_id,
    c.name AS class_name,
    sub.name AS subject_name,
    COALESCE(
      current_tenant_id(),
      (array_remove(array_agg(up.tenant_id), NULL))[1],
      (array_remove(array_agg(existing_group.tenant_id), NULL))[1]
    ) AS tenant_id
  INTO v_schedule_record
  FROM schedules s
  JOIN classes c
    ON c.id = s.class_id
  JOIN subjects sub
    ON sub.id = s.subject_id
  LEFT JOIN chat_academic_groups existing_group
    ON existing_group.class_id = s.class_id
   AND existing_group.subject_id = s.subject_id
  LEFT JOIN user_profiles up
    ON normalize_chat_participant_email(up.user_email) IN (
      normalize_chat_participant_email((
        SELECT t.email
        FROM teachers t
        WHERE t.id = s.teacher_id
      )),
      normalize_chat_participant_email((
        SELECT t2.email
        FROM teachers t2
        WHERE t2.id = c.coordinator_id
      ))
    )
  WHERE s.class_id = p_class_id
    AND s.subject_id = p_subject_id
    AND COALESCE(s.is_active, TRUE)
  GROUP BY c.coordinator_id, c.name, sub.name;

  IF NOT FOUND THEN
    UPDATE chat_academic_groups
       SET is_active = FALSE,
           updated_at = NOW()
     WHERE class_id = p_class_id
       AND subject_id = p_subject_id;

    RETURN NULL;
  END IF;

  SELECT *
    INTO v_group_record
    FROM chat_academic_groups
   WHERE class_id = p_class_id
     AND subject_id = p_subject_id
     AND tenant_id IS NOT DISTINCT FROM v_schedule_record.tenant_id
   LIMIT 1;

  WITH expected_candidates AS (
    SELECT
      normalize_chat_participant_email(t.email) AS participant_email,
      'owner'::TEXT AS role,
      1 AS priority
    FROM teachers t
    WHERE t.id = v_schedule_record.teacher_id

    UNION ALL

    SELECT
      normalize_chat_participant_email(t.email) AS participant_email,
      'member'::TEXT AS role,
      2 AS priority
    FROM teachers t
    WHERE t.id = v_schedule_record.coordinator_teacher_id

    UNION ALL

    SELECT
      normalize_chat_participant_email(s.email) AS participant_email,
      'member'::TEXT AS role,
      3 AS priority
    FROM students s
    WHERE s.current_class_id = p_class_id
      AND s.enrollment_status = 'ativo'
  ),
  expected_profiles AS (
    SELECT DISTINCT ON (candidate.participant_email)
      candidate.participant_email,
      candidate.role
    FROM expected_candidates candidate
    JOIN user_profiles profile
      ON normalize_chat_participant_email(profile.user_email) = candidate.participant_email
    WHERE candidate.participant_email IS NOT NULL
      AND candidate.participant_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      AND profile.status = 'ativo'
      AND (
        (candidate.priority IN (1, 2) AND profile.profile_type IN ('professor', 'coordenador', 'administrador'))
        OR (candidate.priority = 3 AND profile.profile_type = 'aluno')
      )
    ORDER BY candidate.participant_email, candidate.priority
  )
  SELECT
    COALESCE(
      MAX(participant_email) FILTER (WHERE role = 'owner'),
      MIN(participant_email),
      'sistema-chat@local.invalid'
    )
  INTO v_created_by_email
  FROM expected_profiles;

  IF v_group_record.conversation_id IS NULL THEN
    INSERT INTO chat_conversations (
      tenant_id,
      type,
      title,
      created_by_email
    ) VALUES (
      v_schedule_record.tenant_id,
      'group',
      format('Turma %s - %s', v_schedule_record.class_name, v_schedule_record.subject_name),
      v_created_by_email
    )
    RETURNING id INTO v_conversation_id;

    INSERT INTO chat_academic_groups (
      tenant_id,
      conversation_id,
      class_id,
      subject_id,
      teacher_id,
      coordinator_teacher_id,
      is_active
    ) VALUES (
      v_schedule_record.tenant_id,
      v_conversation_id,
      p_class_id,
      p_subject_id,
      v_schedule_record.teacher_id,
      v_schedule_record.coordinator_teacher_id,
      TRUE
    )
    ON CONFLICT (tenant_id, class_id, subject_id)
    DO UPDATE SET
      conversation_id = EXCLUDED.conversation_id,
      teacher_id = EXCLUDED.teacher_id,
      coordinator_teacher_id = EXCLUDED.coordinator_teacher_id,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  ELSE
    v_conversation_id := v_group_record.conversation_id;

    UPDATE chat_conversations
       SET type = 'group',
           title = format('Turma %s - %s', v_schedule_record.class_name, v_schedule_record.subject_name),
           created_by_email = COALESCE(v_created_by_email, created_by_email),
           updated_at = NOW()
     WHERE id = v_conversation_id;

    UPDATE chat_academic_groups
       SET teacher_id = v_schedule_record.teacher_id,
           coordinator_teacher_id = v_schedule_record.coordinator_teacher_id,
           is_active = TRUE,
           updated_at = NOW()
     WHERE id = v_group_record.id;
  END IF;

  WITH expected_candidates AS (
    SELECT
      normalize_chat_participant_email(t.email) AS participant_email,
      'owner'::TEXT AS role,
      1 AS priority
    FROM teachers t
    WHERE t.id = v_schedule_record.teacher_id

    UNION ALL

    SELECT
      normalize_chat_participant_email(t.email) AS participant_email,
      'member'::TEXT AS role,
      2 AS priority
    FROM teachers t
    WHERE t.id = v_schedule_record.coordinator_teacher_id

    UNION ALL

    SELECT
      normalize_chat_participant_email(s.email) AS participant_email,
      'member'::TEXT AS role,
      3 AS priority
    FROM students s
    WHERE s.current_class_id = p_class_id
      AND s.enrollment_status = 'ativo'
  ),
  expected_profiles AS (
    SELECT DISTINCT ON (candidate.participant_email)
      candidate.participant_email,
      candidate.role
    FROM expected_candidates candidate
    JOIN user_profiles profile
      ON normalize_chat_participant_email(profile.user_email) = candidate.participant_email
    WHERE candidate.participant_email IS NOT NULL
      AND candidate.participant_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      AND profile.status = 'ativo'
      AND (
        (candidate.priority IN (1, 2) AND profile.profile_type IN ('professor', 'coordenador', 'administrador'))
        OR (candidate.priority = 3 AND profile.profile_type = 'aluno')
      )
    ORDER BY candidate.participant_email, candidate.priority
  )
  INSERT INTO chat_conversation_participants (
    tenant_id,
    conversation_id,
    participant_email,
    role
  )
  SELECT
    v_schedule_record.tenant_id,
    v_conversation_id,
    expected_profiles.participant_email,
    expected_profiles.role
  FROM expected_profiles
  ON CONFLICT (conversation_id, participant_email)
  DO UPDATE SET
    role = EXCLUDED.role;

  WITH expected_candidates AS (
    SELECT
      normalize_chat_participant_email(t.email) AS participant_email,
      1 AS priority
    FROM teachers t
    WHERE t.id = v_schedule_record.teacher_id

    UNION ALL

    SELECT
      normalize_chat_participant_email(t.email) AS participant_email,
      2 AS priority
    FROM teachers t
    WHERE t.id = v_schedule_record.coordinator_teacher_id

    UNION ALL

    SELECT
      normalize_chat_participant_email(s.email) AS participant_email,
      3 AS priority
    FROM students s
    WHERE s.current_class_id = p_class_id
      AND s.enrollment_status = 'ativo'
  ),
  expected_profiles AS (
    SELECT DISTINCT ON (candidate.participant_email)
      candidate.participant_email
    FROM expected_candidates candidate
    JOIN user_profiles profile
      ON normalize_chat_participant_email(profile.user_email) = candidate.participant_email
    WHERE candidate.participant_email IS NOT NULL
      AND candidate.participant_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      AND profile.status = 'ativo'
      AND (
        (candidate.priority IN (1, 2) AND profile.profile_type IN ('professor', 'coordenador', 'administrador'))
        OR (candidate.priority = 3 AND profile.profile_type = 'aluno')
      )
    ORDER BY candidate.participant_email, candidate.priority
  )
  DELETE FROM chat_conversation_participants participant
   WHERE participant.conversation_id = v_conversation_id
     AND NOT EXISTS (
       SELECT 1
       FROM expected_profiles
       WHERE expected_profiles.participant_email = participant.participant_email
     );

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION sync_chat_academic_groups_for_class(
  p_class_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
BEGIN
  IF p_class_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
     WHERE s.class_id = p_class_id
       AND COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;

  UPDATE chat_academic_groups academic_group
     SET is_active = FALSE,
         updated_at = NOW()
   WHERE academic_group.class_id = p_class_id
     AND NOT EXISTS (
       SELECT 1
         FROM schedules s
        WHERE s.class_id = academic_group.class_id
          AND s.subject_id = academic_group.subject_id
          AND COALESCE(s.is_active, TRUE)
     );
END;
$$;

CREATE OR REPLACE FUNCTION sync_chat_academic_groups_for_subject(
  p_subject_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
BEGIN
  IF p_subject_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
     WHERE s.subject_id = p_subject_id
       AND COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION sync_chat_academic_groups_for_teacher(
  p_teacher_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
BEGIN
  IF p_teacher_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
     WHERE s.teacher_id = p_teacher_id
       AND COALESCE(s.is_active, TRUE)

    UNION

    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
      JOIN classes c
        ON c.id = s.class_id
     WHERE c.coordinator_id = p_teacher_id
       AND COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION sync_chat_academic_groups_for_user_email(
  p_user_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := normalize_chat_participant_email(p_user_email);
  v_combo RECORD;
BEGIN
  IF v_email IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
      JOIN students student
        ON student.current_class_id = s.class_id
     WHERE COALESCE(s.is_active, TRUE)
       AND normalize_chat_participant_email(student.email) = v_email

    UNION

    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
      JOIN teachers teacher
        ON teacher.id = s.teacher_id
     WHERE COALESCE(s.is_active, TRUE)
       AND normalize_chat_participant_email(teacher.email) = v_email

    UNION

    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
      JOIN classes c
        ON c.id = s.class_id
      JOIN teachers teacher
        ON teacher.id = c.coordinator_id
     WHERE COALESCE(s.is_active, TRUE)
       AND normalize_chat_participant_email(teacher.email) = v_email
  LOOP
    PERFORM sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION sync_all_chat_academic_groups()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM schedules s
     WHERE COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE chat_academic_groups academic_group
     SET is_active = FALSE,
         updated_at = NOW()
   WHERE NOT EXISTS (
     SELECT 1
       FROM schedules s
      WHERE s.class_id = academic_group.class_id
        AND s.subject_id = academic_group.subject_id
        AND COALESCE(s.is_active, TRUE)
   );

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION trg_sync_chat_academic_groups_from_schedules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM sync_chat_academic_group(OLD.class_id, OLD.subject_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM sync_chat_academic_group(NEW.class_id, NEW.subject_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_schedules ON schedules;
CREATE TRIGGER trg_sync_chat_academic_groups_schedules
  AFTER INSERT OR UPDATE OF is_active, class_id, subject_id, teacher_id OR DELETE
  ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_chat_academic_groups_from_schedules();

CREATE OR REPLACE FUNCTION trg_sync_chat_academic_groups_from_students()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM sync_chat_academic_groups_for_class(OLD.current_class_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM sync_chat_academic_groups_for_class(NEW.current_class_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_students ON students;
CREATE TRIGGER trg_sync_chat_academic_groups_students
  AFTER INSERT OR UPDATE OF current_class_id, enrollment_status, email OR DELETE
  ON students
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_chat_academic_groups_from_students();

CREATE OR REPLACE FUNCTION trg_sync_chat_academic_groups_from_classes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM sync_chat_academic_groups_for_class(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_classes ON classes;
CREATE TRIGGER trg_sync_chat_academic_groups_classes
  AFTER UPDATE OF coordinator_id, name
  ON classes
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_chat_academic_groups_from_classes();

CREATE OR REPLACE FUNCTION trg_sync_chat_academic_groups_from_subjects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM sync_chat_academic_groups_for_subject(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_subjects ON subjects;
CREATE TRIGGER trg_sync_chat_academic_groups_subjects
  AFTER UPDATE OF name
  ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_chat_academic_groups_from_subjects();

CREATE OR REPLACE FUNCTION trg_sync_chat_academic_groups_from_teachers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM sync_chat_academic_groups_for_teacher(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_teachers ON teachers;
CREATE TRIGGER trg_sync_chat_academic_groups_teachers
  AFTER UPDATE OF email
  ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_chat_academic_groups_from_teachers();

CREATE OR REPLACE FUNCTION trg_sync_chat_academic_groups_from_user_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM sync_chat_academic_groups_for_user_email(OLD.user_email);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM sync_chat_academic_groups_for_user_email(NEW.user_email);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_user_profiles ON user_profiles;
CREATE TRIGGER trg_sync_chat_academic_groups_user_profiles
  AFTER INSERT OR UPDATE OF status, user_email, profile_type OR DELETE
  ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_chat_academic_groups_from_user_profiles();

CREATE TABLE IF NOT EXISTS chat_call_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID DEFAULT current_tenant_id(),
  conversation_id   TEXT NOT NULL,
  initiator_email   TEXT NOT NULL,
  recipient_email   TEXT NOT NULL,
  call_type         TEXT NOT NULL CHECK (call_type IN ('audio','video')),
  status            TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','missed','declined','failed')),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS chat_call_signals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID DEFAULT current_tenant_id(),
  call_session_id  UUID NOT NULL REFERENCES chat_call_sessions(id) ON DELETE CASCADE,
  conversation_id  TEXT NOT NULL,
  sender_email     TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  signal_type      TEXT NOT NULL CHECK (signal_type IN ('offer','answer','ice_candidate','hangup')),
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_call_participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID DEFAULT current_tenant_id(),
  call_session_id   UUID NOT NULL REFERENCES chat_call_sessions(id) ON DELETE CASCADE,
  participant_email TEXT NOT NULL,
  joined_at         TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','joined','left','declined')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (call_session_id, participant_email)
);

CREATE TABLE IF NOT EXISTS chat_call_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID DEFAULT current_tenant_id(),
  call_session_id  UUID NOT NULL REFERENCES chat_call_sessions(id) ON DELETE CASCADE,
  bucket           TEXT NOT NULL DEFAULT 'chat-recordings',
  file_path        TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  duration_seconds INTEGER,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.27 USER WORKSPACE STATE
CREATE TABLE IF NOT EXISTS user_workspace_state (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_workspace_state_updated_at ON user_workspace_state;
CREATE TRIGGER trg_user_workspace_state_updated_at
  BEFORE UPDATE ON user_workspace_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_table   ON audit_logs(entity_table);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id      ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email    ON audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at     ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created_at ON audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_observability_logs_event_type ON observability_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_observability_logs_level      ON observability_logs(level);
CREATE INDEX IF NOT EXISTS idx_observability_logs_trace_id   ON observability_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_observability_logs_actor      ON observability_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_observability_logs_created_at ON observability_logs(created_at DESC);
CREATE INDEX idx_observability_logs_tenant_created_at ON observability_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_email ON user_profiles(tenant_id, user_email);

CREATE INDEX IF NOT EXISTS idx_students_email  ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_cpf    ON students(cpf);
CREATE INDEX IF NOT EXISTS idx_students_name   ON students USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_class  ON students(current_class_id);
CREATE INDEX IF NOT EXISTS idx_students_enrollment_status ON students(enrollment_status);

CREATE INDEX IF NOT EXISTS idx_teachers_email  ON teachers(email);
CREATE INDEX IF NOT EXISTS idx_teachers_cpf    ON teachers(cpf);
CREATE INDEX IF NOT EXISTS idx_teachers_name   ON teachers USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_guardian_student_links_guardian ON guardian_student_links(guardian_profile_id);
CREATE INDEX IF NOT EXISTS idx_guardian_student_links_student  ON guardian_student_links(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_student    ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class      ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date       ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);

CREATE INDEX IF NOT EXISTS idx_grades_student              ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_class                ON grades(class_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject              ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_assignment           ON grades(assignment_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_subject_bimester ON grades(student_id, subject_id, bimester);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grades_term_slot_unique
  ON grades(student_id, subject_id, class_id, bimester, year, grade_slot)
  WHERE grade_slot IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_views_assignment ON assignment_views(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_views_student    ON assignment_views(student_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_class  ON messages(class_id);
CREATE INDEX idx_messages_recipient_type_class_created_at ON messages(recipient_type, class_id, created_at DESC);
CREATE INDEX idx_messages_recipient_ids_gin ON messages USING GIN (recipient_ids);

CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_date);

CREATE INDEX IF NOT EXISTS idx_schedules_class ON schedules(class_id);

CREATE INDEX IF NOT EXISTS idx_class_diary_class ON class_diary(class_id);
CREATE INDEX IF NOT EXISTS idx_class_diary_date  ON class_diary(date);

CREATE INDEX IF NOT EXISTS idx_library_items_title  ON library_items USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_library_items_author ON library_items USING GIN (author gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_library_loans_item     ON library_loans(item_id);
CREATE INDEX IF NOT EXISTS idx_library_loans_borrower ON library_loans(borrower_id);

CREATE INDEX IF NOT EXISTS idx_goal_tasks_goal ON goal_tasks(goal_id);

CREATE INDEX IF NOT EXISTS idx_occurrences_student ON occurrences(student_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email_created_at ON notifications(recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type                  ON notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created_at           ON notifications(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_events_type_status    ON system_events(event_type, status, available_at);
CREATE INDEX IF NOT EXISTS idx_system_events_tenant_created_at ON system_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_events_aggregate       ON system_events(aggregate_type, aggregate_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_keys_scope_key
  ON idempotency_keys ((COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)), scope, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status_locked_until ON idempotency_keys(status, locked_until);

CREATE INDEX IF NOT EXISTS idx_teacher_cal_teacher ON teacher_calendar_events(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_cal_start   ON teacher_calendar_events(start_datetime);

CREATE INDEX IF NOT EXISTS idx_homework_class     ON homework(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_due       ON homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_class_due ON homework(class_id, due_date);

CREATE INDEX IF NOT EXISTS idx_hw_completions_hw      ON homework_completions(homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_completions_student ON homework_completions(student_id);

CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_dm_recipient    ON direct_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_tenant_created_at ON direct_messages(conversation_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_message_type ON direct_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_direct_messages_attachments_gin ON direct_messages USING GIN (attachments);
CREATE INDEX IF NOT EXISTS idx_chat_conversation_participants_email ON chat_conversation_participants(participant_email, tenant_id, joined_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_direct_key_unique ON chat_conversations(tenant_id, direct_key) NULLS NOT DISTINCT WHERE type = 'direct' AND direct_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_academic_groups_unique ON chat_academic_groups (tenant_id, class_id, subject_id) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_academic_groups_conversation ON chat_academic_groups (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_call_sessions_conversation_started_at ON chat_call_sessions(conversation_id, tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_call_sessions_status_started_at ON chat_call_sessions(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_call_sessions_conversation_status_started_at ON chat_call_sessions(conversation_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_call_signals_session_created_at ON chat_call_signals(call_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_call_participants_session_email ON chat_call_participants(call_session_id, participant_email);
CREATE INDEX IF NOT EXISTS idx_chat_call_participants_email_session ON chat_call_participants(participant_email, call_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_call_recordings_expires_at ON chat_call_recordings(expires_at);


-- ============================================================
-- 5. STORAGE CONSTRAINTS
-- ============================================================

CREATE OR REPLACE FUNCTION storage_extract_known_path(raw_value TEXT, bucket_name TEXT DEFAULT 'project-wg-files')
RETURNS TEXT AS $$
DECLARE
  v_trimmed TEXT := NULLIF(BTRIM(raw_value), '');
  v_match TEXT[];
  v_bucket_pattern TEXT := regexp_replace(COALESCE(bucket_name, ''), '([.[\\]{}()*+?^$|\\\\-])', '\\\1', 'g');
BEGIN
  IF v_trimmed IS NULL THEN RETURN NULL; END IF;
  IF v_trimmed !~* '^https?://' THEN RETURN v_trimmed; END IF;
  v_match := regexp_match(v_trimmed, '/storage/v1/object/(?:sign|public|authenticated)/' || v_bucket_pattern || '/([^?]+)');
  IF v_match IS NULL THEN
    v_match := regexp_match(v_trimmed, '/storage/v1/object/' || v_bucket_pattern || '/([^?]+)');
  END IF;
  IF v_match IS NULL OR array_length(v_match, 1) = 0 THEN RETURN NULL; END IF;
  RETURN NULLIF(BTRIM(v_match[1]), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_jsonb_reference_path(reference_value JSONB, bucket_name TEXT DEFAULT 'project-wg-files')
RETURNS TEXT AS $$
DECLARE
  v_type TEXT := jsonb_typeof(reference_value);
BEGIN
  IF reference_value IS NULL THEN RETURN NULL; END IF;
  IF v_type = 'string' THEN RETURN storage_extract_known_path(reference_value #>> '{}', bucket_name); END IF;
  IF v_type <> 'object' THEN RETURN NULL; END IF;
  RETURN COALESCE(
    NULLIF(BTRIM(reference_value ->> 'file_path'), ''),
    NULLIF(BTRIM(reference_value ->> 'path'), ''),
    NULLIF(BTRIM(reference_value ->> 'filePath'), ''),
    storage_extract_known_path(reference_value ->> 'signedUrl', bucket_name),
    storage_extract_known_path(reference_value ->> 'publicUrl', bucket_name),
    storage_extract_known_path(reference_value ->> 'url', bucket_name)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_path_matches_prefixes(file_path TEXT, allowed_prefixes TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(COALESCE(allowed_prefixes, ARRAY[]::TEXT[])) AS prefix
    WHERE file_path LIKE prefix || '%'
  );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_file_array_is_valid(
  file_values JSONB,
  bucket_name TEXT DEFAULT 'project-wg-files',
  allowed_prefixes TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN file_values IS NULL THEN TRUE
    WHEN jsonb_typeof(file_values) <> 'array' THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(file_values) AS item(value)
      CROSS JOIN LATERAL (
        SELECT
          storage_jsonb_reference_path(item.value, bucket_name) AS file_path,
          NULLIF(BTRIM(item.value ->> 'bucket'), '') AS object_bucket
      ) AS ref
      WHERE ref.file_path IS NULL
        OR NOT storage_path_matches_prefixes(ref.file_path, allowed_prefixes)
        OR (ref.object_bucket IS NOT NULL AND ref.object_bucket <> bucket_name)
    )
  END;
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE students   DROP CONSTRAINT IF EXISTS students_attachments_private_storage_check;
ALTER TABLE students   ADD CONSTRAINT students_attachments_private_storage_check
  CHECK (storage_file_array_is_valid(attachments, 'project-wg-files', ARRAY['attachments/'])) NOT VALID;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_file_urls_private_storage_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_file_urls_private_storage_check
  CHECK (storage_file_array_is_valid(file_urls, 'project-wg-files', ARRAY['submissions/'])) NOT VALID;

ALTER TABLE class_diary DROP CONSTRAINT IF EXISTS class_diary_attachment_urls_private_storage_check;
ALTER TABLE class_diary ADD CONSTRAINT class_diary_attachment_urls_private_storage_check
  CHECK (storage_file_array_is_valid(attachment_urls, 'project-wg-files', ARRAY['diary/'])) NOT VALID;

ALTER TABLE lesson_plans DROP CONSTRAINT IF EXISTS lesson_plans_attachment_urls_private_storage_check;
ALTER TABLE lesson_plans ADD CONSTRAINT lesson_plans_attachment_urls_private_storage_check
  CHECK (storage_file_array_is_valid(attachment_urls, 'project-wg-files', ARRAY['diary/'])) NOT VALID;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-wg-files', 'project-wg-files', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false;


-- ============================================================
-- 6. FUNÇÕES DE AUTH / RBAC
-- ============================================================

CREATE OR REPLACE FUNCTION auth_profile_type()
RETURNS TEXT AS $$
  SELECT profile_type FROM user_profiles
  WHERE lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION auth_profile_id()
RETURNS UUID AS $$
  SELECT id FROM user_profiles
  WHERE lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION auth_linked_student_ids()
RETURNS TABLE(student_id UUID) AS $$
  SELECT guardian_student_links.student_id
  FROM guardian_student_links
  JOIN user_profiles guardian_profile ON guardian_profile.id = guardian_student_links.guardian_profile_id
  WHERE guardian_student_links.guardian_profile_id = auth_profile_id()
    AND guardian_profile.profile_type = 'responsavel'
    AND guardian_profile.status = 'ativo';
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION auth_permissions_for_profile(p_profile_type TEXT DEFAULT auth_profile_type())
RETURNS TEXT[] AS $$
  SELECT CASE COALESCE(p_profile_type, '')
    WHEN 'aluno' THEN ARRAY[
      'students.read.self','classes.read','subjects.read','grades.read',
      'attendance.read','assignments.read','calendar.read','messages.read',
      'messages.write.own_class','library.read','goals.manage.self'
    ]::TEXT[]
    WHEN 'responsavel' THEN ARRAY['guardian_portal.view']::TEXT[]
    WHEN 'professor' THEN ARRAY[
      'students.read','teachers.read','classes.read','subjects.read',
      'grades.read','grades.write','attendance.read','attendance.write',
      'assignments.read','assignments.write','calendar.read','teacher_calendar.view',
      'messages.read','messages.write','library.read','occurrences.read','occurrences.write',
      'diary.write','lesson_plans.write','goals.read.all','teacher_portal.view',
      'academic_record.view','submissions.read.all','submissions.grade','direct_chat.use'
    ]::TEXT[]
    WHEN 'secretario' THEN ARRAY[
      'dashboard.view','students.read','students.write','teachers.read',
      'classes.read','classes.write','subjects.read','grades.read','attendance.read',
      'calendar.read','messages.read','messages.write','library.read','library.write',
      'library_loans.read','library_loans.write','reports.view','occurrences.read',
      'occurrences.write','academic_record.view','registration.view','enrollments.manage',
      'settings.read','settings.write','audit.read','events.write','direct_chat.use'
    ]::TEXT[]
    WHEN 'coordenador' THEN ARRAY[
      'dashboard.view','students.read','students.write','teachers.read','teachers.write',
      'classes.read','classes.write','subjects.read','subjects.write','grades.read','grades.write',
      'attendance.read','attendance.write','assignments.read','assignments.write','calendar.read',
      'teacher_calendar.view','teacher_calendar.manage.all','messages.read','messages.write',
      'library.read','library_loans.read','reports.view','occurrences.read','occurrences.write',
      'diary.write','lesson_plans.write','goals.read.all','teacher_portal.view','academic_record.view',
      'registration.view','enrollments.manage','users.manage','users.manage.administrative',
      'settings.read','settings.write','audit.read','events.write','submissions.read.all',
      'submissions.grade','direct_chat.use'
    ]::TEXT[]
    WHEN 'administrador' THEN ARRAY[
      'dashboard.view','students.read','students.write','teachers.read','teachers.write',
      'classes.read','classes.write','subjects.read','subjects.write','grades.read','grades.write',
      'attendance.read','attendance.write','assignments.read','assignments.write','calendar.read',
      'teacher_calendar.view','teacher_calendar.manage.all','messages.read','messages.write',
      'library.read','library.write','library_loans.read','library_loans.write','reports.view',
      'occurrences.read','occurrences.write','diary.write','lesson_plans.write','goals.read.all',
      'teacher_portal.view','academic_record.view','registration.view','enrollments.manage',
      'users.manage','users.manage.administrative','settings.read','settings.write','audit.read',
      'events.write','submissions.read.all','submissions.grade','direct_chat.use'
    ]::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION auth_has_permission(permission_name TEXT, p_profile_type TEXT DEFAULT auth_profile_type())
RETURNS BOOLEAN AS $$
  SELECT COALESCE(permission_name = ANY(auth_permissions_for_profile(p_profile_type)), FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION list_guardian_portal_students()
RETURNS TABLE (
  id UUID, full_name TEXT, registration_number TEXT, enrollment_status TEXT,
  current_class_id UUID, current_grade TEXT, shift TEXT, course TEXT, attachments JSONB
) AS $$
  SELECT students.id, students.full_name, students.registration_number, students.enrollment_status,
         students.current_class_id, students.current_grade, students.shift, students.course,
         COALESCE(students.attachments, '[]'::jsonb)
  FROM students
  WHERE auth_has_permission('guardian_portal.view')
    AND students.id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  ORDER BY students.full_name;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION list_guardian_portal_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_guardian_portal_students() TO authenticated;


-- ============================================================
-- 7. AUDIT LOG FUNCTION & TRIGGERS
-- ============================================================

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
  resolved_tenant_id_text TEXT := COALESCE(next_row ->> 'tenant_id', previous_row ->> 'tenant_id');
  resolved_tenant_id UUID := CASE
    WHEN resolved_tenant_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN resolved_tenant_id_text::UUID
    ELSE current_tenant_id()
  END;
  resolved_action TEXT := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
    ELSE lower(TG_OP)
  END;
BEGIN
  INSERT INTO audit_logs (
    tenant_id, entity_table, record_id, action, actor_user_id, actor_email, actor_name,
    actor_profile_type, changed_fields, previous_record, new_record, metadata
  ) VALUES (
    resolved_tenant_id, TG_TABLE_NAME, resolved_record_id, resolved_action,
    actor_user_id, actor_email, actor_name, actor_profile_type,
    audit_changed_fields(previous_row, next_row), previous_row, next_row,
    jsonb_build_object('schema', TG_TABLE_SCHEMA)
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE
  audited_table TEXT;
BEGIN
  FOREACH audited_table IN ARRAY ARRAY[
    'user_profiles','students','teachers','subjects','classes','attendance','grades',
    'assignments','submissions','assignment_views','messages','events','schedules','class_diary','lesson_plans',
    'library_items','library_loans','goals','goal_tasks','occurrences','app_settings',
    'teacher_calendar_events','homework','homework_completions','direct_messages'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_audit_' || audited_table, audited_table);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION create_audit_log_entry()',
      'trg_audit_' || audited_table, audited_table
    );
  END LOOP;
END;
$$;


-- ============================================================
-- 8. DIRECT MESSAGES — TRIGGER DE PROTEÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_direct_message_read_only_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recipient_email = auth.jwt() ->> 'email' THEN
    IF NEW.sender_email IS DISTINCT FROM OLD.sender_email
      OR NEW.sender_name IS DISTINCT FROM OLD.sender_name
      OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email
      OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only read flag can be updated by recipient';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized to update this message';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_dm_read_only_update ON direct_messages;
CREATE TRIGGER trg_dm_read_only_update
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION enforce_direct_message_read_only_update();


-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_student_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance               ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_views         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_diary              ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_loans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences              ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_calendar_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE observability_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_completions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_academic_groups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_call_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_call_signals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_call_participants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_call_recordings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workspace_state     ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 10. POLICIES
-- ============================================================

-- user_profiles
DROP POLICY IF EXISTS "own profile readable"    ON user_profiles;
DROP POLICY IF EXISTS "admin read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "admin manage profiles"   ON user_profiles;

CREATE POLICY "own profile readable" ON user_profiles
  FOR SELECT USING (
    lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin read all profiles" ON user_profiles
  FOR SELECT USING (
    (auth_profile_type() IN ('administrador','coordenador','secretario') OR auth.role() = 'service_role')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin manage profiles" ON user_profiles
  FOR ALL
  USING (
    (auth_has_permission('users.manage.administrative') OR auth.role() = 'service_role')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    (auth_has_permission('users.manage.administrative') OR auth.role() = 'service_role')
    AND tenant_matches_current(tenant_id)
  );

-- guardian_student_links
DROP POLICY IF EXISTS "guardians read own links"    ON guardian_student_links;
DROP POLICY IF EXISTS "staff manage guardian links" ON guardian_student_links;

CREATE POLICY "guardians read own links" ON guardian_student_links
  FOR SELECT USING (guardian_profile_id = auth_profile_id());

CREATE POLICY "staff manage guardian links" ON guardian_student_links
  FOR ALL
  USING (auth_has_permission('users.manage'))
  WITH CHECK (auth_has_permission('users.manage'));

-- app_settings
DROP POLICY IF EXISTS "staff read app settings"  ON app_settings;
DROP POLICY IF EXISTS "staff write app settings" ON app_settings;

CREATE POLICY "staff read app settings" ON app_settings
  FOR SELECT USING (auth_has_permission('settings.read'));

CREATE POLICY "staff write app settings" ON app_settings
  FOR ALL
  USING (auth_has_permission('settings.write'))
  WITH CHECK (auth_has_permission('settings.write'));

-- notifications
DROP POLICY IF EXISTS "users read own notifications"   ON notifications;
DROP POLICY IF EXISTS "users update own notifications" ON notifications;

CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "users update own notifications" ON notifications
  FOR UPDATE
  USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  );

-- system_events
DROP POLICY IF EXISTS "staff read system events" ON system_events;
CREATE POLICY "staff read system events" ON system_events
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

-- idempotency_keys
DROP POLICY IF EXISTS "staff read idempotency keys" ON idempotency_keys;
CREATE POLICY "staff read idempotency keys" ON idempotency_keys
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

-- audit_logs
DROP POLICY IF EXISTS "staff read audit logs" ON audit_logs;
CREATE POLICY "staff read audit logs" ON audit_logs
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

-- observability_logs
DROP POLICY IF EXISTS "staff read observability logs" ON observability_logs;
CREATE POLICY "staff read observability logs" ON observability_logs
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

-- students
DROP POLICY IF EXISTS "staff read students"  ON students;
DROP POLICY IF EXISTS "staff write students" ON students;
DROP POLICY IF EXISTS "student reads self"   ON students;

CREATE POLICY "staff read students" ON students
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));

CREATE POLICY "staff write students" ON students
  FOR ALL
  USING (
    auth_has_permission('students.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('students.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "student reads self" ON students
  FOR SELECT USING (email = auth.jwt() ->> 'email');

CREATE POLICY "guardian read linked students" ON students
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  );

-- teachers
DROP POLICY IF EXISTS "staff read teachers"  ON teachers;
DROP POLICY IF EXISTS "admin write teachers" ON teachers;

CREATE POLICY "staff read teachers" ON teachers
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin write teachers" ON teachers
  FOR ALL
  USING (
    auth_has_permission('teachers.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('teachers.write')
    AND tenant_matches_current(tenant_id)
  );

-- subjects
DROP POLICY IF EXISTS "all authenticated read subjects" ON subjects;
DROP POLICY IF EXISTS "admin write subjects"            ON subjects;

CREATE POLICY "all authenticated read subjects" ON subjects
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin write subjects" ON subjects
  FOR ALL
  USING (
    auth_has_permission('subjects.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('subjects.write')
    AND tenant_matches_current(tenant_id)
  );

-- classes
DROP POLICY IF EXISTS "all authenticated read classes" ON classes;
DROP POLICY IF EXISTS "admin write classes"            ON classes;

CREATE POLICY "all authenticated read classes" ON classes
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin write classes" ON classes
  FOR ALL
  USING (
    auth_has_permission('classes.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('classes.write')
    AND tenant_matches_current(tenant_id)
  );

-- events
DROP POLICY IF EXISTS "all authenticated read events" ON events;
DROP POLICY IF EXISTS "staff write events"            ON events;

CREATE POLICY "all authenticated read events" ON events
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "staff write events" ON events
  FOR ALL
  USING (
    auth_has_permission('events.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('events.write')
    AND tenant_matches_current(tenant_id)
  );

-- schedules
DROP POLICY IF EXISTS "all authenticated read schedules" ON schedules;
DROP POLICY IF EXISTS "admin write schedules"            ON schedules;

CREATE POLICY "all authenticated read schedules" ON schedules
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin write schedules" ON schedules
  FOR ALL USING (
    auth_profile_type() IN ('administrador','coordenador')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_profile_type() IN ('administrador','coordenador')
    AND tenant_matches_current(tenant_id)
  );

-- grades
DROP POLICY IF EXISTS "staff read grades"          ON grades;
DROP POLICY IF EXISTS "teacher write grades"       ON grades;
DROP POLICY IF EXISTS "student read own grades"    ON grades;
DROP POLICY IF EXISTS "guardian read linked grades" ON grades;

CREATE POLICY "staff read grades" ON grades
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher write grades" ON grades
  FOR ALL
  USING (
    auth_has_permission('grades.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('grades.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "student read own grades" ON grades
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "guardian read linked grades" ON grades
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  );

-- attendance
DROP POLICY IF EXISTS "staff read attendance"           ON attendance;
DROP POLICY IF EXISTS "teacher write attendance"        ON attendance;
DROP POLICY IF EXISTS "student read own attendance"     ON attendance;
DROP POLICY IF EXISTS "guardian read linked attendance" ON attendance;

CREATE POLICY "staff read attendance" ON attendance
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher write attendance" ON attendance
  FOR ALL
  USING (
    auth_has_permission('attendance.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('attendance.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "student read own attendance" ON attendance
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "guardian read linked attendance" ON attendance
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  );

-- assignments
DROP POLICY IF EXISTS "all read published assignments" ON assignments;
DROP POLICY IF EXISTS "teacher write assignments"      ON assignments;

CREATE POLICY "all read published assignments" ON assignments
  FOR SELECT USING (
    (status = 'publicado' OR auth_profile_type() IN ('administrador','coordenador','professor'))
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher write assignments" ON assignments
  FOR ALL
  USING (auth_has_permission('assignments.write'))
  WITH CHECK (auth_has_permission('assignments.write'));

-- messages
DROP POLICY IF EXISTS "messages_select_by_audience"    ON messages;
DROP POLICY IF EXISTS "guardian read linked messages"  ON messages;
DROP POLICY IF EXISTS "messages_insert_staff_permissions" ON messages;
DROP POLICY IF EXISTS "messages_insert_student_class"  ON messages;
DROP POLICY IF EXISTS "messages_update_staff"          ON messages;
DROP POLICY IF EXISTS "messages_delete_staff"          ON messages;

CREATE POLICY "messages_select_by_audience" ON messages
  FOR SELECT USING (
    auth_has_permission('messages.write')
    AND tenant_matches_current(tenant_id)
    OR recipient_type = 'todos'
    OR (recipient_type = 'turma' AND class_id IN (SELECT current_class_id FROM students WHERE email = auth.jwt() ->> 'email') AND tenant_matches_current(tenant_id))
    OR (recipient_type = 'aluno' AND EXISTS (SELECT 1 FROM students s WHERE s.email = auth.jwt() ->> 'email' AND s.id = ANY(messages.recipient_ids)) AND tenant_matches_current(tenant_id))
  );

CREATE POLICY "guardian read linked messages" ON messages
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND tenant_matches_current(tenant_id)
    AND (
      recipient_type = 'todos'
      OR (recipient_type = 'turma' AND class_id IN (SELECT students.current_class_id FROM students WHERE students.id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())) AND tenant_matches_current(tenant_id))
      OR (recipient_type = 'aluno' AND EXISTS (SELECT 1 FROM auth_linked_student_ids() WHERE auth_linked_student_ids.student_id = ANY(messages.recipient_ids)) AND tenant_matches_current(tenant_id))
    )
  );

CREATE POLICY "messages_insert_staff_permissions" ON messages
  FOR INSERT WITH CHECK (
    auth_has_permission('messages.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "messages_insert_student_class" ON messages
  FOR INSERT WITH CHECK (
    auth_profile_type() = 'aluno'
    AND recipient_type = 'turma'
    AND class_id IN (SELECT current_class_id FROM students WHERE email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "messages_update_staff" ON messages
  FOR UPDATE
  USING (
    auth_has_permission('messages.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('messages.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "messages_delete_staff" ON messages
  FOR DELETE USING (
    auth_has_permission('messages.write')
    AND tenant_matches_current(tenant_id)
  );

-- submissions
DROP POLICY IF EXISTS "student manage own submissions" ON submissions;
DROP POLICY IF EXISTS "teacher read submissions"       ON submissions;
DROP POLICY IF EXISTS "teacher grade submissions"      ON submissions;
DROP POLICY IF EXISTS "student manage own assignment views" ON assignment_views;
DROP POLICY IF EXISTS "teacher read assignment views"       ON assignment_views;

CREATE POLICY "student manage own submissions" ON submissions
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher read submissions" ON submissions
  FOR SELECT USING (
    auth_has_permission('submissions.read.all')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher grade submissions" ON submissions
  FOR UPDATE
  USING (
    auth_has_permission('submissions.grade')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('submissions.grade')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "student manage own assignment views" ON assignment_views
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher read assignment views" ON assignment_views
  FOR SELECT USING (
    auth_has_permission('submissions.read.all')
    AND tenant_matches_current(tenant_id)
  );

-- library
DROP POLICY IF EXISTS "all read library items"    ON library_items;
DROP POLICY IF EXISTS "admin write library items" ON library_items;
DROP POLICY IF EXISTS "admin read loans"          ON library_loans;
DROP POLICY IF EXISTS "admin write loans"         ON library_loans;

CREATE POLICY "all read library items" ON library_items
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin write library items" ON library_items
  FOR ALL
  USING (
    auth_has_permission('library.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('library.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin read loans" ON library_loans
  FOR SELECT USING (auth_has_permission('library_loans.read'));

CREATE POLICY "admin write loans" ON library_loans
  FOR ALL
  USING (auth_has_permission('library_loans.write'))
  WITH CHECK (auth_has_permission('library_loans.write'));

-- goals
DROP POLICY IF EXISTS "student manage own goals" ON goals;
DROP POLICY IF EXISTS "teacher read goals"       ON goals;

CREATE POLICY "student manage own goals" ON goals
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher read goals" ON goals
  FOR SELECT USING (
    auth_has_permission('goals.read.all')
    AND tenant_matches_current(tenant_id)
  );

-- goal_tasks
DROP POLICY IF EXISTS "student manage own goal_tasks" ON goal_tasks;
DROP POLICY IF EXISTS "teacher read goal_tasks"       ON goal_tasks;

CREATE POLICY "student manage own goal_tasks" ON goal_tasks
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher read goal_tasks" ON goal_tasks
  FOR SELECT USING (
    auth_profile_type() IN ('professor','coordenador','administrador')
    AND tenant_matches_current(tenant_id)
  );

-- class_diary & lesson_plans
DROP POLICY IF EXISTS "teacher manage diary"         ON class_diary;
DROP POLICY IF EXISTS "teacher manage lesson_plans"  ON lesson_plans;

CREATE POLICY "teacher manage diary" ON class_diary
  FOR ALL
  USING (
    auth_has_permission('diary.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('diary.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher manage lesson_plans" ON lesson_plans
  FOR ALL
  USING (
    auth_has_permission('lesson_plans.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('lesson_plans.write')
    AND tenant_matches_current(tenant_id)
  );

-- occurrences
DROP POLICY IF EXISTS "staff read occurrences"   ON occurrences;
DROP POLICY IF EXISTS "staff manage occurrences" ON occurrences;
DROP POLICY IF EXISTS "guardian read linked occurrences" ON occurrences;

CREATE POLICY "staff read occurrences" ON occurrences
  FOR SELECT USING (
    auth_has_permission('occurrences.read')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "staff manage occurrences" ON occurrences
  FOR ALL
  USING (
    auth_has_permission('occurrences.write')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_has_permission('occurrences.write')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "guardian read linked occurrences" ON occurrences
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
    AND tenant_matches_current(tenant_id)
  );

-- teacher_calendar_events
DROP POLICY IF EXISTS "teacher manage own calendar" ON teacher_calendar_events;

CREATE POLICY "teacher manage own calendar" ON teacher_calendar_events
  FOR ALL
  USING (
    teacher_id IN (SELECT id FROM teachers WHERE email = auth.jwt() ->> 'email')
    OR auth_has_permission('teacher_calendar.manage.all')
  )
  WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE email = auth.jwt() ->> 'email')
    OR auth_has_permission('teacher_calendar.manage.all')
  );

-- homework
DROP POLICY IF EXISTS "all auth read homework"  ON homework;
DROP POLICY IF EXISTS "teacher write homework"  ON homework;

CREATE POLICY "all auth read homework" ON homework
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher write homework" ON homework
  FOR ALL USING (
    auth_profile_type() IN ('professor','coordenador','administrador')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    auth_profile_type() IN ('professor','coordenador','administrador')
    AND tenant_matches_current(tenant_id)
  );

-- homework_completions
DROP POLICY IF EXISTS "student manage own completions" ON homework_completions;
DROP POLICY IF EXISTS "teacher read completions"       ON homework_completions;

CREATE POLICY "student manage own completions" ON homework_completions
  FOR ALL
  USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "teacher read completions" ON homework_completions
  FOR SELECT USING (
    auth_profile_type() IN ('professor','coordenador','administrador')
    AND tenant_matches_current(tenant_id)
  );

-- direct_messages
DROP POLICY IF EXISTS "dm_select_own"            ON direct_messages;
DROP POLICY IF EXISTS "dm_insert_sender_only"    ON direct_messages;
DROP POLICY IF EXISTS "dm_update_recipient_read" ON direct_messages;
DROP POLICY IF EXISTS "dm_delete_sender_only"    ON direct_messages;

CREATE POLICY "dm_select_own" ON direct_messages
  FOR SELECT USING (
    (sender_email = auth.jwt() ->> 'email' OR recipient_email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "dm_insert_sender_only" ON direct_messages
  FOR INSERT WITH CHECK (
    sender_email = auth.jwt() ->> 'email'
    AND recipient_email IS NOT NULL
    AND content IS NOT NULL
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "dm_update_recipient_read" ON direct_messages
  FOR UPDATE
  USING (recipient_email = auth.jwt() ->> 'email' AND tenant_matches_current(tenant_id))
  WITH CHECK (recipient_email = auth.jwt() ->> 'email' AND tenant_matches_current(tenant_id));

CREATE POLICY "dm_delete_sender_only" ON direct_messages
  FOR DELETE USING (sender_email = auth.jwt() ->> 'email' AND tenant_matches_current(tenant_id));

-- chat_conversations
DROP POLICY IF EXISTS "chat_conversations_select_participant" ON chat_conversations;
DROP POLICY IF EXISTS "chat_conversations_insert_authenticated" ON chat_conversations;

CREATE POLICY "chat_conversations_select_participant" ON chat_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM chat_conversation_participants participant
      WHERE participant.conversation_id = chat_conversations.id
        AND participant.participant_email = auth.jwt() ->> 'email'
        AND tenant_matches_current(participant.tenant_id)
    )
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "chat_conversations_insert_authenticated" ON chat_conversations
  FOR INSERT WITH CHECK (
    created_by_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

-- chat_conversation_participants
DROP POLICY IF EXISTS "chat_conversation_participants_select_own" ON chat_conversation_participants;
DROP POLICY IF EXISTS "chat_conversation_participants_insert_owner" ON chat_conversation_participants;

CREATE POLICY "chat_conversation_participants_select_own" ON chat_conversation_participants
  FOR SELECT USING (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "chat_conversation_participants_insert_owner" ON chat_conversation_participants
  FOR INSERT WITH CHECK (tenant_matches_current(tenant_id));

-- direct_messages
DROP POLICY IF EXISTS "dm_select_own" ON direct_messages;
DROP POLICY IF EXISTS "dm_insert_sender_only" ON direct_messages;
DROP POLICY IF EXISTS "dm_update_recipient_read" ON direct_messages;

CREATE POLICY "dm_select_own" ON direct_messages
  FOR SELECT USING (
    (
      sender_email = auth.jwt() ->> 'email'
      OR recipient_email = auth.jwt() ->> 'email'
      OR EXISTS (
        SELECT 1
        FROM chat_conversation_participants participant
        WHERE participant.participant_email = auth.jwt() ->> 'email'
          AND participant.conversation_id::text = direct_messages.conversation_id
      )
    )
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "dm_insert_sender_only" ON direct_messages
  FOR INSERT WITH CHECK (
    sender_email = auth.jwt() ->> 'email'
    AND content IS NOT NULL
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "dm_update_recipient_read" ON direct_messages
  FOR UPDATE
  USING (
    (
      recipient_email = auth.jwt() ->> 'email'
      OR EXISTS (
        SELECT 1
        FROM chat_conversation_participants participant
        WHERE participant.participant_email = auth.jwt() ->> 'email'
          AND participant.conversation_id::text = direct_messages.conversation_id
      )
    )
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    (
      recipient_email = auth.jwt() ->> 'email'
      OR EXISTS (
        SELECT 1
        FROM chat_conversation_participants participant
        WHERE participant.participant_email = auth.jwt() ->> 'email'
          AND participant.conversation_id::text = direct_messages.conversation_id
      )
    )
    AND tenant_matches_current(tenant_id)
  );

-- chat_call_sessions
DROP POLICY IF EXISTS "chat_call_sessions_select_participant" ON chat_call_sessions;
DROP POLICY IF EXISTS "chat_call_sessions_insert_initiator" ON chat_call_sessions;
DROP POLICY IF EXISTS "chat_call_sessions_update_participant" ON chat_call_sessions;

CREATE POLICY "chat_call_sessions_select_participant" ON chat_call_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM chat_call_participants participant
      WHERE participant.call_session_id = chat_call_sessions.id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "chat_call_sessions_insert_initiator" ON chat_call_sessions
  FOR INSERT WITH CHECK (
    initiator_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "chat_call_sessions_update_participant" ON chat_call_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM chat_call_participants participant
      WHERE participant.call_session_id = chat_call_sessions.id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM chat_call_participants participant
      WHERE participant.call_session_id = chat_call_sessions.id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  );

-- chat_call_signals
DROP POLICY IF EXISTS "chat_call_signals_select_participant" ON chat_call_signals;
DROP POLICY IF EXISTS "chat_call_signals_insert_sender" ON chat_call_signals;

CREATE POLICY "chat_call_signals_select_participant" ON chat_call_signals
  FOR SELECT USING (
    (sender_email = auth.jwt() ->> 'email' OR recipient_email = auth.jwt() ->> 'email')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "chat_call_signals_insert_sender" ON chat_call_signals
  FOR INSERT WITH CHECK (
    sender_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

-- chat_call_participants
DROP POLICY IF EXISTS "chat_call_participants_select_participant" ON chat_call_participants;
DROP POLICY IF EXISTS "chat_call_participants_insert_participant" ON chat_call_participants;
DROP POLICY IF EXISTS "chat_call_participants_update_participant" ON chat_call_participants;

CREATE POLICY "chat_call_participants_select_participant" ON chat_call_participants
  FOR SELECT USING (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "chat_call_participants_insert_participant" ON chat_call_participants
  FOR INSERT WITH CHECK (tenant_matches_current(tenant_id));

CREATE POLICY "chat_call_participants_update_participant" ON chat_call_participants
  FOR UPDATE USING (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    participant_email = auth.jwt() ->> 'email'
    AND tenant_matches_current(tenant_id)
  );

-- chat_call_recordings
DROP POLICY IF EXISTS "chat_call_recordings_select_participant" ON chat_call_recordings;

CREATE POLICY "chat_call_recordings_select_participant" ON chat_call_recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM chat_call_participants participant
      WHERE participant.call_session_id = chat_call_recordings.call_session_id
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
    AND tenant_matches_current(tenant_id)
  );

-- user_workspace_state
DROP POLICY IF EXISTS "user_workspace_select_own" ON user_workspace_state;
DROP POLICY IF EXISTS "user_workspace_insert_own" ON user_workspace_state;
DROP POLICY IF EXISTS "user_workspace_update_own" ON user_workspace_state;
DROP POLICY IF EXISTS "user_workspace_delete_own" ON user_workspace_state;

CREATE POLICY "user_workspace_select_own" ON user_workspace_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_workspace_insert_own" ON user_workspace_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_workspace_update_own" ON user_workspace_state
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_workspace_delete_own" ON user_workspace_state
  FOR DELETE USING (auth.uid() = user_id);

-- storage.objects
DROP POLICY IF EXISTS "staff_manage_school_files"        ON storage.objects;
DROP POLICY IF EXISTS "staff_read_school_files"          ON storage.objects;
DROP POLICY IF EXISTS "staff_manage_enrollment_files"    ON storage.objects;
DROP POLICY IF EXISTS "staff_manage_diary_files"         ON storage.objects;
DROP POLICY IF EXISTS "staff_read_submission_files"      ON storage.objects;
DROP POLICY IF EXISTS "student_upload_own_submissions"   ON storage.objects;
DROP POLICY IF EXISTS "student_read_own_submission_files" ON storage.objects;
DROP POLICY IF EXISTS "student_delete_own_submission_files" ON storage.objects;
DROP POLICY IF EXISTS "chat_voice_upload_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_voice_read_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_voice_delete_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_recordings_upload_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_recordings_read_participant" ON storage.objects;
DROP POLICY IF EXISTS "chat_recordings_delete_participant" ON storage.objects;

CREATE POLICY "staff_read_school_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

CREATE POLICY "staff_manage_enrollment_files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'project-wg-files' AND name LIKE 'attachments/%' AND auth_has_permission('enrollments.manage'))
  WITH CHECK (bucket_id = 'project-wg-files' AND name LIKE 'attachments/%' AND auth_has_permission('enrollments.manage'));

CREATE POLICY "staff_manage_diary_files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'project-wg-files' AND name LIKE 'diary/%' AND auth_has_permission('diary.write'))
  WITH CHECK (bucket_id = 'project-wg-files' AND name LIKE 'diary/%' AND auth_has_permission('diary.write'));

CREATE POLICY "staff_read_submission_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-wg-files' AND name LIKE 'submissions/%' AND auth_has_permission('submissions.read.all'));

CREATE POLICY "student_upload_own_submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

CREATE POLICY "student_read_own_submission_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

CREATE POLICY "student_delete_own_submission_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

CREATE POLICY "chat_voice_upload_participant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-voice'
    AND split_part(name, '/', 1) = 'direct'
    AND position(lower(auth.jwt() ->> 'email') IN split_part(name, '/', 2)) > 0
  );

CREATE POLICY "chat_voice_read_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND split_part(name, '/', 1) = 'direct'
    AND position(lower(auth.jwt() ->> 'email') IN split_part(name, '/', 2)) > 0
  );

CREATE POLICY "chat_voice_delete_participant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-voice'
    AND split_part(name, '/', 1) = 'direct'
    AND position(lower(auth.jwt() ->> 'email') IN split_part(name, '/', 2)) > 0
  );

CREATE POLICY "chat_recordings_upload_participant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-recordings'
    AND split_part(name, '/', 1) = 'recordings'
    AND EXISTS (
      SELECT 1
      FROM chat_call_participants participant
      WHERE participant.call_session_id::text = split_part(name, '/', 2)
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "chat_recordings_read_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-recordings'
    AND split_part(name, '/', 1) = 'recordings'
    AND EXISTS (
      SELECT 1
      FROM chat_call_participants participant
      WHERE participant.call_session_id::text = split_part(name, '/', 2)
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "chat_recordings_delete_participant" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-recordings'
    AND split_part(name, '/', 1) = 'recordings'
    AND EXISTS (
      SELECT 1
      FROM chat_call_participants participant
      WHERE participant.call_session_id::text = split_part(name, '/', 2)
        AND participant.participant_email = auth.jwt() ->> 'email'
    )
  );


-- ============================================================
-- 11. RPCs / FUNÇÕES DE NEGÓCIO
-- ============================================================

-- 11.1 Busca global no workspace
CREATE OR REPLACE FUNCTION public.search_workspace(
  p_query text,
  p_limit_per_entity int DEFAULT 5,
  p_max_total int DEFAULT 24
)
RETURNS TABLE (
  entity_key text, record_id uuid, title text, subtitle text,
  meta text, app_id text, entity_label text, search_document text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH params AS (
    SELECT
      lower(trim(coalesce(p_query, ''))) AS q,
      least(greatest(coalesce(p_limit_per_entity, 5), 1), 20) AS lim,
      least(greatest(coalesce(p_max_total, 24), 1), 100) AS cap
  ),
  limv AS (SELECT lim FROM params),

  students_b AS (
    SELECT
      'students'::text                                                                      AS entity_key,
      s.id                                                                                   AS record_id,
      coalesce(s.full_name,'Aluno sem nome')::text                                          AS title,
      concat_ws(' • ', CASE WHEN s.registration_number IS NOT NULL THEN 'Matrícula '||s.registration_number END, s.email, s.current_grade)::text AS subtitle,
      coalesce(s.enrollment_status,'aluno')::text                                           AS meta,
      'students'::text                                                                      AS app_id,
      'Alunos'::text                                                                        AS entity_label,
      lower(coalesce(s.full_name,'')||' '||coalesce(s.registration_number,'')||' '||coalesce(s.email,'')||' '||coalesce(s.guardian_name,'')||' '||coalesce(s.current_grade,'')||' '||coalesce(s.shift,'')||' '||coalesce(s.enrollment_status,'')) AS search_document
    FROM students s CROSS JOIN params p
    WHERE length(p.q)>=2
      AND (auth_has_permission('students.read') OR auth_has_permission('students.read.self'))
      AND position(p.q IN lower(coalesce(s.full_name,'')||' '||coalesce(s.registration_number,'')||' '||coalesce(s.email,'')||' '||coalesce(s.guardian_name,'')||' '||coalesce(s.current_grade,'')||' '||coalesce(s.shift,'')||' '||coalesce(s.enrollment_status,'')))>0
    ORDER BY s.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  teachers_b AS (
    SELECT
      'teachers'::text                                                                      AS entity_key,
      t.id                                                                                   AS record_id,
      coalesce(t.full_name,'Professor sem nome')::text                                      AS title,
      concat_ws(' • ', t.email, CASE WHEN t.employee_id IS NOT NULL THEN 'Matrícula '||t.employee_id END)::text AS subtitle,
      coalesce(t.status,'professor')::text                                                  AS meta,
      'teachers'::text                                                                      AS app_id,
      'Professores'::text                                                                   AS entity_label,
      lower(coalesce(t.full_name,'')||' '||coalesce(t.email,'')||' '||coalesce(t.employee_id,'')||' '||coalesce(t.degree_area,'')||' '||coalesce(t.education_level,'')||' '||coalesce(t.status,'')) AS search_document
    FROM teachers t CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('teachers.read')
      AND position(p.q IN lower(coalesce(t.full_name,'')||' '||coalesce(t.email,'')||' '||coalesce(t.employee_id,'')||' '||coalesce(t.degree_area,'')||' '||coalesce(t.education_level,'')||' '||coalesce(t.status,'')))>0
    ORDER BY t.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  classes_b AS (
    SELECT
      'classes'::text                                                                       AS entity_key,
      c.id                                                                                   AS record_id,
      coalesce(c.name,'Turma sem nome')::text                                               AS title,
      concat_ws(' • ', c.grade_level, c.year::text, c.classroom)::text                     AS subtitle,
      coalesce(c.status,c.shift,'turma')::text                                             AS meta,
      'classes'::text                                                                       AS app_id,
      'Turmas'::text                                                                        AS entity_label,
      lower(coalesce(c.name,'')||' '||coalesce(c.grade_level,'')||' '||coalesce(c.classroom,'')||' '||coalesce(c.shift,'')||' '||coalesce(c.status,'')||' '||coalesce(c.year::text,'')) AS search_document
    FROM classes c CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('classes.read')
      AND position(p.q IN lower(coalesce(c.name,'')||' '||coalesce(c.grade_level,'')||' '||coalesce(c.classroom,'')||' '||coalesce(c.shift,'')||' '||coalesce(c.status,'')||' '||coalesce(c.year::text,'')))>0
    ORDER BY c.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  subjects_b AS (
    SELECT
      'subjects'::text                                                                      AS entity_key,
      s.id                                                                                   AS record_id,
      coalesce(s.name,'Disciplina sem nome')::text                                          AS title,
      concat_ws(' • ', s.code, s.grade_level)::text                                        AS subtitle,
      coalesce(s.area, CASE WHEN s.is_active IS FALSE THEN 'inativa' ELSE 'ativa' END)::text AS meta,
      'subjects'::text                                                                      AS app_id,
      'Disciplinas'::text                                                                   AS entity_label,
      lower(coalesce(s.name,'')||' '||coalesce(s.code,'')||' '||coalesce(s.area,'')||' '||coalesce(s.grade_level,'')||' '||coalesce(s.syllabus,'')) AS search_document
    FROM subjects s CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('subjects.read')
      AND position(p.q IN lower(coalesce(s.name,'')||' '||coalesce(s.code,'')||' '||coalesce(s.area,'')||' '||coalesce(s.grade_level,'')||' '||coalesce(s.syllabus,'')))>0
    ORDER BY s.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  assignments_b AS (
    SELECT
      'assignments'::text                                                                   AS entity_key,
      a.id                                                                                   AS record_id,
      coalesce(a.title,'Atividade sem título')::text                                        AS title,
      left(regexp_replace(coalesce(a.description,a.instructions,''), E'\\s+', ' ', 'g'), 96)::text AS subtitle,
      coalesce(a.status,a.type,'atividade')::text                                          AS meta,
      'assignments'::text                                                                   AS app_id,
      'Atividades'::text                                                                    AS entity_label,
      lower(coalesce(a.title,'')||' '||coalesce(a.description,'')||' '||coalesce(a.instructions,'')||' '||coalesce(a.type,'')||' '||coalesce(a.status,'')) AS search_document
    FROM assignments a CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('assignments.read')
      AND position(p.q IN lower(coalesce(a.title,'')||' '||coalesce(a.description,'')||' '||coalesce(a.instructions,'')||' '||coalesce(a.type,'')||' '||coalesce(a.status,'')))>0
    ORDER BY a.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  messages_b AS (
    SELECT
      'messages'::text                                                                      AS entity_key,
      m.id                                                                                   AS record_id,
      coalesce(m.subject,'Comunicado sem assunto')::text                                    AS title,
      left(regexp_replace(coalesce(m.content,''), E'\\s+', ' ', 'g'), 96)::text         AS subtitle,
      coalesce(m.category,m.priority,'comunicado')::text                                   AS meta,
      'messages'::text                                                                      AS app_id,
      'Comunicados'::text                                                                   AS entity_label,
      lower(coalesce(m.subject,'')||' '||coalesce(m.content,'')||' '||coalesce(m.category,'')||' '||coalesce(m.priority,'')||' '||coalesce(m.status,'')) AS search_document
    FROM messages m CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('messages.read')
      AND position(p.q IN lower(coalesce(m.subject,'')||' '||coalesce(m.content,'')||' '||coalesce(m.category,'')||' '||coalesce(m.priority,'')||' '||coalesce(m.status,'')))>0
    ORDER BY m.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  occurrences_b AS (
    SELECT
      'occurrences'::text                                                                   AS entity_key,
      o.id                                                                                   AS record_id,
      coalesce(o.title,'Ocorrência sem título')::text                                       AS title,
      concat_ws(' • ', o.type, o.date::text, o.reporter_name)::text                        AS subtitle,
      coalesce(o.severity,o.status,'ocorrência')::text                                     AS meta,
      'occurrences'::text                                                                   AS app_id,
      'Ocorrências'::text                                                                   AS entity_label,
      lower(coalesce(o.title,'')||' '||coalesce(o.description,'')||' '||coalesce(o.type,'')||' '||coalesce(o.severity,'')||' '||coalesce(o.status,'')||' '||coalesce(o.date::text,'')||' '||coalesce(o.reporter_name,'')) AS search_document
    FROM occurrences o CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('occurrences.read')
      AND position(p.q IN lower(coalesce(o.title,'')||' '||coalesce(o.description,'')||' '||coalesce(o.type,'')||' '||coalesce(o.severity,'')||' '||coalesce(o.status,'')||' '||coalesce(o.date::text,'')||' '||coalesce(o.reporter_name,'')))>0
    ORDER BY o.date DESC, o.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  library_b AS (
    SELECT
      'library'::text                                                                       AS entity_key,
      li.id                                                                                  AS record_id,
      coalesce(li.title,'Item sem título')::text                                            AS title,
      concat_ws(' • ', li.author, li.isbn)::text                                           AS subtitle,
      coalesce(li.type::text, CASE WHEN li.available_copies > 0 THEN 'disponível' ELSE 'indisponível' END)::text AS meta,
      'library'::text                                                                       AS app_id,
      'Biblioteca'::text                                                                    AS entity_label,
      lower(coalesce(li.title,'')||' '||coalesce(li.author,'')||' '||coalesce(li.isbn,'')||' '||coalesce(li.publisher,'')||' '||coalesce(li.description,'')||' '||coalesce(li.location,'')||' '||coalesce(li.type::text,'')) AS search_document
    FROM library_items li CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('library.read')
      AND position(p.q IN lower(coalesce(li.title,'')||' '||coalesce(li.author,'')||' '||coalesce(li.isbn,'')||' '||coalesce(li.publisher,'')||' '||coalesce(li.description,'')||' '||coalesce(li.location,'')||' '||coalesce(li.type::text,'')))>0
    ORDER BY li.created_at DESC LIMIT (SELECT lim FROM limv)
  ),

  events_b AS (
    SELECT
      'events'::text                                                                        AS entity_key,
      e.id                                                                                   AS record_id,
      coalesce(e.title,'Evento sem título')::text                                           AS title,
      concat_ws(' • ', e.location, e.start_date::text)::text                               AS subtitle,
      coalesce(e.type,e.status,'evento')::text                                             AS meta,
      'schoolcalendar'::text                                                                AS app_id,
      'Calendário'::text                                                                    AS entity_label,
      lower(coalesce(e.title,'')||' '||coalesce(e.description,'')||' '||coalesce(e.location,'')||' '||coalesce(e.type,'')||' '||coalesce(e.status,'')||' '||coalesce(e.start_date::text,'')) AS search_document
    FROM events e CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('calendar.read')
      AND position(p.q IN lower(coalesce(e.title,'')||' '||coalesce(e.description,'')||' '||coalesce(e.location,'')||' '||coalesce(e.type,'')||' '||coalesce(e.status,'')||' '||coalesce(e.start_date::text,'')))>0
    ORDER BY e.start_date DESC LIMIT (SELECT lim FROM limv)
  ),

  users_b AS (
    SELECT
      'users'::text                                                                         AS entity_key,
      up.id                                                                                  AS record_id,
      coalesce(up.full_name,'Usuário sem nome')::text                                       AS title,
      concat_ws(' • ', up.user_email, up.department)::text                                 AS subtitle,
      coalesce(up.profile_type,up.status,'usuário')::text                                  AS meta,
      'users'::text                                                                         AS app_id,
      'Usuários'::text                                                                      AS entity_label,
      lower(coalesce(up.full_name,'')||' '||coalesce(up.user_email,'')||' '||coalesce(up.department,'')||' '||coalesce(up.profile_type,'')||' '||coalesce(up.status,'')) AS search_document
    FROM user_profiles up CROSS JOIN params p
    WHERE length(p.q)>=2 AND auth_has_permission('users.manage')
      AND position(p.q IN lower(coalesce(up.full_name,'')||' '||coalesce(up.user_email,'')||' '||coalesce(up.department,'')||' '||coalesce(up.profile_type,'')||' '||coalesce(up.status,'')))>0
    ORDER BY up.created_at DESC LIMIT (SELECT lim FROM limv)
  )

  SELECT entity_key, record_id, title, subtitle, meta, app_id, entity_label, search_document
  FROM (
    SELECT * FROM students_b    UNION ALL
    SELECT * FROM teachers_b    UNION ALL
    SELECT * FROM classes_b     UNION ALL
    SELECT * FROM subjects_b    UNION ALL
    SELECT * FROM assignments_b UNION ALL
    SELECT * FROM messages_b    UNION ALL
    SELECT * FROM occurrences_b UNION ALL
    SELECT * FROM library_b     UNION ALL
    SELECT * FROM events_b      UNION ALL
    SELECT * FROM users_b
  ) all_results
  LIMIT (SELECT cap FROM params);
$$;
GRANT EXECUTE ON FUNCTION public.search_workspace(text, integer, integer) TO authenticated;

-- 11.2 Dashboard summary
CREATE OR REPLACE FUNCTION dashboard_summary()
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_students',    (SELECT COUNT(*) FROM students WHERE enrollment_status = 'ativo'),
    'total_teachers',    (SELECT COUNT(*) FROM teachers WHERE status = 'ativo'),
    'total_classes',     (SELECT COUNT(*) FROM classes WHERE status = 'ativa'),
    'total_subjects',    (SELECT COUNT(*) FROM subjects WHERE is_active = true),
    'attendance_today',  (
      SELECT json_build_object(
        'present',   COUNT(*) FILTER (WHERE status = 'presente'),
        'absent',    COUNT(*) FILTER (WHERE status = 'ausente'),
        'late',      COUNT(*) FILTER (WHERE status = 'atrasado'),
        'justified', COUNT(*) FILTER (WHERE status = 'justificado')
      ) FROM attendance WHERE date = CURRENT_DATE
    ),
    'active_library_loans', (SELECT COUNT(*) FROM library_loans WHERE status = 'emprestado'),
    'upcoming_events', (
      SELECT COUNT(*) FROM events
      WHERE start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND status = 'confirmado'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 11.3 Student report card
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_student_report_card AS
SELECT
  s.id AS student_id, s.full_name, s.current_class_id,
  sub.id AS subject_id, sub.name AS subject_name, g.bimester, g.year,
  ROUND(AVG(g.score), 2) AS avg_score,
  COUNT(DISTINCT g.id) AS total_evaluations,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'presente') AS total_present,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'ausente') AS total_absent,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'justificado') AS total_justified
FROM students s
LEFT JOIN grades g ON g.student_id = s.id
LEFT JOIN subjects sub ON sub.id = g.subject_id
LEFT JOIN attendance a ON a.student_id = s.id AND a.subject_id = sub.id
WHERE s.enrollment_status = 'ativo'
GROUP BY s.id, s.full_name, s.current_class_id, sub.id, sub.name, g.bimester, g.year;

CREATE INDEX IF NOT EXISTS idx_mv_report_student ON mv_student_report_card(student_id);
CREATE INDEX IF NOT EXISTS idx_mv_report_class   ON mv_student_report_card(current_class_id);

CREATE OR REPLACE FUNCTION refresh_report_card()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_report_card;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_student_report_card(p_student_id UUID)
RETURNS JSON AS $$
  SELECT json_agg(
    json_build_object(
      'subject_name', subject_name, 'bimester', bimester, 'year', year,
      'avg_score', avg_score, 'total_evaluations', total_evaluations,
      'total_present', total_present, 'total_absent', total_absent, 'total_justified', total_justified
    ) ORDER BY subject_name, bimester
  )
  FROM mv_student_report_card WHERE student_id = p_student_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 11.4 Enrollment transaction
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
  v_enrollment_status TEXT := CASE WHEN COALESCE(v_student_payload ->> 'enrollment_status', '') = 'ativo' THEN 'ativo' ELSE 'pendente' END;
  v_approved_at TIMESTAMPTZ := CASE WHEN v_enrollment_status = 'ativo' THEN NOW() ELSE NULL END;
  v_approved_by TEXT := CASE WHEN v_enrollment_status = 'ativo' THEN NULLIF(TRIM(COALESCE(v_requester_payload ->> 'requested_by_email', '')), '') ELSE NULL END;
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
  IF EXISTS (SELECT 1 FROM students WHERE cpf = NULLIF(TRIM(COALESCE(v_student_payload ->> 'cpf', '')), '')) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Ja existe um aluno cadastrado com este CPF.';
  END IF;
  IF NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), '') IS NOT NULL
    AND EXISTS (SELECT 1 FROM students WHERE registration_number = NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), '')) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'A matricula informada ja esta em uso.';
  END IF;
  IF v_create_access AND EXISTS (SELECT 1 FROM user_profiles WHERE user_email = v_effective_email) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Ja existe um perfil vinculado a este e-mail.';
  END IF;
  INSERT INTO students (
    registration_number, full_name, birth_date, cpf, gender, nationality, place_of_birth, marital_status,
    photo_url, email, phone, mobile_phone, address, course, entry_period, entry_method,
    guardian_name, guardian_cpf, guardian_relationship, guardian_phone, guardian_mobile,
    attachments, notes, enrollment_status, enrollment_date, current_class_id, current_grade, shift,
    uses_transport, transport_route, scholarship_percentage, blood_type, allergies, medical_conditions,
    medications, special_needs, emergency_contact, emergency_phone
  ) VALUES (
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
    CASE WHEN jsonb_typeof(v_student_payload -> 'address') = 'object' THEN v_student_payload -> 'address' ELSE NULL END,
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
  ) RETURNING * INTO v_student_record;

  IF v_create_access THEN
    INSERT INTO user_profiles (user_email, full_name, profile_type, status, phone, birth_date, registration_number, approved_by, approved_at)
    VALUES (v_effective_email, v_student_record.full_name, 'aluno', v_enrollment_status, v_student_record.phone, v_student_record.birth_date, v_student_record.registration_number, v_approved_by, v_approved_at)
    RETURNING * INTO v_profile_record;
  END IF;

  RETURN jsonb_build_object(
    'student', to_jsonb(v_student_record),
    'profile', CASE WHEN v_create_access THEN to_jsonb(v_profile_record) ELSE NULL END,
    'accessCreated', v_create_access
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_cleanup_enrollment_transaction(p_student_id UUID, p_profile_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_deleted_student_count INTEGER := 0;
  v_deleted_profile_count INTEGER := 0;
BEGIN
  IF p_profile_id IS NOT NULL THEN
    DELETE FROM user_profiles WHERE id = p_profile_id;
    GET DIAGNOSTICS v_deleted_profile_count = ROW_COUNT;
  END IF;
  DELETE FROM students WHERE id = p_student_id;
  GET DIAGNOSTICS v_deleted_student_count = ROW_COUNT;
  RETURN jsonb_build_object('studentDeleted', v_deleted_student_count > 0, 'profileDeleted', v_deleted_profile_count > 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_create_enrollment_transaction(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_enrollment_transaction(JSONB, JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION admin_cleanup_enrollment_transaction(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_cleanup_enrollment_transaction(UUID, UUID) TO service_role;

-- 11.5 Storage path helpers (alias de utilitários)
CREATE OR REPLACE FUNCTION storage_extract_known_path(raw_value TEXT, bucket_name TEXT DEFAULT 'project-wg-files')
RETURNS TEXT AS $$
DECLARE
  v_trimmed TEXT := NULLIF(BTRIM(raw_value), '');
  v_match TEXT[];
  v_bucket_pattern TEXT := regexp_replace(COALESCE(bucket_name, ''), '([.[\\]{}()*+?^$|\\\\-])', '\\\1', 'g');
BEGIN
  IF v_trimmed IS NULL THEN RETURN NULL; END IF;
  IF v_trimmed !~* '^https?://' THEN RETURN v_trimmed; END IF;
  v_match := regexp_match(v_trimmed, '/storage/v1/object/(?:sign|public|authenticated)/' || v_bucket_pattern || '/([^?]+)');
  IF v_match IS NULL THEN v_match := regexp_match(v_trimmed, '/storage/v1/object/' || v_bucket_pattern || '/([^?]+)'); END IF;
  IF v_match IS NULL OR array_length(v_match, 1) = 0 THEN RETURN NULL; END IF;
  RETURN NULLIF(BTRIM(v_match[1]), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================
-- 12. SEED DATA
-- ============================================================
-- Dados de exemplo/fixture foram removidos do snapshot versionado.
-- Para popular ambientes locais, use seeds locais ignorados pelo Git.
-- ============================================================
-- FIM DO SCRIPT UNIFICADO
-- ============================================================
