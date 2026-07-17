-- Migração: Módulo de TCC/Projeto Integrador — KYRONIX S.E.N.O
-- Whykthor GSV

BEGIN;

-- ── Tabela principal de TCCs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tcc_projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  theme             TEXT,
  description       TEXT,
  advisor_id        UUID REFERENCES teachers(id) ON DELETE SET NULL,
  co_advisor_id     UUID REFERENCES teachers(id) ON DELETE SET NULL,
  class_id          UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject_id        UUID REFERENCES subjects(id) ON DELETE SET NULL,
  start_date        DATE,
  expected_end_date DATE,
  defense_date      DATE,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','em_andamento','entregue','em_avaliacao','aprovado','reprovado','cancelado')),
  phase             TEXT NOT NULL DEFAULT 'selecao_tema'
                    CHECK (phase IN ('selecao_tema','orientacao','pesquisa','redacao','revisao','final')),
  final_grade       NUMERIC(4,2),
  advisor_notes     TEXT,
  keywords          JSONB DEFAULT '[]'::jsonb,
  objectives        TEXT,
  methodology       TEXT,
  results           TEXT,
  conclusion        TEXT,
  attachment_urls   JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de alunos do TCC (many-to-many) ───────────────────
CREATE TABLE IF NOT EXISTS tcc_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tcc_id            UUID NOT NULL REFERENCES tcc_projects(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role              TEXT NOT NULL DEFAULT 'membro'
                    CHECK (role IN ('lider','membro','colaborador')),
  contribution_notes TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tcc_id, student_id)
);

-- ── Tabela de entregas ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS tcc_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tcc_id            UUID NOT NULL REFERENCES tcc_projects(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  due_date          DATE,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','entregue','atrasada','aceita','rejeitada')),
  grade             NUMERIC(4,2),
  feedback          TEXT,
  attachment_urls   JSONB DEFAULT '[]'::jsonb,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de bancas avaliadoras ────────────────────────────
CREATE TABLE IF NOT EXISTS tcc_bancas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tcc_id            UUID NOT NULL REFERENCES tcc_projects(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  time              TIME,
  location          TEXT,
  status            TEXT NOT NULL DEFAULT 'agendada'
                    CHECK (status IN ('agendada','em_andamento','realizada','cancelada')),
  members           JSONB DEFAULT '[]'::jsonb,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de orientações ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tcc_orientations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tcc_id            UUID NOT NULL REFERENCES tcc_projects(id) ON DELETE CASCADE,
  advisor_id        UUID REFERENCES teachers(id) ON DELETE SET NULL,
  orientation_date  DATE NOT NULL,
  duration_minutes  INTEGER DEFAULT 60,
  content           TEXT NOT NULL,
  tasks_assigned    TEXT,
  next_steps        TEXT,
  student_feedback  TEXT,
  attachment_urls   JSONB DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tcc_projects_status ON tcc_projects(status);
CREATE INDEX IF IF NOT EXISTS idx_tcc_projects_phase ON tcc_projects(phase);
CREATE INDEX IF NOT EXISTS idx_tcc_projects_advisor ON tcc_projects(advisor_id);
CREATE INDEX IF NOT EXISTS idx_tcc_projects_class ON tcc_projects(class_id);
CREATE INDEX IF NOT EXISTS idx_tcc_projects_status_created ON tcc_projects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcc_members_tcc ON tcc_members(tcc_id);
CREATE INDEX IF NOT EXISTS idx_tcc_members_student ON tcc_members(student_id);
CREATE INDEX IF NOT EXISTS idx_tcc_deliveries_tcc ON tcc_deliveries(tcc_id);
CREATE INDEX IF NOT EXISTS idx_tcc_deliveries_status ON tcc_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_tcc_bancas_tcc ON tcc_bancas(tcc_id);
CREATE INDEX IF NOT EXISTS idx_tcc_bancas_date ON tcc_bancas(date);
CREATE INDEX IF NOT EXISTS idx_tcc_orientations_tcc ON tcc_orientations(tcc_id);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_tcc_projects_updated_at ON tcc_projects;
CREATE TRIGGER trg_tcc_projects_updated_at
  BEFORE UPDATE ON tcc_projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tcc_deliveries_updated_at ON tcc_deliveries;
CREATE TRIGGER trg_tcc_deliveries_updated_at
  BEFORE UPDATE ON tcc_deliveries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tcc_bancas_updated_at ON tcc_bancas;
CREATE TRIGGER trg_tcc_bancas_updated_at
  BEFORE UPDATE ON tcc_bancas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE tcc_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcc_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcc_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcc_bancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tcc_orientations ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para tcc_projects ─────────────────────────
DROP POLICY IF EXISTS "staff read tcc_projects" ON tcc_projects;
CREATE POLICY "staff read tcc_projects" ON tcc_projects
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write tcc_projects" ON tcc_projects;
CREATE POLICY "staff write tcc_projects" ON tcc_projects
  FOR ALL USING (
    auth_has_permission('tcc.write')
  )
  WITH CHECK (
    auth_has_permission('tcc.write')
  );

DROP POLICY IF EXISTS "student read own tcc_projects" ON tcc_projects;
CREATE POLICY "student read own tcc_projects" ON tcc_projects
  FOR SELECT USING (
    id IN (SELECT tcc_id FROM tcc_members WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS "guardian read linked tcc_projects" ON tcc_projects;
CREATE POLICY "guardian read linked tcc_projects" ON tcc_projects
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND id IN (SELECT tcc_id FROM tcc_members WHERE student_id IN (SELECT student_id FROM auth_linked_student_ids()))
  );

-- ── RLS: Políticas para tcc_members ──────────────────────────
DROP POLICY IF EXISTS "staff read tcc_members" ON tcc_members;
CREATE POLICY "staff read tcc_members" ON tcc_members
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write tcc_members" ON tcc_members;
CREATE POLICY "staff write tcc_members" ON tcc_members
  FOR ALL USING (
    auth_has_permission('tcc.write')
  )
  WITH CHECK (
    auth_has_permission('tcc.write')
  );

DROP POLICY IF EXISTS "student read own tcc_members" ON tcc_members;
CREATE POLICY "student read own tcc_members" ON tcc_members
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

-- ── RLS: Políticas para tcc_deliveries ───────────────────────
DROP POLICY IF EXISTS "staff read tcc_deliveries" ON tcc_deliveries;
CREATE POLICY "staff read tcc_deliveries" ON tcc_deliveries
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write tcc_deliveries" ON tcc_deliveries;
CREATE POLICY "staff write tcc_deliveries" ON tcc_deliveries
  FOR ALL USING (
    auth_has_permission('tcc.write')
  )
  WITH CHECK (
    auth_has_permission('tcc.write')
  );

DROP POLICY IF EXISTS "student read own tcc_deliveries" ON tcc_deliveries;
CREATE POLICY "student read own tcc_deliveries" ON tcc_deliveries
  FOR SELECT USING (
    tcc_id IN (SELECT tcc_id FROM tcc_members WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email'))
  );

-- ── RLS: Políticas para tcc_bancas ───────────────────────────
DROP POLICY IF EXISTS "staff read tcc_bancas" ON tcc_bancas;
CREATE POLICY "staff read tcc_bancas" ON tcc_bancas
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write tcc_bancas" ON tcc_bancas;
CREATE POLICY "staff write tcc_bancas" ON tcc_bancas
  FOR ALL USING (
    auth_has_permission('tcc.write')
  )
  WITH CHECK (
    auth_has_permission('tcc.write')
  );

DROP POLICY IF EXISTS "student read own tcc_bancas" ON tcc_bancas;
CREATE POLICY "student read own tcc_bancas" ON tcc_bancas
  FOR SELECT USING (
    tcc_id IN (SELECT tcc_id FROM tcc_members WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email'))
  );

-- ── RLS: Políticas para tcc_orientations ─────────────────────
DROP POLICY IF EXISTS "staff read tcc_orientations" ON tcc_orientations;
CREATE POLICY "staff read tcc_orientations" ON tcc_orientations
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write tcc_orientations" ON tcc_orientations;
CREATE POLICY "staff write tcc_orientations" ON tcc_orientations
  FOR ALL USING (
    auth_has_permission('tcc.write')
  )
  WITH CHECK (
    auth_has_permission('tcc.write')
  );

DROP POLICY IF EXISTS "student read own tcc_orientations" ON tcc_orientations;
CREATE POLICY "student read own tcc_orientations" ON tcc_orientations
  FOR SELECT USING (
    tcc_id IN (SELECT tcc_id FROM tcc_members WHERE student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email'))
  );

COMMIT;
