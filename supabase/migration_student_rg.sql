-- Migração: Campo RG na tabela students — EduGest
-- Whykthor GSV

BEGIN;

-- ── Adicionar coluna RG na tabela students ───────────────────
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS rg TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Adicionar coluna data de emissão do RG ───────────────────
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS rg_issue_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Adicionar coluna órgão emissor do RG ─────────────────────
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS rg_issuer TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Índice para busca por RG ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_rg ON students(rg);

COMMIT;
