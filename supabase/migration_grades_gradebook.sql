BEGIN;

ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS assignment_id UUID,
  ADD COLUMN IF NOT EXISTS grade_slot TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'grades_grade_slot_check'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT grades_grade_slot_check
      CHECK (grade_slot IN ('atividade_1','atividade_2','atividade_3','atividade_4','recuperacao'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_grades_assignment ON grades(assignment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_grades_assignment'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT fk_grades_assignment
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_grades_term_slot_unique
  ON grades(student_id, subject_id, class_id, bimester, year, grade_slot)
  WHERE grade_slot IS NOT NULL;

COMMIT;
