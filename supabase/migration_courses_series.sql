-- Migração: Tabelas de Cursos e Séries — EduGest
-- Whykthor GSV

BEGIN;

-- ── Tabela de cursos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  code              TEXT,
  description       TEXT,
  duration_years    INTEGER DEFAULT 1,
  total_hours       INTEGER DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','inativo')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de séries ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS series (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT,
  order_index       INTEGER DEFAULT 1,
  year              INTEGER,
  status            TEXT NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa','inativa')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de vínculo turma-série ────────────────────────────
CREATE TABLE IF NOT EXISTS class_series (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  series_id         UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  academic_year     INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(class_id, academic_year)
);

-- ── Adicionar course_id na tabela students ───────────────────
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Adicionar series_id na tabela subjects ───────────────────
DO $$ BEGIN
  ALTER TABLE subjects ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES series(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_series_course ON series(course_id);
CREATE INDEX IF NOT EXISTS idx_series_status ON series(status);
CREATE INDEX IF NOT EXISTS idx_class_series_class ON class_series(class_id);
CREATE INDEX IF NOT EXISTS idx_class_series_series ON class_series(series_id);
CREATE INDEX IF NOT EXISTS idx_class_series_year ON class_series(academic_year);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_subjects_series ON subjects(series_id);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_series_updated_at ON series;
CREATE TRIGGER trg_series_updated_at
  BEFORE UPDATE ON series
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_series ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para courses ──────────────────────────────
DROP POLICY IF EXISTS "staff read courses" ON courses;
CREATE POLICY "staff read courses" ON courses
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor','aluno')
  );

DROP POLICY IF EXISTS "staff write courses" ON courses;
CREATE POLICY "staff write courses" ON courses
  FOR ALL USING (
    auth_has_permission('courses.write')
  )
  WITH CHECK (
    auth_has_permission('courses.write')
  );

-- ── RLS: Políticas para series ───────────────────────────────
DROP POLICY IF EXISTS "staff read series" ON series;
CREATE POLICY "staff read series" ON series
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor','aluno')
  );

DROP POLICY IF EXISTS "staff write series" ON series;
CREATE POLICY "staff write series" ON series
  FOR ALL USING (
    auth_has_permission('courses.write')
  )
  WITH CHECK (
    auth_has_permission('courses.write')
  );

-- ── RLS: Políticas para class_series ─────────────────────────
DROP POLICY IF EXISTS "staff read class_series" ON class_series;
CREATE POLICY "staff read class_series" ON class_series
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor','aluno')
  );

DROP POLICY IF EXISTS "staff write class_series" ON class_series;
CREATE POLICY "staff write class_series" ON class_series
  FOR ALL USING (
    auth_has_permission('courses.write')
  )
  WITH CHECK (
    auth_has_permission('courses.write')
  );

COMMIT;
