BEGIN;

CREATE TABLE IF NOT EXISTS guardian_student_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guardian_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (guardian_profile_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_student_links_guardian
  ON guardian_student_links(guardian_profile_id);

CREATE INDEX IF NOT EXISTS idx_guardian_student_links_student
  ON guardian_student_links(student_id);

DROP TRIGGER IF EXISTS trg_guardian_student_links_updated_at ON guardian_student_links;
CREATE TRIGGER trg_guardian_student_links_updated_at
  BEFORE UPDATE ON guardian_student_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION auth_linked_student_ids()
RETURNS TABLE(student_id UUID) AS $$
  SELECT guardian_student_links.student_id
  FROM guardian_student_links
  JOIN user_profiles guardian_profile ON guardian_profile.id = guardian_student_links.guardian_profile_id
  WHERE guardian_student_links.guardian_profile_id = auth_profile_id()
    AND guardian_profile.profile_type = 'responsavel'
    AND guardian_profile.status = 'ativo';
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION list_guardian_portal_students()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  registration_number TEXT,
  enrollment_status TEXT,
  current_class_id UUID,
  current_grade TEXT,
  shift TEXT,
  course TEXT,
  attachments JSONB
) AS $$
  SELECT
    students.id,
    students.full_name,
    students.registration_number,
    students.enrollment_status,
    students.current_class_id,
    students.current_grade,
    students.shift,
    students.course,
    COALESCE(students.attachments, '[]'::jsonb)
  FROM students
  WHERE auth_has_permission('guardian_portal.view')
    AND students.id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  ORDER BY students.full_name;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION list_guardian_portal_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_guardian_portal_students() TO authenticated;

ALTER TABLE guardian_student_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guardians read own links" ON guardian_student_links;
DROP POLICY IF EXISTS "staff manage guardian links" ON guardian_student_links;
CREATE POLICY "guardians read own links" ON guardian_student_links
  FOR SELECT USING (guardian_profile_id = auth_profile_id());
CREATE POLICY "staff manage guardian links" ON guardian_student_links
  FOR ALL
  USING (auth_has_permission('users.manage'))
  WITH CHECK (auth_has_permission('users.manage'));

DROP POLICY IF EXISTS "guardian read linked grades" ON grades;
CREATE POLICY "guardian read linked grades" ON grades
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  );

DROP POLICY IF EXISTS "guardian read linked attendance" ON attendance;
CREATE POLICY "guardian read linked attendance" ON attendance
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  );

DROP POLICY IF EXISTS "guardian read linked messages" ON messages;
CREATE POLICY "guardian read linked messages" ON messages
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND (
      recipient_type = 'todos'
      OR (
        recipient_type = 'turma'
        AND class_id IN (
          SELECT students.current_class_id
          FROM students
          WHERE students.id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
        )
      )
      OR (
        recipient_type = 'aluno'
        AND EXISTS (
          SELECT 1
          FROM auth_linked_student_ids()
          WHERE auth_linked_student_ids.student_id = ANY(messages.recipient_ids)
        )
      )
    )
  );

COMMIT;
