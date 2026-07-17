-- Migração: Módulo de Laboratórios — KYRONIX S.E.N.O
-- Whykthor GSV

BEGIN;

-- ── Tabela de laboratórios ───────────────────────────────────
CREATE TABLE IF NOT EXISTS laboratories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  code              TEXT,
  location          TEXT,
  capacity          INTEGER DEFAULT 0,
  description       TEXT,
  resources         TEXT,
  status            TEXT NOT NULL DEFAULT 'disponivel'
                    CHECK (status IN ('disponivel','em_uso','manutencao','fechado')),
  rules             TEXT,
  opening_hours     JSONB DEFAULT '{}'::jsonb,
  attachment_urls   JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de reservas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_reservations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id            UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  requester_id      UUID,
  requester_type    TEXT NOT NULL DEFAULT 'professor'
                    CHECK (requester_type IN ('professor','aluno','coordenador','secretario')),
  class_id          UUID REFERENCES classes(id) ON DELETE SET NULL,
  subject_id        UUID REFERENCES subjects(id) ON DELETE SET NULL,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','confirmada','em_andamento','concluida','cancelada')),
  students_expected INTEGER DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de equipamentos ───────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_equipment (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id            UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  code              TEXT,
  description       TEXT,
  brand             TEXT,
  model             TEXT,
  serial_number     TEXT,
  status            TEXT NOT NULL DEFAULT 'disponivel'
                    CHECK (status IN ('disponivel','em_uso','manutencao','perdido','descontinuado')),
  quantity          INTEGER DEFAULT 1,
  location_detail   TEXT,
  purchase_date     DATE,
  warranty_date     DATE,
  attachment_urls   JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de empréstimos de materiais ───────────────────────
CREATE TABLE IF NOT EXISTS lab_material_loans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id            UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  equipment_id      UUID REFERENCES lab_equipment(id) ON DELETE SET NULL,
  material_name     TEXT NOT NULL,
  borrower_id       UUID NOT NULL,
  borrower_type     TEXT NOT NULL DEFAULT 'aluno'
                    CHECK (borrower_type IN ('aluno','professor','funcionario')),
  quantity          INTEGER DEFAULT 1,
  loan_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  actual_return_date   DATE,
  status            TEXT NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','devolvido','atrasado','perdido')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela de histórico de utilização ────────────────────────
CREATE TABLE IF NOT EXISTS lab_usage_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id            UUID NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
  reservation_id    UUID REFERENCES lab_reservations(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL,
  user_type         TEXT NOT NULL DEFAULT 'professor'
                    CHECK (user_type IN ('professor','aluno','coordenador','secretario')),
  date              DATE NOT NULL,
  start_time        TIME,
  end_time          TIME,
  activity          TEXT NOT NULL,
  students_count    INTEGER DEFAULT 0,
  equipment_used    JSONB DEFAULT '[]'::jsonb,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_laboratories_status ON laboratories(status);
CREATE INDEX IF NOT EXISTS idx_lab_reservations_lab ON lab_reservations(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_reservations_date ON lab_reservations(date);
CREATE INDEX IF NOT EXISTS idx_lab_reservations_status ON lab_reservations(status);
CREATE INDEX IF NOT EXISTS idx_lab_reservations_date_status ON lab_reservations(date, status);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_lab ON lab_equipment(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_equipment_status ON lab_equipment(status);
CREATE INDEX IF NOT EXISTS idx_lab_material_loans_lab ON lab_material_loans(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_material_loans_status ON lab_material_loans(status);
CREATE INDEX IF NOT EXISTS idx_lab_material_loans_borrower ON lab_material_loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_lab_usage_logs_lab ON lab_usage_logs(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_usage_logs_date ON lab_usage_logs(date);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_laboratories_updated_at ON laboratories;
CREATE TRIGGER trg_laboratories_updated_at
  BEFORE UPDATE ON laboratories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lab_reservations_updated_at ON lab_reservations;
CREATE TRIGGER trg_lab_reservations_updated_at
  BEFORE UPDATE ON lab_reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lab_equipment_updated_at ON lab_equipment;
CREATE TRIGGER trg_lab_equipment_updated_at
  BEFORE UPDATE ON lab_equipment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lab_material_loans_updated_at ON lab_material_loans;
CREATE TRIGGER trg_lab_material_loans_updated_at
  BEFORE UPDATE ON lab_material_loans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE laboratories ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_material_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_usage_logs ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para laboratories ─────────────────────────
DROP POLICY IF EXISTS "staff read laboratories" ON laboratories;
CREATE POLICY "staff read laboratories" ON laboratories
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor','aluno')
  );

DROP POLICY IF EXISTS "staff write laboratories" ON laboratories;
CREATE POLICY "staff write laboratories" ON laboratories
  FOR ALL USING (
    auth_has_permission('laboratories.write')
  )
  WITH CHECK (
    auth_has_permission('laboratories.write')
  );

-- ── RLS: Políticas para lab_reservations ─────────────────────
DROP POLICY IF EXISTS "staff read lab_reservations" ON lab_reservations;
CREATE POLICY "staff read lab_reservations" ON lab_reservations
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write lab_reservations" ON lab_reservations;
CREATE POLICY "staff write lab_reservations" ON lab_reservations
  FOR ALL USING (
    auth_has_permission('laboratories.write')
    OR (
      requester_id IN (SELECT id FROM user_profiles WHERE user_email = auth.jwt() ->> 'email')
      AND status = 'pendente'
    )
  )
  WITH CHECK (
    auth_has_permission('laboratories.write')
    OR (
      requester_id IN (SELECT id FROM user_profiles WHERE user_email = auth.jwt() ->> 'email')
      AND status = 'pendente'
    )
  );

-- ── RLS: Políticas para lab_equipment ────────────────────────
DROP POLICY IF EXISTS "staff read lab_equipment" ON lab_equipment;
CREATE POLICY "staff read lab_equipment" ON lab_equipment
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor','aluno')
  );

DROP POLICY IF EXISTS "staff write lab_equipment" ON lab_equipment;
CREATE POLICY "staff write lab_equipment" ON lab_equipment
  FOR ALL USING (
    auth_has_permission('laboratories.write')
  )
  WITH CHECK (
    auth_has_permission('laboratories.write')
  );

-- ── RLS: Políticas para lab_material_loans ───────────────────
DROP POLICY IF EXISTS "staff read lab_material_loans" ON lab_material_loans;
CREATE POLICY "staff read lab_material_loans" ON lab_material_loans
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write lab_material_loans" ON lab_material_loans;
CREATE POLICY "staff write lab_material_loans" ON lab_material_loans
  FOR ALL USING (
    auth_has_permission('laboratories.write')
  )
  WITH CHECK (
    auth_has_permission('laboratories.write')
  );

DROP POLICY IF EXISTS "student read own lab_material_loans" ON lab_material_loans;
CREATE POLICY "student read own lab_material_loans" ON lab_material_loans
  FOR SELECT USING (
    borrower_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

-- ── RLS: Políticas para lab_usage_logs ───────────────────────
DROP POLICY IF EXISTS "staff read lab_usage_logs" ON lab_usage_logs;
CREATE POLICY "staff read lab_usage_logs" ON lab_usage_logs
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write lab_usage_logs" ON lab_usage_logs;
CREATE POLICY "staff write lab_usage_logs" ON lab_usage_logs
  FOR ALL USING (
    auth_has_permission('laboratories.write')
  )
  WITH CHECK (
    auth_has_permission('laboratories.write')
  );

COMMIT;
