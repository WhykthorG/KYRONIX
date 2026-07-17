-- Migração: Assinatura Eletrônica — EduGest
-- Whykthor GSV

BEGIN;

-- ── Tabela de assinaturas de documentos ──────────────────────
CREATE TABLE IF NOT EXISTS document_signatures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type     TEXT NOT NULL,
  document_id       UUID NOT NULL,
  signer_id         UUID NOT NULL,
  signer_name       TEXT NOT NULL,
  signer_role       TEXT,
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','assinado','rejeitado','expirado')),
  signed_at         TIMESTAMPTZ,
  expires_at        DATE,
  signature_hash    TEXT,
  notes             TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_document_signatures_document ON document_signatures(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_signer ON document_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_status ON document_signatures(status);
CREATE INDEX IF NOT EXISTS idx_document_signatures_hash ON document_signatures(signature_hash);

-- ── Triggers updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_document_signatures_updated_at ON document_signatures;
CREATE TRIGGER trg_document_signatures_updated_at
  BEFORE UPDATE ON document_signatures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS: Habilitar ───────────────────────────────────────────
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- ── RLS: Políticas para document_signatures ──────────────────
DROP POLICY IF EXISTS "staff read document_signatures" ON document_signatures;
CREATE POLICY "staff read document_signatures" ON document_signatures
  FOR SELECT USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );

DROP POLICY IF EXISTS "staff write document_signatures" ON document_signatures;
CREATE POLICY "staff write document_signatures" ON document_signatures
  FOR ALL USING (
    auth_has_permission('users.manage')
  )
  WITH CHECK (
    auth_has_permission('users.manage')
  );

DROP POLICY IF EXISTS "user read own document_signatures" ON document_signatures;
CREATE POLICY "user read own document_signatures" ON document_signatures
  FOR SELECT USING (
    signer_id IN (SELECT id FROM user_profiles WHERE user_email = auth.jwt() ->> 'email')
  );

COMMIT;
