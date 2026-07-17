-- Migração: Melhorias no módulo de Gestão de Usuários — EduGest
-- Whykthor GSV

BEGIN;

-- ── Adicionar coluna de motivo de desativação ────────────────
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Adicionar coluna de último acesso ────────────────────────
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Adicionar coluna de contagem de logins ───────────────────
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_type ON user_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(user_email);

-- ── Função para registrar último acesso ──────────────────────
CREATE OR REPLACE FUNCTION update_user_last_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_profiles
  SET 
    last_login_at = NOW(),
    login_count = COALESCE(login_count, 0) + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS: Políticas para funções RPC ──────────────────────────
REVOKE ALL ON FUNCTION update_user_last_login(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_last_login(UUID) TO authenticated;

-- ── Adicionar permissões para gestão de laboratórios e TCC ──
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMIT;
