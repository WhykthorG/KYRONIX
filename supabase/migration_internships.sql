-- Migração: Módulo de Estágio Supervisionado — KYRONIX S.E.N.O
-- Whykthor GSV

BEGIN;

-- ── Tabela de empresas conveniadas ────────────────────────────
CREATE TABLE IF NOT EXISTS internship_companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  cnpj              TEXT,
  address           JSONB DEFAULT '{}'::jsonb,
  phone             TEXT,
  email             TEXT,
  contact_name      TEXT,
  contact_role      TEXT,
  partnership_date  DATE,
  status            TEXT NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa','inativa','suspenso')),
  notes             TEXT,
  attachment_urls   JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de supervisores de estágio ─────────────────────────
CREATE TABLE IF NOT EXISTS internship_supervisors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES internship_companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  role              TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela principal de estágios ──────────────────────────────
CREATE TABLE IF NOT EXISTS internships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES internship_companies(id) ON DELETE SET NULL,
  supervisor_id     UUID REFERENCES internship_supervisors(id) ON DELETE SET NULL,
  teacher_advisor_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  class_id          UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject_id        UUID REFERENCES subjects(id) ON DELETE SET NULL,
  start_date        DATE NOT NULL,
  end_date          DATE,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aprovado','em_andamento','concluido','cancelado','reprovado')),
  hours_required    INTEGER DEFAULT 0,
  hours_completed   INTEGER DEFAULT 0,
  description       TEXT,
  objectives        TEXT,
  activities        TEXT,
  evaluation_notes  TEXT,
  supervisor_grade  NUMERIC(4,2),
  supervisor_notes  TEXT,
  final_grade       NUMERIC(4,2),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  attachment_urls   JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de diário de estágio ──────────────────────────────
CREATE TABLE IF NOT EXISTS internship_diary (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id     UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  start_time        TIME,
  end_time          TIME,
  hours             NUMERIC(4,2) NOT NULL DEFAULT 0,
  activities_performed TEXT NOT NULL,
  challenges        TEXT,
  learnings         TEXT,
  supervisor_feedback TEXT,
  attachment_urls   JSONB DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','aprovado','rejeitado')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de avaliações de estágio ──────────────────────────
CREATE TABLE IF NOT EXISTS internship_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  internship_id     UUID NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  evaluator_type    TEXT NOT NULL CHECK (evaluator_type IN ('supervisor','teacher','company')),
  evaluator_id      UUID,
  evaluation_date   DATE NOT NULL,
  criteria          JSONB DEFAULT '[]'::jsonb,
  overall_grade     NUMERIC(4,2),
  comments          TEXT,
  strengths         TEXT,
  improvements      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_internship_companies_status ON internship_companies(status);
CREATE INDEX IF NOT EXISTS idx_internship_supervisors_company ON internship_supervisors(company_id);
CREATE INDEX IF NOT EXISTS idx_internships_student ON internships(student_id);
CREATE INDEX IF NOT EXISTS idx_internships_company ON internships(company_id);
CREATE INDEX IF NOT EXISTS idx_internships_status ON internships(status);
CREATE INDEX IF NOT EXISTS idx_internships_status_created ON internships(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internships_class ON internships(class_id);
CREATE INDEX IF NOT EXISTS idx_internship_diary_internship ON internship_diary(internship_id);
CREATE INDEX IF NOT EXISTS idx_internship_diary_date ON internship_diary(date);
CREATE INDEX IF NOT EXISTS idx_internship_evaluations_internship ON internship_evaluations(internship_id);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_internship_companies_updated_at ON internship_companies;
CREATE TRIGGER trg_internship_companies_updated_at
  BEFORE UPDATE ON internship_companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_internship_supervisors_updated_at ON internship_supervisors;
CREATE TRIGGER trg_internship_supervisors_updated_at
  BEFORE UPDATE ON internship_supervisors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_internships_updated_at ON internships;
CREATE TRIGGER trg_internships_updated_at
  BEFORE UPDATE ON internships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_internship_diary_updated_at ON internship_diary;
CREATE TRIGGER trg_internship_diary_updated_at
  BEFORE UPDATE ON internship_diary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE internship_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE internships ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_evaluations ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para internship_companies ─────────────────
DROP POLICY IF EXISTS "staff read internship_companies" ON internship_companies;
CREATE POLICY "staff read internship_companies" ON internship_companies
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write internship_companies" ON internship_companies;
CREATE POLICY "staff write internship_companies" ON internship_companies
  FOR ALL USING (
    auth_has_permission('internship_companies.write')
  )
  WITH CHECK (
    auth_has_permission('internship_companies.write')
  );

-- ── RLS: Políticas para internship_supervisors ───────────────
DROP POLICY IF EXISTS "staff read internship_supervisors" ON internship_supervisors;
CREATE POLICY "staff read internship_supervisors" ON internship_supervisors
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write internship_supervisors" ON internship_supervisors;
CREATE POLICY "staff write internship_supervisors" ON internship_supervisors
  FOR ALL USING (
    auth_has_permission('internship_companies.write')
  )
  WITH CHECK (
    auth_has_permission('internship_companies.write')
  );

-- ── RLS: Políticas para internships ──────────────────────────
DROP POLICY IF EXISTS "staff read internships" ON internships;
CREATE POLICY "staff read internships" ON internships
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write internships" ON internships;
CREATE POLICY "staff write internships" ON internships
  FOR ALL USING (
    auth_has_permission('internships.write')
  )
  WITH CHECK (
    auth_has_permission('internships.write')
  );

DROP POLICY IF EXISTS "student read own internships" ON internships;
CREATE POLICY "student read own internships" ON internships
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "guardian read linked internships" ON internships;
CREATE POLICY "guardian read linked internships" ON internships
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT student_id FROM auth_linked_student_ids())
  );

-- ── RLS: Políticas para internship_diary ─────────────────────
DROP POLICY IF EXISTS "staff read internship_diary" ON internship_diary;
CREATE POLICY "staff read internship_diary" ON internship_diary
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write internship_diary" ON internship_diary;
CREATE POLICY "staff write internship_diary" ON internship_diary
  FOR ALL USING (
    auth_has_permission('internships.write')
  )
  WITH CHECK (
    auth_has_permission('internships.write')
  );

DROP POLICY IF EXISTS "student read own internship_diary" ON internship_diary;
CREATE POLICY "student read own internship_diary" ON internship_diary
  FOR SELECT USING (
    internship_id IN (
      SELECT id FROM internships
      WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "student write own internship_diary" ON internship_diary;
CREATE POLICY "student write own internship_diary" ON internship_diary
  FOR ALL USING (
    auth_has_permission('internships.write')
    OR (
      status = 'rascunho'
      AND internship_id IN (
        SELECT id FROM internships
        WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
      )
    )
  )
  WITH CHECK (
    auth_has_permission('internships.write')
    OR (
      status = 'rascunho'
      AND internship_id IN (
        SELECT id FROM internships
        WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
      )
    )
  );

-- ── RLS: Políticas para internship_evaluations ───────────────
DROP POLICY IF EXISTS "staff read internship_evaluations" ON internship_evaluations;
CREATE POLICY "staff read internship_evaluations" ON internship_evaluations
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write internship_evaluations" ON internship_evaluations;
CREATE POLICY "staff write internship_evaluations" ON internship_evaluations
  FOR ALL USING (
    auth_has_permission('internships.write')
  )
  WITH CHECK (
    auth_has_permission('internships.write')
  );

DROP POLICY IF EXISTS "student read own internship_evaluations" ON internship_evaluations;
CREATE POLICY "student read own internship_evaluations" ON internship_evaluations
  FOR SELECT USING (
    internship_id IN (
      SELECT id FROM internships
      WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
    )
  );

COMMIT;
