-- ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
-- ============================================================
-- NORMALIZED SCHEMA - PROJECT WG ESCOLA
-- Escopo: modelo operacional relacional normalizado ate 5NF
-- onde ha ganho tecnico real. Estruturas documentais de log,
-- eventos e estado de workspace permanecem sem decomposicao
-- excessiva.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        UUID UNIQUE,
  user_email          TEXT NOT NULL UNIQUE,
  full_name           TEXT NOT NULL,
  profile_type        TEXT NOT NULL
                      CHECK (profile_type IN ('aluno','professor','coordenador','secretario','administrador','responsavel')),
  status              TEXT NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo','inativo','pendente')),
  phone               TEXT,
  birth_date          DATE,
  document_id         TEXT,
  department          TEXT,
  notes               TEXT,
  avatar_url          TEXT,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  is_first_login      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS app_settings (
  id                          TEXT PRIMARY KEY DEFAULT 'system' CHECK (id = 'system'),
  school_name                 TEXT NOT NULL,
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

-- ============================================================
-- PESSOAS E ACADEMICO
-- ============================================================

CREATE TABLE IF NOT EXISTS guardians (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID UNIQUE REFERENCES user_profiles(id) ON DELETE SET NULL,
  full_name             TEXT NOT NULL,
  cpf                   TEXT UNIQUE,
  email                 TEXT,
  phone                 TEXT,
  mobile_phone          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_guardians_updated_at ON guardians;
CREATE TRIGGER trg_guardians_updated_at
BEFORE UPDATE ON guardians
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS students (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID UNIQUE REFERENCES user_profiles(id) ON DELETE SET NULL,
  registration_number   TEXT NOT NULL UNIQUE,
  full_name             TEXT NOT NULL,
  birth_date            DATE NOT NULL,
  cpf                   TEXT NOT NULL UNIQUE,
  gender                TEXT CHECK (gender IN ('masculino','feminino','outro')),
  nationality           TEXT,
  place_of_birth        TEXT,
  marital_status        TEXT CHECK (marital_status IN ('solteiro','casado','viuvo','divorciado','outro')),
  email                 TEXT,
  phone                 TEXT,
  mobile_phone          TEXT,
  course                TEXT,
  entry_period          TEXT,
  entry_method          TEXT CHECK (entry_method IN ('vestibular','enem','transferencia','portador_diploma','outro')),
  photo_url             TEXT,
  notes                 TEXT,
  enrollment_status     TEXT NOT NULL DEFAULT 'pendente'
                        CHECK (enrollment_status IN ('ativo','inativo','transferido','formado','evadido','pendente')),
  enrollment_date       DATE,
  uses_transport        BOOLEAN NOT NULL DEFAULT FALSE,
  transport_route       TEXT,
  scholarship_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS student_guardians (
  student_id             UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id            UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship_type      TEXT NOT NULL
                         CHECK (relationship_type IN ('pai','mae','avo','tio','responsavel_legal','outro')),
  is_primary             BOOLEAN NOT NULL DEFAULT FALSE,
  can_pick_up            BOOLEAN NOT NULL DEFAULT TRUE,
  receives_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, guardian_id)
);

DROP TRIGGER IF EXISTS trg_student_guardians_updated_at ON student_guardians;
CREATE TRIGGER trg_student_guardians_updated_at
BEFORE UPDATE ON student_guardians
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS teachers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        UUID UNIQUE REFERENCES user_profiles(id) ON DELETE SET NULL,
  employee_id       TEXT UNIQUE,
  full_name         TEXT NOT NULL,
  cpf               TEXT NOT NULL UNIQUE,
  rg                TEXT,
  birth_date        DATE,
  gender            TEXT CHECK (gender IN ('masculino','feminino','outro')),
  email             TEXT,
  phone             TEXT,
  education_level   TEXT,
  degree_area       TEXT,
  institution       TEXT,
  hire_date         DATE,
  contract_type     TEXT CHECK (contract_type IN ('clt','pj','temporario','substituto')),
  workload_hours    INTEGER,
  salary            NUMERIC(10,2),
  status            TEXT NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','inativo','licenca','demitido')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_teachers_updated_at ON teachers;
CREATE TRIGGER trg_teachers_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS subjects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  area              TEXT,
  grade_level       TEXT,
  weekly_hours      INTEGER,
  total_hours       INTEGER,
  syllabus          TEXT,
  objectives        TEXT,
  competencies      TEXT,
  bibliography      TEXT,
  is_mandatory      BOOLEAN NOT NULL DEFAULT TRUE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON subjects;
CREATE TRIGGER trg_subjects_updated_at
BEFORE UPDATE ON subjects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id         UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id         UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS classes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  academic_year     INTEGER NOT NULL,
  grade_level       TEXT,
  shift             TEXT CHECK (shift IN ('matutino','vespertino','noturno','integral')),
  classroom         TEXT,
  max_students      INTEGER NOT NULL DEFAULT 40,
  coordinator_id    UUID REFERENCES teachers(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa','encerrada','planejada')),
  start_date        DATE,
  end_date          DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_classes_updated_at ON classes;
CREATE TRIGGER trg_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS class_enrollments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year     INTEGER NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE,
  status            TEXT NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa','encerrada','transferida','cancelada')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, class_id, academic_year)
);

DROP TRIGGER IF EXISTS trg_class_enrollments_updated_at ON class_enrollments;
CREATE TRIGGER trg_class_enrollments_updated_at
BEFORE UPDATE ON class_enrollments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS class_offerings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id        UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id        UUID REFERENCES teachers(id) ON DELETE SET NULL,
  academic_year     INTEGER NOT NULL,
  semester          INTEGER NOT NULL CHECK (semester IN (1,2)),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, subject_id, teacher_id, academic_year, semester)
);

DROP TRIGGER IF EXISTS trg_class_offerings_updated_at ON class_offerings;
CREATE TRIGGER trg_class_offerings_updated_at
BEFORE UPDATE ON class_offerings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_offering_id UUID NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  room              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_offering_id, day_of_week, start_time, end_time)
);

DROP TRIGGER IF EXISTS trg_schedules_updated_at ON schedules;
CREATE TRIGGER trg_schedules_updated_at
BEFORE UPDATE ON schedules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     UUID NOT NULL REFERENCES class_enrollments(id) ON DELETE CASCADE,
  class_offering_id UUID NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  attendance_date   DATE NOT NULL,
  lesson_number     INTEGER,
  status            TEXT NOT NULL CHECK (status IN ('presente','ausente','justificado','atrasado')),
  justification     TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, class_offering_id, attendance_date, lesson_number)
);

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE TRIGGER trg_attendance_updated_at
BEFORE UPDATE ON attendance
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- AVALIACOES E ENTREGAS
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_offering_id     UUID NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  instructions          TEXT,
  evaluation_kind       TEXT NOT NULL CHECK (evaluation_kind IN ('assignment','exam','project','oral','recovery','other')),
  bimester              INTEGER CHECK (bimester BETWEEN 1 AND 4),
  max_score             NUMERIC(5,2) NOT NULL DEFAULT 10,
  weight                NUMERIC(4,2) NOT NULL DEFAULT 1,
  due_date              TIMESTAMPTZ,
  evaluation_date       DATE,
  grade_slot            TEXT CHECK (grade_slot IN ('atividade_1','atividade_2','atividade_3','atividade_4','recuperacao')),
  allow_late_submission BOOLEAN NOT NULL DEFAULT FALSE,
  late_penalty_percent  NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_group_work         BOOLEAN NOT NULL DEFAULT FALSE,
  max_group_size        INTEGER,
  plagiarism_check      BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho','publicado','encerrado','arquivado')),
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_evaluations_updated_at ON evaluations;
CREATE TRIGGER trg_evaluations_updated_at
BEFORE UPDATE ON evaluations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS evaluation_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id     UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  file_url          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evaluation_id, file_url)
);

CREATE TABLE IF NOT EXISTS evaluation_allowed_formats (
  evaluation_id     UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  format_code       TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (evaluation_id, format_code)
);

CREATE TABLE IF NOT EXISTS student_evaluation_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id     UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score             NUMERIC(5,2),
  feedback          TEXT,
  status            TEXT NOT NULL DEFAULT 'publicado'
                    CHECK (status IN ('rascunho','publicado','revisado')),
  graded_at         TIMESTAMPTZ,
  graded_by         UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evaluation_id, student_id)
);

DROP TRIGGER IF EXISTS trg_student_evaluation_results_updated_at ON student_evaluation_results;
CREATE TRIGGER trg_student_evaluation_results_updated_at
BEFORE UPDATE ON student_evaluation_results
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id      UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content            TEXT,
  submitted_at       TIMESTAMPTZ,
  is_late            BOOLEAN NOT NULL DEFAULT FALSE,
  status             TEXT NOT NULL DEFAULT 'enviado'
                     CHECK (status IN ('rascunho','enviado','em_revisao','corrigido','devolvido')),
  score              NUMERIC(5,2),
  feedback           TEXT,
  feedback_file_url  TEXT,
  graded_at          TIMESTAMPTZ,
  graded_by          UUID REFERENCES teachers(id) ON DELETE SET NULL,
  plagiarism_score   NUMERIC(5,2),
  revision_count     INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evaluation_id, student_id)
);

DROP TRIGGER IF EXISTS trg_submissions_updated_at ON submissions;
CREATE TRIGGER trg_submissions_updated_at
BEFORE UPDATE ON submissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS submission_group_members (
  submission_id      UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (submission_id, student_id)
);

CREATE TABLE IF NOT EXISTS submission_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id      UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_url           TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, file_url)
);

CREATE TABLE IF NOT EXISTS assignment_views (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id      UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  first_viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  view_count         INTEGER NOT NULL DEFAULT 1 CHECK (view_count >= 1),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evaluation_id, student_id)
);

DROP TRIGGER IF EXISTS trg_assignment_views_updated_at ON assignment_views;
CREATE TRIGGER trg_assignment_views_updated_at
BEFORE UPDATE ON assignment_views
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- COMUNICACAO
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  subject           TEXT NOT NULL,
  content           TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('baixa','normal','alta','urgente')),
  category          TEXT,
  scheduled_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','agendado','enviado','falhou')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS message_channels (
  message_id         UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL CHECK (channel IN ('app','email')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, channel)
);

CREATE TABLE IF NOT EXISTS message_targets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id         UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  target_kind        TEXT NOT NULL CHECK (target_kind IN ('all','class','profile','role')),
  class_id           UUID REFERENCES classes(id) ON DELETE CASCADE,
  profile_id         UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_code          TEXT CHECK (role_code IN ('aluno','professor','coordenador','secretario','administrador','responsavel')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_targets_atomic_target_check CHECK (
    (target_kind = 'all' AND class_id IS NULL AND profile_id IS NULL AND role_code IS NULL) OR
    (target_kind = 'class' AND class_id IS NOT NULL AND profile_id IS NULL AND role_code IS NULL) OR
    (target_kind = 'profile' AND class_id IS NULL AND profile_id IS NOT NULL AND role_code IS NULL) OR
    (target_kind = 'role' AND class_id IS NULL AND profile_id IS NULL AND role_code IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id         UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  profile_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  read_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, profile_id)
);

CREATE TABLE IF NOT EXISTS message_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id         UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_url           TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, file_url)
);

CREATE TABLE IF NOT EXISTS events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT,
  type               TEXT,
  start_date         DATE NOT NULL,
  end_date           DATE,
  all_day            BOOLEAN NOT NULL DEFAULT TRUE,
  location           TEXT,
  is_online          BOOLEAN NOT NULL DEFAULT FALSE,
  meeting_url        TEXT,
  color              TEXT DEFAULT '#6366f1',
  is_mandatory       BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_days_before INTEGER NOT NULL DEFAULT 1,
  status             TEXT NOT NULL DEFAULT 'confirmado'
                     CHECK (status IN ('planejado','confirmado','cancelado','concluido')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS event_targets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  target_kind        TEXT NOT NULL CHECK (target_kind IN ('all','class','profile','role')),
  class_id           UUID REFERENCES classes(id) ON DELETE CASCADE,
  profile_id         UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_code          TEXT CHECK (role_code IN ('aluno','professor','coordenador','secretario','administrador','responsavel')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_targets_atomic_target_check CHECK (
    (target_kind = 'all' AND class_id IS NULL AND profile_id IS NULL AND role_code IS NULL) OR
    (target_kind = 'class' AND class_id IS NOT NULL AND profile_id IS NULL AND role_code IS NULL) OR
    (target_kind = 'profile' AND class_id IS NULL AND profile_id IS NOT NULL AND role_code IS NULL) OR
    (target_kind = 'role' AND class_id IS NULL AND profile_id IS NULL AND role_code IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS direct_conversations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_direct_conversations_updated_at ON direct_conversations;
CREATE TRIGGER trg_direct_conversations_updated_at
BEFORE UPDATE ON direct_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS direct_conversation_participants (
  conversation_id    UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  profile_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, profile_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_profile_id  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  content            TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_direct_messages_updated_at ON direct_messages;
CREATE TRIGGER trg_direct_messages_updated_at
BEFORE UPDATE ON direct_messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- PEDAGOGICO, BIBLIOTECA E APOIO
-- ============================================================

CREATE TABLE IF NOT EXISTS lesson_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id         UUID REFERENCES teachers(id) ON DELETE SET NULL,
  subject_id         UUID REFERENCES subjects(id) ON DELETE SET NULL,
  grade_level        TEXT,
  title              TEXT NOT NULL,
  duration_minutes   INTEGER,
  theme              TEXT,
  objectives         TEXT,
  content            TEXT,
  methodology        TEXT,
  resources          TEXT,
  evaluation         TEXT,
  homework           TEXT,
  "references"       TEXT,
  competencies       TEXT,
  status             TEXT NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho','publicado','arquivado')),
  times_used         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_lesson_plans_updated_at ON lesson_plans;
CREATE TRIGGER trg_lesson_plans_updated_at
BEFORE UPDATE ON lesson_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS lesson_plan_tags (
  lesson_plan_id     UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  tag                TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lesson_plan_id, tag)
);

CREATE TABLE IF NOT EXISTS lesson_plan_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id     UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  file_url           TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lesson_plan_id, file_url)
);

CREATE TABLE IF NOT EXISTS class_diary (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_offering_id  UUID NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  lesson_plan_id     UUID REFERENCES lesson_plans(id) ON DELETE SET NULL,
  diary_date         DATE NOT NULL,
  lesson_number      INTEGER,
  start_time         TIME,
  end_time           TIME,
  content            TEXT,
  objectives         TEXT,
  methodology        TEXT,
  homework           TEXT,
  observations       TEXT,
  status             TEXT NOT NULL DEFAULT 'rascunho'
                     CHECK (status IN ('rascunho','publicado','revisado')),
  attendance_registered BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_class_diary_updated_at ON class_diary;
CREATE TRIGGER trg_class_diary_updated_at
BEFORE UPDATE ON class_diary
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS class_diary_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_diary_id     UUID NOT NULL REFERENCES class_diary(id) ON DELETE CASCADE,
  file_url           TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_diary_id, file_url)
);

CREATE TABLE IF NOT EXISTS homework (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_offering_id  UUID NOT NULL REFERENCES class_offerings(id) ON DELETE CASCADE,
  teacher_id         UUID REFERENCES teachers(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  due_date           DATE NOT NULL,
  estimated_minutes  INTEGER,
  status             TEXT NOT NULL DEFAULT 'ativa'
                     CHECK (status IN ('ativa','encerrada','cancelada')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_homework_updated_at ON homework;
CREATE TRIGGER trg_homework_updated_at
BEFORE UPDATE ON homework
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS homework_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id        UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  file_url           TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homework_id, file_url)
);

CREATE TABLE IF NOT EXISTS homework_completions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id        UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','concluido')),
  completed_at       TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (homework_id, student_id)
);

DROP TRIGGER IF EXISTS trg_homework_completions_updated_at ON homework_completions;
CREATE TRIGGER trg_homework_completions_updated_at
BEFORE UPDATE ON homework_completions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS teacher_calendar_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id         UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  related_class_id   UUID REFERENCES classes(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  event_type         TEXT,
  start_datetime     TIMESTAMPTZ NOT NULL,
  end_datetime       TIMESTAMPTZ,
  all_day            BOOLEAN NOT NULL DEFAULT FALSE,
  location           TEXT,
  is_online          BOOLEAN NOT NULL DEFAULT FALSE,
  meeting_url        TEXT,
  visibility         TEXT NOT NULL DEFAULT 'privado'
                     CHECK (visibility IN ('privado','equipe','todos')),
  color              TEXT DEFAULT '#6366f1',
  reminder_minutes_before INTEGER NOT NULL DEFAULT 30,
  recurrence         TEXT,
  external_calendar_id TEXT,
  external_calendar_type TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_teacher_calendar_events_updated_at ON teacher_calendar_events;
CREATE TRIGGER trg_teacher_calendar_events_updated_at
BEFORE UPDATE ON teacher_calendar_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS teacher_calendar_event_students (
  event_id           UUID NOT NULL REFERENCES teacher_calendar_events(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, student_id)
);

CREATE TABLE IF NOT EXISTS occurrences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reporter_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  type               TEXT,
  severity           TEXT CHECK (severity IN ('leve','moderada','grave','critica')),
  title              TEXT NOT NULL,
  description        TEXT,
  occurrence_date    DATE NOT NULL,
  location           TEXT,
  witnesses          TEXT,
  action_taken       TEXT,
  guardian_notified  BOOLEAN NOT NULL DEFAULT FALSE,
  notification_date  DATE,
  guardian_response  TEXT,
  follow_up_date     DATE,
  follow_up_notes    TEXT,
  status             TEXT NOT NULL DEFAULT 'aberta'
                     CHECK (status IN ('aberta','em_acompanhamento','resolvida','arquivada')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_occurrences_updated_at ON occurrences;
CREATE TRIGGER trg_occurrences_updated_at
BEFORE UPDATE ON occurrences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS occurrence_files (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id      UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  file_url           TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (occurrence_id, file_url)
);

CREATE TABLE IF NOT EXISTS library_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('livro','jogo','periodico','dvd','ebook','outro')),
  author             TEXT,
  isbn               TEXT,
  publisher          TEXT,
  publication_year   INTEGER,
  edition            TEXT,
  category           TEXT,
  subject_area       TEXT,
  description        TEXT,
  cover_url          TEXT,
  file_url           TEXT,
  is_digital         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_library_items_updated_at ON library_items;
CREATE TRIGGER trg_library_items_updated_at
BEFORE UPDATE ON library_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS library_item_tags (
  item_id            UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  tag                TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, tag)
);

CREATE TABLE IF NOT EXISTS library_item_copies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id            UUID NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  copy_code          TEXT NOT NULL UNIQUE,
  location           TEXT,
  status             TEXT NOT NULL DEFAULT 'disponivel'
                     CHECK (status IN ('disponivel','emprestado','manutencao','perdido','descartado')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_library_item_copies_updated_at ON library_item_copies;
CREATE TRIGGER trg_library_item_copies_updated_at
BEFORE UPDATE ON library_item_copies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS library_loans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id            UUID NOT NULL REFERENCES library_item_copies(id) ON DELETE RESTRICT,
  borrower_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  loan_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date           DATE NOT NULL,
  return_date        DATE,
  renewed_count      INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'emprestado'
                     CHECK (status IN ('emprestado','devolvido','atrasado','perdido')),
  fine_amount        NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_library_loans_updated_at ON library_loans;
CREATE TRIGGER trg_library_loans_updated_at
BEFORE UPDATE ON library_loans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS goals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id         UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  category           TEXT,
  target_metric      TEXT,
  current_value      NUMERIC,
  target_value       NUMERIC,
  unit               TEXT,
  start_date         DATE,
  target_date        DATE,
  time_frame         TEXT,
  priority           TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status             TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','pausado','cancelado')),
  progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  reflections        TEXT,
  obstacles          TEXT,
  strategies         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at
BEFORE UPDATE ON goals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS goal_shares (
  goal_id            UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  profile_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (goal_id, profile_id)
);

CREATE TABLE IF NOT EXISTS goal_milestones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id            UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  target_date        DATE,
  achieved_at        TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','concluido','cancelado')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_goal_milestones_updated_at ON goal_milestones;
CREATE TRIGGER trg_goal_milestones_updated_at
BEFORE UPDATE ON goal_milestones
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS goal_tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id            UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  due_date           DATE,
  estimated_hours    NUMERIC(5,2),
  actual_hours       NUMERIC(5,2),
  priority           TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status             TEXT NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente','em_progresso','concluido','cancelado')),
  completed_at       TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_goal_tasks_updated_at ON goal_tasks;
CREATE TRIGGER trg_goal_tasks_updated_at
BEFORE UPDATE ON goal_tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type         TEXT NOT NULL CHECK (event_type IN ('enrollment_created','document_pending','message_posted','access_reset')),
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  app_status         TEXT NOT NULL DEFAULT 'entregue' CHECK (app_status IN ('entregue','lida','dispensada')),
  email_status       TEXT NOT NULL DEFAULT 'dispensado' CHECK (email_status IN ('pendente','enviado','falhou','dispensado')),
  email_error        TEXT,
  action_app         TEXT,
  action_label       TEXT,
  action_record_id   UUID,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at            TIMESTAMPTZ,
  dismissed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notification_channels (
  notification_id    UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL CHECK (channel IN ('app','email')),
  PRIMARY KEY (notification_id, channel)
);

-- ============================================================
-- TABELAS DOCUMENTAIS / TECNICAS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table       TEXT NOT NULL,
  record_id          TEXT,
  action             TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  actor_user_id      UUID,
  actor_email        TEXT,
  actor_name         TEXT,
  actor_profile_type TEXT,
  changed_fields     TEXT[] NOT NULL DEFAULT '{}',
  previous_record    JSONB,
  new_record         JSONB,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observability_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel            TEXT NOT NULL CHECK (channel IN ('frontend','backend')),
  event_type         TEXT NOT NULL,
  level              TEXT NOT NULL CHECK (level IN ('info','warning','error','critical')),
  trace_id           TEXT,
  operation          TEXT,
  source             TEXT,
  route              TEXT,
  message            TEXT NOT NULL,
  actor_user_id      UUID,
  actor_email        TEXT,
  actor_name         TEXT,
  actor_profile_type TEXT,
  context            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type         TEXT NOT NULL,
  aggregate_type     TEXT NOT NULL,
  aggregate_id       TEXT,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','processed','failed','discarded')),
  idempotency_key    TEXT,
  available_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at       TIMESTAMPTZ,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_system_events_updated_at ON system_events;
CREATE TRIGGER trg_system_events_updated_at
BEFORE UPDATE ON system_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope              TEXT NOT NULL DEFAULT 'global',
  idempotency_key    TEXT NOT NULL,
  request_hash       TEXT,
  status             TEXT NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','completed','failed','expired')),
  response_code      INTEGER,
  response_body      JSONB,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_until       TIMESTAMPTZ,
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, idempotency_key)
);

DROP TRIGGER IF EXISTS trg_idempotency_keys_updated_at ON idempotency_keys;
CREATE TRIGGER trg_idempotency_keys_updated_at
BEFORE UPDATE ON idempotency_keys
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS user_workspace_state (
  user_id            UUID PRIMARY KEY,
  state              JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_workspace_state_updated_at ON user_workspace_state;
CREATE TRIGGER trg_user_workspace_state_updated_at
BEFORE UPDATE ON user_workspace_state
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- INDICES ESSENCIAIS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(full_name);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_guardians_full_name ON guardians(full_name);
CREATE INDEX IF NOT EXISTS idx_teachers_full_name ON teachers(full_name);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_offerings_class ON class_offerings(class_id);
CREATE INDEX IF NOT EXISTS idx_class_offerings_subject ON class_offerings(subject_id);
CREATE INDEX IF NOT EXISTS idx_schedules_offering_day ON schedules(class_offering_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_evaluations_offering ON evaluations(class_offering_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluation_results_student ON student_evaluation_results(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_profile_id);
CREATE INDEX IF NOT EXISTS idx_message_targets_message ON message_targets(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_profile ON message_reads(profile_id);
CREATE INDEX IF NOT EXISTS idx_library_loans_borrower ON library_loans(borrower_profile_id);
CREATE INDEX IF NOT EXISTS idx_goal_shares_profile ON goal_shares(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_profile_id);
