-- Migração: Alertas de Faltas Excessivas — EduGest
-- Whykthor GSV

BEGIN;

-- ── Adicionar coluna de limite de faltas ─────────────────────
DO $$ BEGIN
  ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS absence_threshold INTEGER DEFAULT 25;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Função para verificar alertas de faltas ──────────────────
CREATE OR REPLACE FUNCTION check_absence_alerts()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold INTEGER;
  v_absence_count INTEGER;
  v_student_name TEXT;
  v_class_name TEXT;
BEGIN
  -- Buscar limite de faltas
  SELECT absence_threshold INTO v_threshold
  FROM app_settings WHERE id = 'system';
  
  IF v_threshold IS NULL THEN
    v_threshold := 25;
  END IF;

  -- Contar faltas do aluno na disciplina
  SELECT COUNT(*) INTO v_absence_count
  FROM attendance
  WHERE student_id = NEW.student_id
    AND subject_id = NEW.subject_id
    AND class_id = NEW.class_id
    AND status = 'ausente';

  -- Verificar se excedeu o limite
  IF v_absence_count >= v_threshold THEN
    -- Buscar dados do aluno e turma
    SELECT name INTO v_student_name FROM students WHERE id = NEW.student_id;
    SELECT name INTO v_class_name FROM classes WHERE id = NEW.class_id;

    -- Inserir notificação de alerta
    INSERT INTO notifications (
      recipient_id,
      recipient_type,
      title,
      body,
      type,
      metadata,
      created_at
    ) VALUES (
      NEW.student_id,
      'student',
      'Alerta de Frequência',
      'O aluno ' || COALESCE(v_student_name, 'N/A') || ' atingiu ' || v_absence_count || ' falta(s) na turma ' || COALESCE(v_class_name, 'N/A') || '.',
      'attendance_alert',
      jsonb_build_object(
        'student_id', NEW.student_id,
        'class_id', NEW.class_id,
        'subject_id', NEW.subject_id,
        'absence_count', v_absence_count,
        'threshold', v_threshold
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Criar trigger para alertas de faltas ────────────────────
DROP TRIGGER IF EXISTS trg_check_absence_alerts ON attendance;
CREATE TRIGGER trg_check_absence_alerts
  AFTER INSERT ON attendance
  FOR EACH ROW
  WHEN (NEW.status = 'ausente')
  EXECUTE FUNCTION check_absence_alerts();

-- ── Adicionar tipo de notificação ────────────────────────────
-- O tipo 'attendance_alert' já está sendo usado na função acima

COMMIT;
