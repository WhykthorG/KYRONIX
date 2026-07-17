-- Migração: Sistema de Certificados — EduGest
-- Whykthor GSV

BEGIN;

-- ── Tabela de certificados ───────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type              TEXT NOT NULL
                    CHECK (type IN ('conclusao','declaracao','historico','modulo','curso')),
  title             TEXT NOT NULL,
  description       TEXT,
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until       DATE,
  series_number     TEXT,
  status            TEXT NOT NULL DEFAULT 'emitido'
                    CHECK (status IN ('emitido','cancelado','expirado')),
  pdf_url           TEXT,
  issued_by         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_type ON certificates(type);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_issue_date ON certificates(issue_date);
CREATE INDEX IF NOT EXISTS idx_certificates_series_number ON certificates(series_number);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_certificates_updated_at ON certificates;
CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para certificates ─────────────────────────
DROP POLICY IF EXISTS "staff read certificates" ON certificates;
CREATE POLICY "staff read certificates" ON certificates
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write certificates" ON certificates;
CREATE POLICY "staff write certificates" ON certificates
  FOR ALL USING (
    auth_has_permission('certificates.write')
  )
  WITH CHECK (
    auth_has_permission('certificates.write')
  );

DROP POLICY IF EXISTS "student read own certificates" ON certificates;
CREATE POLICY "student read own certificates" ON certificates
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "guardian read linked certificates" ON certificates;
CREATE POLICY "guardian read linked certificates" ON certificates
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT student_id FROM auth_linked_student_ids())
  );

-- ── Adicionar permissão certificates.write ───────────────────
-- Nota: A permissão será adicionada via access.js no frontend

COMMIT;
