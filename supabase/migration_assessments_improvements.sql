-- Migração: Melhorias no módulo de Avaliações — KYRONIX S.E.N.O
-- Whykthor GSV

BEGIN;

-- ── Tabela de segunda chamada ────────────────────────────────
CREATE TABLE IF NOT EXISTS second_chances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id        UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id        UUID REFERENCES teachers(id) ON DELETE SET NULL,
  bimester          INTEGER NOT NULL CHECK (bimester BETWEEN 1 AND 4),
  year              INTEGER NOT NULL,
  scheduled_date    DATE,
  scheduled_time    TIME,
  location          TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','agendada','realizada','cancelada','dispensada')),
  original_grade    NUMERIC(4,2),
  new_grade         NUMERIC(4,2),
  max_score         NUMERIC(4,2) DEFAULT 10,
  weight            NUMERIC(4,2) DEFAULT 1,
  notes             TEXT,
  justification     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de conselho de classe ─────────────────────────────
CREATE TABLE IF NOT EXISTS class_councils (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year     INTEGER NOT NULL,
  bimester          INTEGER NOT NULL CHECK (bimester BETWEEN 1 AND 4),
  scheduled_date    DATE NOT NULL,
  scheduled_time    TIME,
  location          TEXT,
  status            TEXT NOT NULL DEFAULT 'agendado'
                    CHECK (status IN ('agendado','em_andamento','realizado','cancelado')),
  coordinator_id    UUID REFERENCES teachers(id) ON DELETE SET NULL,
  participants      JSONB DEFAULT '[]'::jsonb,
  agenda            TEXT,
  minutes           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de decisões do conselho ───────────────────────────
CREATE TABLE IF NOT EXISTS council_decisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id        UUID NOT NULL REFERENCES class_councils(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  decision          TEXT NOT NULL
                    CHECK (decision IN ('aprovado','reprovado','recuperacao','condicional','transferencia','evasao')),
  average_grade     NUMERIC(4,2),
  attendance_rate   NUMERIC(5,2),
  observations      TEXT,
  recommended_actions TEXT,
  follow_up_date    DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_second_chances_student ON second_chances(student_id);
CREATE INDEX IF NOT EXISTS idx_second_chances_subject ON second_chances(subject_id);
CREATE INDEX IF NOT EXISTS idx_second_chances_class ON second_chances(class_id);
CREATE INDEX IF NOT EXISTS idx_second_chances_status ON second_chances(status);
CREATE INDEX IF NOT EXISTS idx_second_chances_year_bimester ON second_chances(year, bimester);
CREATE INDEX IF NOT EXISTS idx_class_councils_class ON class_councils(class_id);
CREATE INDEX IF NOT EXISTS idx_class_councils_status ON class_councils(status);
CREATE INDEX IF NOT EXISTS idx_class_councils_date ON class_councils(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_council_decisions_council ON council_decisions(council_id);
CREATE INDEX IF NOT EXISTS idx_council_decisions_student ON council_decisions(student_id);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_second_chances_updated_at ON second_chances;
CREATE TRIGGER trg_second_chances_updated_at
  BEFORE UPDATE ON second_chances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_class_councils_updated_at ON class_councils;
CREATE TRIGGER trg_class_councils_updated_at
  BEFORE UPDATE ON class_councils
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE second_chances ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_councils ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_decisions ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para second_chances ───────────────────────
DROP POLICY IF EXISTS "staff read second_chances" ON second_chances;
CREATE POLICY "staff read second_chances" ON second_chances
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write second_chances" ON second_chances;
CREATE POLICY "staff write second_chances" ON second_chances
  FOR ALL USING (
    auth_has_permission('grades.write')
  )
  WITH CHECK (
    auth_has_permission('grades.write')
  );

DROP POLICY IF EXISTS "student read own second_chances" ON second_chances;
CREATE POLICY "student read own second_chances" ON second_chances
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

-- ── RLS: Políticas para class_councils ───────────────────────
DROP POLICY IF EXISTS "staff read class_councils" ON class_councils;
CREATE POLICY "staff read class_councils" ON class_councils
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write class_councils" ON class_councils;
CREATE POLICY "staff write class_councils" ON class_councils
  FOR ALL USING (
    auth_has_permission('grades.write')
  )
  WITH CHECK (
    auth_has_permission('grades.write')
  );

-- ── RLS: Políticas para council_decisions ────────────────────
DROP POLICY IF EXISTS "staff read council_decisions" ON council_decisions;
CREATE POLICY "staff read council_decisions" ON council_decisions
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write council_decisions" ON council_decisions;
CREATE POLICY "staff write council_decisions" ON council_decisions
  FOR ALL USING (
    auth_has_permission('grades.write')
  )
  WITH CHECK (
    auth_has_permission('grades.write')
  );

DROP POLICY IF EXISTS "student read own council_decisions" ON council_decisions;
CREATE POLICY "student read own council_decisions" ON council_decisions
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

-- ── Adicionar tipo de avaliação melhorado ────────────────────
DO $$ BEGIN
  ALTER TABLE assignments ADD COLUMN IF NOT EXISTS evaluation_type TEXT
    CHECK (evaluation_type IN ('prova','trabalho','projeto','apresentacao','pratica','oral','lição_de_casa','participacao','outro'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Função para buscar alunos elegíveis para segunda chamada ──
CREATE OR REPLACE FUNCTION get_eligible_students_for_second_chance(
  p_class_id UUID,
  p_subject_id UUID,
  p_bimester INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  current_grade NUMERIC,
  attendance_rate NUMERIC,
  is_eligible BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS student_id,
    s.name AS student_name,
    COALESCE(
      (SELECT g.score FROM grades g
       WHERE g.student_id = s.id
         AND g.subject_id = p_subject_id
         AND g.class_id = p_class_id
         AND g.bimester = p_bimester
         AND g.year = p_year
       LIMIT 1),
      0
    ) AS current_grade,
    COALESCE(
      (SELECT
        CASE WHEN COUNT(*) > 0
          THEN (COUNT(*) FILTER (WHERE a.status = 'presente')::NUMERIC / COUNT(*)::NUMERIC) * 100
          ELSE 100
        END
       FROM attendance a
       WHERE a.student_id = s.id
         AND a.subject_id = p_subject_id
         AND a.class_id = p_class_id
         AND EXTRACT(YEAR FROM a.date) = p_year
      ),
      100
    ) AS attendance_rate,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM grades g
        WHERE g.student_id = s.id
          AND g.subject_id = p_subject_id
          AND g.class_id = p_class_id
          AND g.bimester = p_bimester
          AND g.year = p_year
          AND g.score >= 3 AND g.score < 6
      ) THEN TRUE
      ELSE FALSE
    END AS is_eligible
  FROM students s
  WHERE s.id IN (
    SELECT ce.student_id FROM class_enrollments ce
    WHERE ce.class_id = p_class_id AND ce.status = 'ativa'
  )
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS: Políticas para funções RPC ──────────────────────────
REVOKE ALL ON FUNCTION get_eligible_students_for_second_chance(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_eligible_students_for_second_chance(UUID, UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
