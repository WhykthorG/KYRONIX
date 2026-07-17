-- Migração: Trancamento de Matrícula — EduGest
-- Whykthor GSV

BEGIN;

-- ── Adicionar status 'trancado' à tabela students ────────────
DO $$ BEGIN
  ALTER TABLE students DROP CONSTRAINT IF EXISTS students_enrollment_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE students ADD CONSTRAINT students_enrollment_status_check
    CHECK (enrollment_status IN ('ativo','inativo','transferido','formado','evadido','pendente','trancado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Adicionar colunas para trancamento ───────────────────────
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS lock_start_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS lock_end_date DATE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS lock_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Adicionar coluna de motivo de desativação ────────────────
DO $$ BEGIN
  ALTER TABLE students ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Função para trancar matrícula ────────────────────────────
CREATE OR REPLACE FUNCTION lock_student_enrollment(
  p_student_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_lock_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_student RECORD;
BEGIN
  SELECT * INTO v_student FROM students WHERE id = p_student_id FOR UPDATE;
  
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Aluno não encontrado.';
  END IF;
  
  IF v_student.enrollment_status = 'trancado' THEN
    RAISE EXCEPTION 'Matrícula já está trancada.';
  END IF;
  
  UPDATE students
  SET 
    enrollment_status = 'trancado',
    lock_start_date = CURRENT_DATE,
    lock_end_date = p_lock_end_date,
    lock_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_student_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id,
    'lock_start_date', CURRENT_DATE,
    'lock_end_date', p_lock_end_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Função para destrancar matrícula ─────────────────────────
CREATE OR REPLACE FUNCTION unlock_student_enrollment(
  p_student_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_student RECORD;
BEGIN
  SELECT * INTO v_student FROM students WHERE id = p_student_id FOR UPDATE;
  
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Aluno não encontrado.';
  END IF;
  
  IF v_student.enrollment_status != 'trancado' THEN
    RAISE EXCEPTION 'Matrícula não está trancada.';
  END IF;
  
  UPDATE students
  SET 
    enrollment_status = 'ativo',
    lock_start_date = NULL,
    lock_end_date = NULL,
    lock_reason = NULL,
    updated_at = NOW()
  WHERE id = p_student_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'student_id', p_student_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS: Políticas para funções RPC ──────────────────────────
REVOKE ALL ON FUNCTION lock_student_enrollment(UUID, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lock_student_enrollment(UUID, TEXT, DATE) TO authenticated;

REVOKE ALL ON FUNCTION unlock_student_enrollment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION unlock_student_enrollment(UUID) TO authenticated;

COMMIT;
