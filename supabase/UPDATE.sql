-- ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
-- ============================================================
-- UPDATE.sql
-- Consolidado enxuto gerado apenas a partir de migration_*.sql
-- Ordem de aplicacao recomendada do projeto
-- ============================================================

-- >>> BEGIN migration_security_baseline.sql
-- ============================================================
-- Security baseline for direct-client access
-- Apply this in Supabase SQL Editor before exposing the app
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION auth_profile_type()
RETURNS TEXT AS $$
  SELECT profile_type FROM user_profiles
  WHERE user_email = auth.jwt() ->> 'email'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile readable" ON user_profiles;
DROP POLICY IF EXISTS "admin read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "admin manage profiles" ON user_profiles;
CREATE POLICY "own profile readable" ON user_profiles
  FOR SELECT USING (user_email = auth.jwt() ->> 'email');
CREATE POLICY "admin read all profiles" ON user_profiles
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario'));
CREATE POLICY "admin manage profiles" ON user_profiles
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador'));

DROP POLICY IF EXISTS "staff read students" ON students;
DROP POLICY IF EXISTS "staff write students" ON students;
DROP POLICY IF EXISTS "student reads self" ON students;
CREATE POLICY "staff read students" ON students
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
CREATE POLICY "staff write students" ON students
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','secretario'));
CREATE POLICY "student reads self" ON students
  FOR SELECT USING (email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "staff read teachers" ON teachers;
DROP POLICY IF EXISTS "admin write teachers" ON teachers;
CREATE POLICY "staff read teachers" ON teachers
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
CREATE POLICY "admin write teachers" ON teachers
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador'));

DROP POLICY IF EXISTS "all authenticated read subjects" ON subjects;
DROP POLICY IF EXISTS "admin write subjects" ON subjects;
CREATE POLICY "all authenticated read subjects" ON subjects
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin write subjects" ON subjects
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador'));

DROP POLICY IF EXISTS "all authenticated read classes" ON classes;
DROP POLICY IF EXISTS "admin write classes" ON classes;
CREATE POLICY "all authenticated read classes" ON classes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin write classes" ON classes
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','secretario'));

DROP POLICY IF EXISTS "all authenticated read events" ON events;
DROP POLICY IF EXISTS "staff write events" ON events;
DROP POLICY IF EXISTS "students cannot manage events" ON events;
CREATE POLICY "all authenticated read events" ON events
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "staff write events" ON events
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
CREATE POLICY "students cannot manage events" ON events
  FOR ALL USING (auth_profile_type() != 'aluno');

DROP POLICY IF EXISTS "all authenticated read schedules" ON schedules;
DROP POLICY IF EXISTS "admin write schedules" ON schedules;
CREATE POLICY "all authenticated read schedules" ON schedules
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin write schedules" ON schedules
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador'));

DROP POLICY IF EXISTS "staff read grades" ON grades;
DROP POLICY IF EXISTS "teacher write grades" ON grades;
DROP POLICY IF EXISTS "student read own grades" ON grades;
CREATE POLICY "staff read grades" ON grades
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
CREATE POLICY "teacher write grades" ON grades
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','professor'));
CREATE POLICY "student read own grades" ON grades
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "staff read attendance" ON attendance;
DROP POLICY IF EXISTS "teacher write attendance" ON attendance;
DROP POLICY IF EXISTS "student read own attendance" ON attendance;
CREATE POLICY "staff read attendance" ON attendance
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
CREATE POLICY "teacher write attendance" ON attendance
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','professor'));
CREATE POLICY "student read own attendance" ON attendance
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "all read published assignments" ON assignments;
DROP POLICY IF EXISTS "teacher write assignments" ON assignments;
CREATE POLICY "all read published assignments" ON assignments
  FOR SELECT USING (
    status = 'publicado'
    OR auth_profile_type() IN ('administrador','coordenador','professor')
  );
CREATE POLICY "teacher write assignments" ON assignments
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','professor'));

DROP POLICY IF EXISTS "all authenticated read messages" ON messages;
DROP POLICY IF EXISTS "staff write messages" ON messages;
DROP POLICY IF EXISTS "student write class messages" ON messages;
DROP POLICY IF EXISTS "messages_select_by_audience" ON messages;
DROP POLICY IF EXISTS "messages_insert_staff" ON messages;
DROP POLICY IF EXISTS "messages_insert_student_class" ON messages;
DROP POLICY IF EXISTS "messages_update_staff" ON messages;
DROP POLICY IF EXISTS "messages_delete_staff" ON messages;
CREATE POLICY "messages_select_by_audience"
  ON messages
  FOR SELECT
  USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
    OR recipient_type = 'todos'
    OR (
      recipient_type = 'turma'
      AND class_id IN (
        SELECT current_class_id
        FROM students
        WHERE email = auth.jwt() ->> 'email'
      )
    )
    OR (
      recipient_type = 'aluno'
      AND EXISTS (
        SELECT 1
        FROM students s
        WHERE s.email = auth.jwt() ->> 'email'
          AND s.id = ANY(messages.recipient_ids)
      )
    )
  );
CREATE POLICY "messages_insert_staff"
  ON messages
  FOR INSERT
  WITH CHECK (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
CREATE POLICY "messages_insert_student_class"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth_profile_type() = 'aluno'
    AND recipient_type = 'turma'
    AND class_id IN (
      SELECT current_class_id
      FROM students
      WHERE email = auth.jwt() ->> 'email'
    )
  );
CREATE POLICY "messages_update_staff"
  ON messages
  FOR UPDATE
  USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'))
  WITH CHECK (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
CREATE POLICY "messages_delete_staff"
  ON messages
  FOR DELETE
  USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));

DROP POLICY IF EXISTS "student manage own submissions" ON submissions;
DROP POLICY IF EXISTS "teacher read submissions" ON submissions;
DROP POLICY IF EXISTS "teacher grade submissions" ON submissions;
CREATE POLICY "student manage own submissions" ON submissions
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );
CREATE POLICY "teacher read submissions" ON submissions
  FOR SELECT USING (auth_profile_type() IN ('professor','coordenador','administrador'));
CREATE POLICY "teacher grade submissions" ON submissions
  FOR UPDATE USING (auth_profile_type() IN ('professor','coordenador','administrador'));

DROP POLICY IF EXISTS "teacher manage diary" ON class_diary;
DROP POLICY IF EXISTS "teacher manage lesson_plans" ON lesson_plans;
DROP POLICY IF EXISTS "teacher manage own calendar" ON teacher_calendar_events;
CREATE POLICY "teacher manage diary" ON class_diary
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','professor'));
CREATE POLICY "teacher manage lesson_plans" ON lesson_plans
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','professor'));
CREATE POLICY "teacher manage own calendar" ON teacher_calendar_events
  FOR ALL USING (
    teacher_id IN (SELECT id FROM teachers WHERE email = auth.jwt() ->> 'email')
    OR auth_profile_type() IN ('administrador','coordenador')
  );

DROP POLICY IF EXISTS "all auth read homework" ON homework;
DROP POLICY IF EXISTS "teacher write homework" ON homework;
DROP POLICY IF EXISTS "student manage own completions" ON homework_completions;
DROP POLICY IF EXISTS "teacher read completions" ON homework_completions;
CREATE POLICY "all auth read homework" ON homework
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "teacher write homework" ON homework
  FOR ALL USING (auth_profile_type() IN ('professor','coordenador','administrador'));
CREATE POLICY "student manage own completions" ON homework_completions
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE email = auth.jwt() ->> 'email')
  );
CREATE POLICY "teacher read completions" ON homework_completions
  FOR SELECT USING (auth_profile_type() IN ('professor','coordenador','administrador'));

DROP POLICY IF EXISTS "users manage own messages" ON direct_messages;
DROP POLICY IF EXISTS "dm_select_own" ON direct_messages;
DROP POLICY IF EXISTS "dm_insert_sender_only" ON direct_messages;
DROP POLICY IF EXISTS "dm_update_recipient_read" ON direct_messages;
DROP POLICY IF EXISTS "dm_delete_sender_only" ON direct_messages;
CREATE POLICY "dm_select_own"
  ON direct_messages
  FOR SELECT
  USING (
    sender_email = auth.jwt() ->> 'email'
    OR recipient_email = auth.jwt() ->> 'email'
  );
CREATE POLICY "dm_insert_sender_only"
  ON direct_messages
  FOR INSERT
  WITH CHECK (
    sender_email = auth.jwt() ->> 'email'
    AND recipient_email IS NOT NULL
    AND content IS NOT NULL
  );
CREATE POLICY "dm_update_recipient_read"
  ON direct_messages
  FOR UPDATE
  USING (recipient_email = auth.jwt() ->> 'email')
  WITH CHECK (recipient_email = auth.jwt() ->> 'email');
CREATE POLICY "dm_delete_sender_only"
  ON direct_messages
  FOR DELETE
  USING (sender_email = auth.jwt() ->> 'email');

-- `storage.objects` is managed by Supabase Storage. Define policies on it,
-- but do not try to toggle RLS here, otherwise the migration can fail with
-- "must be owner of table objects".
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-wg-files', 'project-wg-files', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false;

DROP POLICY IF EXISTS "staff_manage_school_files" ON storage.objects;
DROP POLICY IF EXISTS "student_upload_own_submissions" ON storage.objects;
DROP POLICY IF EXISTS "student_read_own_submission_files" ON storage.objects;
CREATE POLICY "staff_manage_school_files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  )
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() IN ('administrador','coordenador','secretario','professor')
  );
CREATE POLICY "student_upload_own_submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );
CREATE POLICY "student_read_own_submission_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

COMMIT;
-- <<< END migration_security_baseline.sql

-- >>> BEGIN migration_rbac_permissions.sql
-- ============================================================
-- RBAC permission helpers for RLS-sensitive policies
-- Mirrors the static permission matrix used by the application
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION auth_profile_type()
RETURNS TEXT AS $$
  SELECT profile_type FROM user_profiles
  WHERE user_email = auth.jwt() ->> 'email'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_permissions_for_profile(p_profile_type TEXT DEFAULT auth_profile_type())
RETURNS TEXT[] AS $$
  SELECT CASE COALESCE(p_profile_type, '')
    WHEN 'aluno' THEN ARRAY[
      'students.read.self',
      'classes.read',
      'subjects.read',
      'grades.read',
      'attendance.read',
      'assignments.read',
      'calendar.read',
      'messages.read',
      'messages.write.own_class',
      'library.read',
      'goals.manage.self'
    ]::TEXT[]
    WHEN 'professor' THEN ARRAY[
      'students.read',
      'teachers.read',
      'classes.read',
      'subjects.read',
      'grades.read',
      'grades.write',
      'attendance.read',
      'attendance.write',
      'assignments.read',
      'assignments.write',
      'calendar.read',
      'teacher_calendar.view',
      'messages.read',
      'messages.write',
      'library.read',
      'occurrences.read',
      'occurrences.write',
      'diary.write',
      'lesson_plans.write',
      'goals.read.all',
      'teacher_portal.view',
      'academic_record.view',
      'submissions.read.all',
      'submissions.grade',
      'direct_chat.use'
    ]::TEXT[]
    WHEN 'secretario' THEN ARRAY[
      'dashboard.view',
      'students.read',
      'students.write',
      'teachers.read',
      'classes.read',
      'classes.write',
      'subjects.read',
      'grades.read',
      'attendance.read',
      'calendar.read',
      'messages.read',
      'messages.write',
      'library.read',
      'library.write',
      'library_loans.read',
      'library_loans.write',
      'reports.view',
      'occurrences.read',
      'occurrences.write',
      'academic_record.view',
      'registration.view',
      'enrollments.manage',
      'settings.read',
      'settings.write',
      'audit.read',
      'events.write',
      'direct_chat.use'
    ]::TEXT[]
    WHEN 'coordenador' THEN ARRAY[
      'dashboard.view',
      'students.read',
      'students.write',
      'teachers.read',
      'teachers.write',
      'classes.read',
      'classes.write',
      'subjects.read',
      'subjects.write',
      'grades.read',
      'grades.write',
      'attendance.read',
      'attendance.write',
      'assignments.read',
      'assignments.write',
      'calendar.read',
      'teacher_calendar.view',
      'teacher_calendar.manage.all',
      'messages.read',
      'messages.write',
      'library.read',
      'library_loans.read',
      'reports.view',
      'occurrences.read',
      'occurrences.write',
      'diary.write',
      'lesson_plans.write',
      'goals.read.all',
      'teacher_portal.view',
      'academic_record.view',
      'registration.view',
      'enrollments.manage',
      'users.manage',
      'users.manage.administrative',
      'settings.read',
      'settings.write',
      'audit.read',
      'events.write',
      'submissions.read.all',
      'submissions.grade',
      'direct_chat.use'
    ]::TEXT[]
    WHEN 'administrador' THEN ARRAY[
      'dashboard.view',
      'students.read',
      'students.write',
      'teachers.read',
      'teachers.write',
      'classes.read',
      'classes.write',
      'subjects.read',
      'subjects.write',
      'grades.read',
      'grades.write',
      'attendance.read',
      'attendance.write',
      'assignments.read',
      'assignments.write',
      'calendar.read',
      'teacher_calendar.view',
      'teacher_calendar.manage.all',
      'messages.read',
      'messages.write',
      'library.read',
      'library.write',
      'library_loans.read',
      'library_loans.write',
      'reports.view',
      'occurrences.read',
      'occurrences.write',
      'diary.write',
      'lesson_plans.write',
      'goals.read.all',
      'teacher_portal.view',
      'academic_record.view',
      'registration.view',
      'enrollments.manage',
      'users.manage',
      'users.manage.administrative',
      'settings.read',
      'settings.write',
      'audit.read',
      'events.write',
      'submissions.read.all',
      'submissions.grade',
      'direct_chat.use'
    ]::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION auth_has_permission(permission_name TEXT, p_profile_type TEXT DEFAULT auth_profile_type())
RETURNS BOOLEAN AS $$
  SELECT COALESCE(permission_name = ANY(auth_permissions_for_profile(p_profile_type)), FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "admin manage profiles" ON user_profiles;
CREATE POLICY "admin manage profiles" ON user_profiles
  FOR ALL
  USING (auth_has_permission('users.manage.administrative'))
  WITH CHECK (auth_has_permission('users.manage.administrative'));

DROP POLICY IF EXISTS "staff read app settings" ON app_settings;
DROP POLICY IF EXISTS "staff write app settings" ON app_settings;
CREATE POLICY "staff read app settings" ON app_settings
  FOR SELECT
  USING (auth_has_permission('settings.read'));
CREATE POLICY "staff write app settings" ON app_settings
  FOR ALL
  USING (auth_has_permission('settings.write'))
  WITH CHECK (auth_has_permission('settings.write'));

DROP POLICY IF EXISTS "staff read audit logs" ON audit_logs;
CREATE POLICY "staff read audit logs" ON audit_logs
  FOR SELECT
  USING (auth_has_permission('audit.read'));

DROP POLICY IF EXISTS "staff write students" ON students;
CREATE POLICY "staff write students" ON students
  FOR ALL
  USING (auth_has_permission('students.write'))
  WITH CHECK (auth_has_permission('students.write'));

DROP POLICY IF EXISTS "admin write teachers" ON teachers;
CREATE POLICY "admin write teachers" ON teachers
  FOR ALL
  USING (auth_has_permission('teachers.write'))
  WITH CHECK (auth_has_permission('teachers.write'));

DROP POLICY IF EXISTS "admin write subjects" ON subjects;
CREATE POLICY "admin write subjects" ON subjects
  FOR ALL
  USING (auth_has_permission('subjects.write'))
  WITH CHECK (auth_has_permission('subjects.write'));

DROP POLICY IF EXISTS "admin write classes" ON classes;
CREATE POLICY "admin write classes" ON classes
  FOR ALL
  USING (auth_has_permission('classes.write'))
  WITH CHECK (auth_has_permission('classes.write'));

DROP POLICY IF EXISTS "staff write events" ON events;
DROP POLICY IF EXISTS "students cannot manage events" ON events;
CREATE POLICY "staff write events" ON events
  FOR ALL
  USING (auth_has_permission('events.write'))
  WITH CHECK (auth_has_permission('events.write'));

DROP POLICY IF EXISTS "teacher write grades" ON grades;
CREATE POLICY "teacher write grades" ON grades
  FOR ALL
  USING (auth_has_permission('grades.write'))
  WITH CHECK (auth_has_permission('grades.write'));

DROP POLICY IF EXISTS "teacher write attendance" ON attendance;
CREATE POLICY "teacher write attendance" ON attendance
  FOR ALL
  USING (auth_has_permission('attendance.write'))
  WITH CHECK (auth_has_permission('attendance.write'));

DROP POLICY IF EXISTS "teacher write assignments" ON assignments;
CREATE POLICY "teacher write assignments" ON assignments
  FOR ALL
  USING (auth_has_permission('assignments.write'))
  WITH CHECK (auth_has_permission('assignments.write'));

DROP POLICY IF EXISTS "all authenticated read messages" ON messages;
DROP POLICY IF EXISTS "staff write messages" ON messages;
DROP POLICY IF EXISTS "messages_select_by_audience" ON messages;
DROP POLICY IF EXISTS "messages_insert_staff" ON messages;
DROP POLICY IF EXISTS "messages_update_staff" ON messages;
DROP POLICY IF EXISTS "messages_delete_staff" ON messages;
CREATE POLICY "messages_select_by_audience"
  ON messages
  FOR SELECT
  USING (
    auth_has_permission('messages.write')
    OR recipient_type = 'todos'
    OR (
      recipient_type = 'turma'
      AND class_id IN (
        SELECT current_class_id
        FROM students
        WHERE email = auth.jwt() ->> 'email'
      )
    )
    OR (
      recipient_type = 'aluno'
      AND EXISTS (
        SELECT 1
        FROM students s
        WHERE s.email = auth.jwt() ->> 'email'
          AND s.id = ANY(messages.recipient_ids)
      )
    )
  );
CREATE POLICY "messages_insert_staff"
  ON messages
  FOR INSERT
  WITH CHECK (auth_has_permission('messages.write'));
CREATE POLICY "messages_update_staff"
  ON messages
  FOR UPDATE
  USING (auth_has_permission('messages.write'))
  WITH CHECK (auth_has_permission('messages.write'));
CREATE POLICY "messages_delete_staff"
  ON messages
  FOR DELETE
  USING (auth_has_permission('messages.write'));

DROP POLICY IF EXISTS "admin write library items" ON library_items;
CREATE POLICY "admin write library items" ON library_items
  FOR ALL
  USING (auth_has_permission('library.write'))
  WITH CHECK (auth_has_permission('library.write'));

DROP POLICY IF EXISTS "admin read loans" ON library_loans;
DROP POLICY IF EXISTS "admin write loans" ON library_loans;
CREATE POLICY "admin read loans" ON library_loans
  FOR SELECT
  USING (auth_has_permission('library_loans.read'));
CREATE POLICY "admin write loans" ON library_loans
  FOR ALL
  USING (auth_has_permission('library_loans.write'))
  WITH CHECK (auth_has_permission('library_loans.write'));

DROP POLICY IF EXISTS "teacher read goals" ON goals;
CREATE POLICY "teacher read goals" ON goals
  FOR SELECT
  USING (auth_has_permission('goals.read.all'));

DROP POLICY IF EXISTS "teacher manage diary" ON class_diary;
CREATE POLICY "teacher manage diary" ON class_diary
  FOR ALL
  USING (auth_has_permission('diary.write'))
  WITH CHECK (auth_has_permission('diary.write'));

DROP POLICY IF EXISTS "teacher manage lesson_plans" ON lesson_plans;
CREATE POLICY "teacher manage lesson_plans" ON lesson_plans
  FOR ALL
  USING (auth_has_permission('lesson_plans.write'))
  WITH CHECK (auth_has_permission('lesson_plans.write'));

DROP POLICY IF EXISTS "staff manage occurrences" ON occurrences;
CREATE POLICY "staff manage occurrences" ON occurrences
  FOR ALL
  USING (auth_has_permission('occurrences.write'))
  WITH CHECK (auth_has_permission('occurrences.write'));

DROP POLICY IF EXISTS "teacher manage own calendar" ON teacher_calendar_events;
CREATE POLICY "teacher manage own calendar" ON teacher_calendar_events
  FOR ALL
  USING (
    teacher_id IN (SELECT id FROM teachers WHERE email = auth.jwt() ->> 'email')
    OR auth_has_permission('teacher_calendar.manage.all')
  )
  WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE email = auth.jwt() ->> 'email')
    OR auth_has_permission('teacher_calendar.manage.all')
  );

DROP POLICY IF EXISTS "teacher read submissions" ON submissions;
DROP POLICY IF EXISTS "teacher grade submissions" ON submissions;
CREATE POLICY "teacher read submissions" ON submissions
  FOR SELECT
  USING (auth_has_permission('submissions.read.all'));
CREATE POLICY "teacher grade submissions" ON submissions
  FOR UPDATE
  USING (auth_has_permission('submissions.grade'))
  WITH CHECK (auth_has_permission('submissions.grade'));

COMMIT;
-- <<< END migration_rbac_permissions.sql

-- >>> BEGIN migration_guardian_portal_mvp.sql
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
-- <<< END migration_guardian_portal_mvp.sql

-- >>> BEGIN migration_storage_secure_files.sql
BEGIN;

CREATE OR REPLACE FUNCTION storage_extract_known_path(raw_value TEXT, bucket_name TEXT DEFAULT 'project-wg-files')
RETURNS TEXT AS $$
DECLARE
  v_trimmed TEXT := NULLIF(BTRIM(raw_value), '');
  v_match TEXT[];
  v_bucket_pattern TEXT := regexp_replace(COALESCE(bucket_name, ''), '([.[\\]{}()*+?^$|\\\\-])', '\\\1', 'g');
BEGIN
  IF v_trimmed IS NULL THEN RETURN NULL; END IF;
  IF v_trimmed !~* '^https?://' THEN RETURN v_trimmed; END IF;
  v_match := regexp_match(v_trimmed, '/storage/v1/object/(?:sign|public|authenticated)/' || v_bucket_pattern || '/([^?]+)');
  IF v_match IS NULL THEN
    v_match := regexp_match(v_trimmed, '/storage/v1/object/' || v_bucket_pattern || '/([^?]+)');
  END IF;
  IF v_match IS NULL OR array_length(v_match, 1) = 0 THEN RETURN NULL; END IF;
  RETURN NULLIF(BTRIM(v_match[1]), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_jsonb_reference_path(reference_value JSONB, bucket_name TEXT DEFAULT 'project-wg-files')
RETURNS TEXT AS $$
DECLARE
  v_type TEXT := jsonb_typeof(reference_value);
BEGIN
  IF reference_value IS NULL THEN RETURN NULL; END IF;
  IF v_type = 'string' THEN RETURN storage_extract_known_path(reference_value #>> '{}', bucket_name); END IF;
  IF v_type <> 'object' THEN RETURN NULL; END IF;
  RETURN COALESCE(
    NULLIF(BTRIM(reference_value ->> 'file_path'), ''),
    NULLIF(BTRIM(reference_value ->> 'path'), ''),
    NULLIF(BTRIM(reference_value ->> 'filePath'), ''),
    storage_extract_known_path(reference_value ->> 'signedUrl', bucket_name),
    storage_extract_known_path(reference_value ->> 'publicUrl', bucket_name),
    storage_extract_known_path(reference_value ->> 'url', bucket_name)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_path_matches_prefixes(file_path TEXT, allowed_prefixes TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(allowed_prefixes, ARRAY[]::TEXT[])) AS prefix
    WHERE file_path LIKE prefix || '%'
  );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_file_array_is_valid(
  file_values JSONB,
  bucket_name TEXT DEFAULT 'project-wg-files',
  allowed_prefixes TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN file_values IS NULL THEN TRUE
    WHEN jsonb_typeof(file_values) <> 'array' THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(file_values) AS item(value)
      CROSS JOIN LATERAL (
        SELECT
          storage_jsonb_reference_path(item.value, bucket_name) AS file_path,
          NULLIF(BTRIM(item.value ->> 'bucket'), '') AS object_bucket
      ) AS ref
      WHERE ref.file_path IS NULL
        OR NOT storage_path_matches_prefixes(ref.file_path, allowed_prefixes)
        OR (ref.object_bucket IS NOT NULL AND ref.object_bucket <> bucket_name)
    )
  END;
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_attachments_private_storage_check;
ALTER TABLE students ADD CONSTRAINT students_attachments_private_storage_check
  CHECK (storage_file_array_is_valid(attachments, 'project-wg-files', ARRAY['attachments/'])) NOT VALID;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_file_urls_private_storage_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_file_urls_private_storage_check
  CHECK (storage_file_array_is_valid(file_urls, 'project-wg-files', ARRAY['submissions/'])) NOT VALID;

ALTER TABLE class_diary DROP CONSTRAINT IF EXISTS class_diary_attachment_urls_private_storage_check;
ALTER TABLE class_diary ADD CONSTRAINT class_diary_attachment_urls_private_storage_check
  CHECK (storage_file_array_is_valid(attachment_urls, 'project-wg-files', ARRAY['diary/'])) NOT VALID;

ALTER TABLE lesson_plans DROP CONSTRAINT IF EXISTS lesson_plans_attachment_urls_private_storage_check;
ALTER TABLE lesson_plans ADD CONSTRAINT lesson_plans_attachment_urls_private_storage_check
  CHECK (storage_file_array_is_valid(attachment_urls, 'project-wg-files', ARRAY['diary/'])) NOT VALID;

UPDATE storage.buckets
SET public = false
WHERE id = 'project-wg-files';

DROP POLICY IF EXISTS "staff_manage_school_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_read_school_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_manage_enrollment_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_manage_diary_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_read_submission_files" ON storage.objects;
DROP POLICY IF EXISTS "student_upload_own_submissions" ON storage.objects;
DROP POLICY IF EXISTS "student_read_own_submission_files" ON storage.objects;
DROP POLICY IF EXISTS "student_delete_own_submission_files" ON storage.objects;

CREATE POLICY "staff_read_school_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() IN ('administrador', 'coordenador', 'secretario', 'professor')
  );

CREATE POLICY "staff_manage_enrollment_files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND name LIKE 'attachments/%'
    AND auth_has_permission('enrollments.manage')
  )
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND name LIKE 'attachments/%'
    AND auth_has_permission('enrollments.manage')
  );

CREATE POLICY "staff_manage_diary_files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND name LIKE 'diary/%'
    AND auth_has_permission('diary.write')
  )
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND name LIKE 'diary/%'
    AND auth_has_permission('diary.write')
  );

CREATE POLICY "staff_read_submission_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND name LIKE 'submissions/%'
    AND auth_has_permission('submissions.read.all')
  );

CREATE POLICY "student_upload_own_submissions" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

CREATE POLICY "student_read_own_submission_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

CREATE POLICY "student_delete_own_submission_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

COMMIT;
-- <<< END migration_storage_secure_files.sql

-- >>> BEGIN migration_search_workspace_rpc.sql
BEGIN;

-- Leitura de ocorrências para perfis com occurrences.read (RLS antes só cobria escrita).
DROP POLICY IF EXISTS "staff read occurrences" ON occurrences;
CREATE POLICY "staff read occurrences" ON occurrences
  FOR SELECT USING (auth_has_permission('occurrences.read'));

-- Busca global no servidor: uma linha por resultado, filtrada por RLS das tabelas base.
CREATE OR REPLACE FUNCTION public.search_workspace(
  p_query text,
  p_limit_per_entity int DEFAULT 5,
  p_max_total int DEFAULT 24
)
RETURNS TABLE (
  entity_key text,
  record_id uuid,
  title text,
  subtitle text,
  meta text,
  app_id text,
  entity_label text,
  search_document text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      lower(trim(coalesce(p_query, ''))) AS q,
      least(greatest(coalesce(p_limit_per_entity, 5), 1), 20) AS lim,
      least(greatest(coalesce(p_max_total, 24), 1), 100) AS cap
  ),
  limv AS (SELECT lim FROM params),

  students_b AS (
    SELECT
      'students'::text AS entity_key,
      s.id AS record_id,
      coalesce(s.full_name, 'Aluno sem nome')::text AS title,
      concat_ws(' • ',
        CASE WHEN s.registration_number IS NOT NULL THEN 'Matrícula ' || s.registration_number END,
        s.email,
        s.current_grade
      )::text AS subtitle,
      coalesce(s.enrollment_status, 'aluno')::text AS meta,
      'students'::text AS app_id,
      'Alunos'::text AS entity_label,
      lower(
        coalesce(s.full_name, '') || ' ' ||
        coalesce(s.registration_number, '') || ' ' ||
        coalesce(s.email, '') || ' ' ||
        coalesce(s.guardian_name, '') || ' ' ||
        coalesce(s.current_grade, '') || ' ' ||
        coalesce(s.shift, '') || ' ' ||
        coalesce(s.enrollment_status, '')
      ) AS search_document
    FROM students s
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND (auth_has_permission('students.read') OR auth_has_permission('students.read.self'))
      AND position(p.q IN lower(
        coalesce(s.full_name, '') || ' ' ||
        coalesce(s.registration_number, '') || ' ' ||
        coalesce(s.email, '') || ' ' ||
        coalesce(s.guardian_name, '') || ' ' ||
        coalesce(s.current_grade, '') || ' ' ||
        coalesce(s.shift, '') || ' ' ||
        coalesce(s.enrollment_status, '')
      )) > 0
    ORDER BY s.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  teachers_b AS (
    SELECT
      'teachers'::text,
      t.id,
      coalesce(t.full_name, 'Professor sem nome')::text,
      concat_ws(' • ', t.email, CASE WHEN t.employee_id IS NOT NULL THEN 'Matrícula ' || t.employee_id END)::text,
      coalesce(t.status, 'professor')::text,
      'teachers'::text,
      'Professores'::text,
      lower(
        coalesce(t.full_name, '') || ' ' ||
        coalesce(t.email, '') || ' ' ||
        coalesce(t.employee_id, '') || ' ' ||
        coalesce(t.degree_area, '') || ' ' ||
        coalesce(t.education_level, '') || ' ' ||
        coalesce(t.status, '')
      )
    FROM teachers t
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('teachers.read')
      AND position(p.q IN lower(
        coalesce(t.full_name, '') || ' ' ||
        coalesce(t.email, '') || ' ' ||
        coalesce(t.employee_id, '') || ' ' ||
        coalesce(t.degree_area, '') || ' ' ||
        coalesce(t.education_level, '') || ' ' ||
        coalesce(t.status, '')
      )) > 0
    ORDER BY t.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  classes_b AS (
    SELECT
      'classes'::text,
      c.id,
      coalesce(c.name, 'Turma sem nome')::text,
      concat_ws(' • ', c.grade_level, c.year::text, c.classroom)::text,
      coalesce(c.status, c.shift, 'turma')::text,
      'classes'::text,
      'Turmas'::text,
      lower(
        coalesce(c.name, '') || ' ' ||
        coalesce(c.grade_level, '') || ' ' ||
        coalesce(c.classroom, '') || ' ' ||
        coalesce(c.shift, '') || ' ' ||
        coalesce(c.status, '') || ' ' ||
        coalesce(c.year::text, '')
      )
    FROM classes c
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('classes.read')
      AND position(p.q IN lower(
        coalesce(c.name, '') || ' ' ||
        coalesce(c.grade_level, '') || ' ' ||
        coalesce(c.classroom, '') || ' ' ||
        coalesce(c.shift, '') || ' ' ||
        coalesce(c.status, '') || ' ' ||
        coalesce(c.year::text, '')
      )) > 0
    ORDER BY c.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  subjects_b AS (
    SELECT
      'subjects'::text,
      s.id,
      coalesce(s.name, 'Disciplina sem nome')::text,
      concat_ws(' • ', s.code, s.grade_level)::text,
      coalesce(s.area, CASE WHEN s.is_active IS FALSE THEN 'inativa' ELSE 'ativa' END)::text,
      'subjects'::text,
      'Disciplinas'::text,
      lower(
        coalesce(s.name, '') || ' ' ||
        coalesce(s.code, '') || ' ' ||
        coalesce(s.area, '') || ' ' ||
        coalesce(s.grade_level, '') || ' ' ||
        coalesce(s.syllabus, '')
      )
    FROM subjects s
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('subjects.read')
      AND position(p.q IN lower(
        coalesce(s.name, '') || ' ' ||
        coalesce(s.code, '') || ' ' ||
        coalesce(s.area, '') || ' ' ||
        coalesce(s.grade_level, '') || ' ' ||
        coalesce(s.syllabus, '')
      )) > 0
    ORDER BY s.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  assignments_b AS (
    SELECT
      'assignments'::text,
      a.id,
      coalesce(a.title, 'Atividade sem título')::text,
      left(regexp_replace(coalesce(a.description, a.instructions, ''), E'\\s+', ' ', 'g'), 96)::text,
      coalesce(a.status, a.type, 'atividade')::text,
      'assignments'::text,
      'Atividades'::text,
      lower(
        coalesce(a.title, '') || ' ' ||
        coalesce(a.description, '') || ' ' ||
        coalesce(a.instructions, '') || ' ' ||
        coalesce(a.type, '') || ' ' ||
        coalesce(a.status, '')
      )
    FROM assignments a
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('assignments.read')
      AND position(p.q IN lower(
        coalesce(a.title, '') || ' ' ||
        coalesce(a.description, '') || ' ' ||
        coalesce(a.instructions, '') || ' ' ||
        coalesce(a.type, '') || ' ' ||
        coalesce(a.status, '')
      )) > 0
    ORDER BY a.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  messages_b AS (
    SELECT
      'messages'::text,
      m.id,
      coalesce(m.subject, 'Comunicado sem assunto')::text,
      left(regexp_replace(coalesce(m.content, ''), E'\\s+', ' ', 'g'), 96)::text,
      coalesce(m.category, m.priority, 'comunicado')::text,
      'messages'::text,
      'Comunicados'::text,
      lower(
        coalesce(m.subject, '') || ' ' ||
        coalesce(m.content, '') || ' ' ||
        coalesce(m.category, '') || ' ' ||
        coalesce(m.priority, '') || ' ' ||
        coalesce(m.status, '')
      )
    FROM messages m
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('messages.read')
      AND position(p.q IN lower(
        coalesce(m.subject, '') || ' ' ||
        coalesce(m.content, '') || ' ' ||
        coalesce(m.category, '') || ' ' ||
        coalesce(m.priority, '') || ' ' ||
        coalesce(m.status, '')
      )) > 0
    ORDER BY m.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  occurrences_b AS (
    SELECT
      'occurrences'::text,
      o.id,
      coalesce(o.title, 'Ocorrência sem título')::text,
      concat_ws(' • ', o.type, o.date::text, o.reporter_name)::text,
      coalesce(o.severity, o.status, 'ocorrência')::text,
      'occurrences'::text,
      'Ocorrências'::text,
      lower(
        coalesce(o.title, '') || ' ' ||
        coalesce(o.description, '') || ' ' ||
        coalesce(o.type, '') || ' ' ||
        coalesce(o.severity, '') || ' ' ||
        coalesce(o.status, '') || ' ' ||
        coalesce(o.date::text, '') || ' ' ||
        coalesce(o.reporter_name, '')
      )
    FROM occurrences o
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('occurrences.read')
      AND position(p.q IN lower(
        coalesce(o.title, '') || ' ' ||
        coalesce(o.description, '') || ' ' ||
        coalesce(o.type, '') || ' ' ||
        coalesce(o.severity, '') || ' ' ||
        coalesce(o.status, '') || ' ' ||
        coalesce(o.date::text, '') || ' ' ||
        coalesce(o.reporter_name, '')
      )) > 0
    ORDER BY o.date DESC, o.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  library_b AS (
    SELECT
      'library'::text,
      li.id,
      coalesce(li.title, 'Item sem título')::text,
      concat_ws(' • ', li.author, li.isbn)::text,
      coalesce(li.type::text, CASE WHEN li.available_copies > 0 THEN 'disponível' ELSE 'indisponível' END)::text,
      'library'::text,
      'Biblioteca'::text,
      lower(
        coalesce(li.title, '') || ' ' ||
        coalesce(li.author, '') || ' ' ||
        coalesce(li.isbn, '') || ' ' ||
        coalesce(li.publisher, '') || ' ' ||
        coalesce(li.description, '') || ' ' ||
        coalesce(li.location, '') || ' ' ||
        coalesce(li.type::text, '')
      )
    FROM library_items li
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('library.read')
      AND position(p.q IN lower(
        coalesce(li.title, '') || ' ' ||
        coalesce(li.author, '') || ' ' ||
        coalesce(li.isbn, '') || ' ' ||
        coalesce(li.publisher, '') || ' ' ||
        coalesce(li.description, '') || ' ' ||
        coalesce(li.location, '') || ' ' ||
        coalesce(li.type::text, '')
      )) > 0
    ORDER BY li.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  events_b AS (
    SELECT
      'events'::text,
      e.id,
      coalesce(e.title, 'Evento sem título')::text,
      concat_ws(' • ', e.location, e.start_date::text)::text,
      coalesce(e.type, e.status, 'evento')::text,
      'schoolcalendar'::text,
      'Calendário'::text,
      lower(
        coalesce(e.title, '') || ' ' ||
        coalesce(e.description, '') || ' ' ||
        coalesce(e.location, '') || ' ' ||
        coalesce(e.type, '') || ' ' ||
        coalesce(e.status, '') || ' ' ||
        coalesce(e.start_date::text, '')
      )
    FROM events e
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('calendar.read')
      AND position(p.q IN lower(
        coalesce(e.title, '') || ' ' ||
        coalesce(e.description, '') || ' ' ||
        coalesce(e.location, '') || ' ' ||
        coalesce(e.type, '') || ' ' ||
        coalesce(e.status, '') || ' ' ||
        coalesce(e.start_date::text, '')
      )) > 0
    ORDER BY e.start_date DESC
    LIMIT (SELECT lim FROM limv)
  ),

  users_b AS (
    SELECT
      'users'::text,
      up.id,
      coalesce(up.full_name, 'Usuário sem nome')::text,
      concat_ws(' • ', up.user_email, up.department)::text,
      coalesce(up.profile_type, up.status, 'usuário')::text,
      'users'::text,
      'Usuários'::text,
      lower(
        coalesce(up.full_name, '') || ' ' ||
        coalesce(up.user_email, '') || ' ' ||
        coalesce(up.department, '') || ' ' ||
        coalesce(up.profile_type, '') || ' ' ||
        coalesce(up.status, '')
      )
    FROM user_profiles up
    CROSS JOIN params p
    WHERE length(p.q) >= 2
      AND auth_has_permission('users.manage')
      AND position(p.q IN lower(
        coalesce(up.full_name, '') || ' ' ||
        coalesce(up.user_email, '') || ' ' ||
        coalesce(up.department, '') || ' ' ||
        coalesce(up.profile_type, '') || ' ' ||
        coalesce(up.status, '')
      )) > 0
    ORDER BY up.created_at DESC
    LIMIT (SELECT lim FROM limv)
  ),

  unioned (
    entity_key,
    record_id,
    title,
    subtitle,
    meta,
    app_id,
    entity_label,
    search_document
  ) AS (
    SELECT * FROM students_b
    UNION ALL SELECT * FROM teachers_b
    UNION ALL SELECT * FROM classes_b
    UNION ALL SELECT * FROM subjects_b
    UNION ALL SELECT * FROM assignments_b
    UNION ALL SELECT * FROM messages_b
    UNION ALL SELECT * FROM occurrences_b
    UNION ALL SELECT * FROM library_b
    UNION ALL SELECT * FROM events_b
    UNION ALL SELECT * FROM users_b
  )
  SELECT
    u.entity_key,
    u.record_id,
    u.title,
    u.subtitle,
    u.meta,
    u.app_id,
    u.entity_label,
    u.search_document
  FROM unioned u
  LIMIT (SELECT cap FROM params);
$$;

GRANT EXECUTE ON FUNCTION public.search_workspace(text, integer, integer) TO authenticated;

COMMIT;
-- <<< END migration_search_workspace_rpc.sql

-- >>> BEGIN migration_messages_student_policy.sql
BEGIN;

DROP POLICY IF EXISTS "student write class messages" ON messages;
DROP POLICY IF EXISTS "messages_insert_student_class" ON messages;

CREATE POLICY "messages_insert_student_class"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth_profile_type() = 'aluno'
    AND recipient_type = 'turma'
    AND class_id IN (
      SELECT current_class_id
      FROM students
      WHERE email = auth.jwt() ->> 'email'
    )
  );

COMMIT;
-- <<< END migration_messages_student_policy.sql

-- >>> BEGIN migration_enrollment_transaction.sql
-- ============================================================
-- Milestone 1 — Matrícula transacional server-side
-- ============================================================

CREATE OR REPLACE FUNCTION admin_create_enrollment_transaction(
  p_student JSONB,
  p_access JSONB DEFAULT '{}'::jsonb,
  p_requester JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_student_payload JSONB := COALESCE(p_student, '{}'::jsonb);
  v_access_payload JSONB := COALESCE(p_access, '{}'::jsonb);
  v_requester_payload JSONB := COALESCE(p_requester, '{}'::jsonb);
  v_create_access BOOLEAN := COALESCE(NULLIF(v_access_payload ->> 'create_access', '')::BOOLEAN, FALSE);
  v_student_email TEXT := NULLIF(LOWER(TRIM(COALESCE(v_student_payload ->> 'email', ''))), '');
  v_access_email TEXT := NULLIF(LOWER(TRIM(COALESCE(v_access_payload ->> 'email', ''))), '');
  v_effective_email TEXT := COALESCE(v_access_email, v_student_email);
  v_enrollment_status TEXT := CASE
    WHEN COALESCE(v_student_payload ->> 'enrollment_status', '') = 'ativo' THEN 'ativo'
    ELSE 'pendente'
  END;
  v_approved_at TIMESTAMPTZ := CASE WHEN v_enrollment_status = 'ativo' THEN NOW() ELSE NULL END;
  v_approved_by TEXT := CASE
    WHEN v_enrollment_status = 'ativo'
      THEN NULLIF(TRIM(COALESCE(v_requester_payload ->> 'requested_by_email', '')), '')
    ELSE NULL
  END;
  v_student_record students%ROWTYPE;
  v_profile_record user_profiles%ROWTYPE;
BEGIN
  IF NULLIF(TRIM(COALESCE(v_student_payload ->> 'full_name', '')), '') IS NULL
    OR NULLIF(TRIM(COALESCE(v_student_payload ->> 'cpf', '')), '') IS NULL
    OR NULLIF(TRIM(COALESCE(v_student_payload ->> 'birth_date', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatorios da matricula estao incompletos.';
  END IF;

  IF v_create_access AND v_effective_email IS NULL THEN
    RAISE EXCEPTION 'Informe um e-mail valido para criar acesso ao aluno.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM students
    WHERE cpf = NULLIF(TRIM(COALESCE(v_student_payload ->> 'cpf', '')), '')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ja existe um aluno cadastrado com este CPF.';
  END IF;

  IF NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM students
      WHERE registration_number = NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), '')
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'A matricula informada ja esta em uso.';
  END IF;

  IF v_create_access
    AND EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_email = v_effective_email
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Ja existe um perfil vinculado a este e-mail.';
  END IF;

  INSERT INTO students (
    registration_number,
    full_name,
    birth_date,
    cpf,
    gender,
    nationality,
    place_of_birth,
    marital_status,
    photo_url,
    email,
    phone,
    mobile_phone,
    address,
    course,
    entry_period,
    entry_method,
    guardian_name,
    guardian_cpf,
    guardian_relationship,
    guardian_phone,
    guardian_mobile,
    attachments,
    notes,
    enrollment_status,
    enrollment_date,
    current_class_id,
    current_grade,
    shift,
    uses_transport,
    transport_route,
    scholarship_percentage,
    blood_type,
    allergies,
    medical_conditions,
    medications,
    special_needs,
    emergency_contact,
    emergency_phone
  )
  VALUES (
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'registration_number', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'full_name', '')), ''),
    (v_student_payload ->> 'birth_date')::DATE,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'cpf', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'gender', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'nationality', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'place_of_birth', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'marital_status', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'photo_url', '')), ''),
    v_effective_email,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'phone', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'mobile_phone', '')), ''),
    CASE
      WHEN jsonb_typeof(v_student_payload -> 'address') = 'object' THEN v_student_payload -> 'address'
      ELSE NULL
    END,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'course', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'entry_period', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'entry_method', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_name', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_cpf', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_relationship', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_phone', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'guardian_mobile', '')), ''),
    COALESCE(v_student_payload -> 'attachments', '[]'::jsonb),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'notes', '')), ''),
    v_enrollment_status,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'enrollment_date', '')), '')::DATE,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'current_class_id', '')), '')::UUID,
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'current_grade', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'shift', '')), ''),
    COALESCE(NULLIF(v_student_payload ->> 'uses_transport', '')::BOOLEAN, FALSE),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'transport_route', '')), ''),
    COALESCE(NULLIF(TRIM(COALESCE(v_student_payload ->> 'scholarship_percentage', '')), '')::NUMERIC(5,2), 0),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'blood_type', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'allergies', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'medical_conditions', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'medications', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'special_needs', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'emergency_contact', '')), ''),
    NULLIF(TRIM(COALESCE(v_student_payload ->> 'emergency_phone', '')), '')
  )
  RETURNING * INTO v_student_record;

  IF v_create_access THEN
    INSERT INTO user_profiles (
      user_email,
      full_name,
      profile_type,
      status,
      phone,
      birth_date,
      registration_number,
      approved_by,
      approved_at
    )
    VALUES (
      v_effective_email,
      v_student_record.full_name,
      'aluno',
      v_enrollment_status,
      v_student_record.phone,
      v_student_record.birth_date,
      v_student_record.registration_number,
      v_approved_by,
      v_approved_at
    )
    RETURNING * INTO v_profile_record;
  END IF;

  RETURN jsonb_build_object(
    'student', to_jsonb(v_student_record),
    'profile', CASE WHEN v_create_access THEN to_jsonb(v_profile_record) ELSE NULL END,
    'accessCreated', v_create_access
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_cleanup_enrollment_transaction(
  p_student_id UUID,
  p_profile_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_deleted_student_count INTEGER := 0;
  v_deleted_profile_count INTEGER := 0;
BEGIN
  IF p_profile_id IS NOT NULL THEN
    DELETE FROM user_profiles
    WHERE id = p_profile_id;

    GET DIAGNOSTICS v_deleted_profile_count = ROW_COUNT;
  END IF;

  DELETE FROM students
  WHERE id = p_student_id;

  GET DIAGNOSTICS v_deleted_student_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'studentDeleted', v_deleted_student_count > 0,
    'profileDeleted', v_deleted_profile_count > 0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_create_enrollment_transaction(JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_enrollment_transaction(JSONB, JSONB, JSONB) TO service_role;

REVOKE ALL ON FUNCTION admin_cleanup_enrollment_transaction(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_cleanup_enrollment_transaction(UUID, UUID) TO service_role;
-- <<< END migration_enrollment_transaction.sql

-- >>> BEGIN migration_permissions_hardening.sql
-- ============================================================
-- Permission hardening: messages + direct_messages
-- ============================================================

-- -----------------------------
-- direct_messages (chat)
-- -----------------------------
DROP POLICY IF EXISTS "users manage own messages" ON direct_messages;
DROP POLICY IF EXISTS "dm_select_own" ON direct_messages;
DROP POLICY IF EXISTS "dm_insert_sender_only" ON direct_messages;
DROP POLICY IF EXISTS "dm_update_recipient_read" ON direct_messages;
DROP POLICY IF EXISTS "dm_delete_sender_only" ON direct_messages;

CREATE POLICY "dm_select_own"
  ON direct_messages
  FOR SELECT
  USING (
    sender_email = auth.jwt() ->> 'email'
    OR recipient_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "dm_insert_sender_only"
  ON direct_messages
  FOR INSERT
  WITH CHECK (
    sender_email = auth.jwt() ->> 'email'
    AND recipient_email IS NOT NULL
    AND content IS NOT NULL
  );

CREATE POLICY "dm_update_recipient_read"
  ON direct_messages
  FOR UPDATE
  USING (recipient_email = auth.jwt() ->> 'email')
  WITH CHECK (recipient_email = auth.jwt() ->> 'email');

CREATE POLICY "dm_delete_sender_only"
  ON direct_messages
  FOR DELETE
  USING (sender_email = auth.jwt() ->> 'email');

CREATE OR REPLACE FUNCTION enforce_direct_message_read_only_update()
RETURNS TRIGGER AS $$
BEGIN
  -- recipient can only toggle read flag
  IF NEW.recipient_email = auth.jwt() ->> 'email' THEN
    IF NEW.sender_email IS DISTINCT FROM OLD.sender_email
      OR NEW.sender_name IS DISTINCT FROM OLD.sender_name
      OR NEW.recipient_email IS DISTINCT FROM OLD.recipient_email
      OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
      OR NEW.content IS DISTINCT FROM OLD.content
      OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only read flag can be updated by recipient';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized to update this message';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS trg_dm_read_only_update ON direct_messages;
CREATE TRIGGER trg_dm_read_only_update
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION enforce_direct_message_read_only_update();

-- -----------------------------
-- messages (comunicados)
-- -----------------------------
DROP POLICY IF EXISTS "all authenticated read messages" ON messages;
DROP POLICY IF EXISTS "staff write messages" ON messages;
DROP POLICY IF EXISTS "student write class messages" ON messages;
DROP POLICY IF EXISTS "messages_select_by_audience" ON messages;
DROP POLICY IF EXISTS "messages_insert_staff" ON messages;
DROP POLICY IF EXISTS "messages_insert_student_class" ON messages;
DROP POLICY IF EXISTS "messages_update_staff" ON messages;
DROP POLICY IF EXISTS "messages_delete_staff" ON messages;

CREATE POLICY "messages_select_by_audience"
  ON messages
  FOR SELECT
  USING (
    auth_profile_type() IN ('administrador','coordenador','secretario','professor')
    OR recipient_type = 'todos'
    OR (
      recipient_type = 'turma'
      AND class_id IN (
        SELECT current_class_id
        FROM students
        WHERE email = auth.jwt() ->> 'email'
      )
    )
    OR (
      recipient_type = 'aluno'
      AND EXISTS (
        SELECT 1
        FROM students s
        WHERE s.email = auth.jwt() ->> 'email'
          AND s.id = ANY(messages.recipient_ids)
      )
    )
  );

CREATE POLICY "messages_insert_staff"
  ON messages
  FOR INSERT
  WITH CHECK (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));

CREATE POLICY "messages_insert_student_class"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth_profile_type() = 'aluno'
    AND recipient_type = 'turma'
    AND class_id IN (
      SELECT current_class_id
      FROM students
      WHERE email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "messages_update_staff"
  ON messages
  FOR UPDATE
  USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'))
  WITH CHECK (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));

CREATE POLICY "messages_delete_staff"
  ON messages
  FOR DELETE
  USING (auth_profile_type() IN ('administrador','coordenador','secretario','professor'));
-- <<< END migration_permissions_hardening.sql

-- >>> BEGIN migration_app_settings.sql
BEGIN;

CREATE TABLE IF NOT EXISTS app_settings (
  id                          TEXT PRIMARY KEY DEFAULT 'system' CHECK (id = 'system'),
  school_name                 TEXT NOT NULL DEFAULT 'Project WG Escola',
  school_email                TEXT,
  school_phone                TEXT,
  school_address              TEXT,
  notify_new_enrollment       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_payment_due          BOOLEAN NOT NULL DEFAULT TRUE,
  notify_grade_posted         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_attendance_issue     BOOLEAN NOT NULL DEFAULT TRUE,
  allow_student_photo_upload  BOOLEAN NOT NULL DEFAULT TRUE,
  require_guardian_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  enable_tooltips             BOOLEAN NOT NULL DEFAULT TRUE,
  primary_color               TEXT NOT NULL DEFAULT '#6366f1',
  language                    TEXT NOT NULL DEFAULT 'pt-BR',
  timezone                    TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read app settings" ON app_settings;
DROP POLICY IF EXISTS "staff write app settings" ON app_settings;

CREATE POLICY "staff read app settings" ON app_settings
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario'));

CREATE POLICY "staff write app settings" ON app_settings
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','secretario'));

COMMIT;
-- <<< END migration_app_settings.sql

-- >>> BEGIN migration_tooltip_preferences.sql
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS enable_tooltips BOOLEAN NOT NULL DEFAULT TRUE;

  UPDATE app_settings
  SET enable_tooltips = TRUE
  WHERE enable_tooltips IS NULL;
END $$;

COMMIT;
-- <<< END migration_tooltip_preferences.sql

-- >>> BEGIN migration_notifications_base.sql
BEGIN;

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS notify_document_pending BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_message_posted BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_access_reset BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID DEFAULT current_tenant_id(),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_profile_type TEXT
    CHECK (recipient_profile_type IN ('aluno', 'professor', 'coordenador', 'secretario', 'administrador', 'responsavel')),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('enrollment_created', 'document_pending', 'message_posted', 'access_reset')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}'
    CHECK (channels <@ ARRAY['app', 'email']::TEXT[]),
  app_status TEXT NOT NULL DEFAULT 'entregue'
    CHECK (app_status IN ('entregue', 'lida', 'dispensada')),
  email_status TEXT NOT NULL DEFAULT 'dispensado'
    CHECK (email_status IN ('pendente', 'enviado', 'falhou', 'dispensado')),
  email_error TEXT,
  action_app TEXT,
  action_label TEXT,
  action_record_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email_created_at
  ON notifications(recipient_email, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications" ON notifications;
DROP POLICY IF EXISTS "users update own notifications" ON notifications;
CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );
CREATE POLICY "users update own notifications" ON notifications
  FOR UPDATE
  USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  )
  WITH CHECK (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "messages_insert_staff" ON messages;
DROP POLICY IF EXISTS "student write class messages" ON messages;

COMMIT;
-- <<< END migration_notifications_base.sql

-- >>> BEGIN migration_audit_logs.sql
BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_table        TEXT NOT NULL,
  record_id           TEXT,
  action              TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  actor_user_id       UUID,
  actor_email         TEXT,
  actor_name          TEXT,
  actor_profile_type  TEXT,
  changed_fields      TEXT[] NOT NULL DEFAULT '{}',
  previous_record     JSONB,
  new_record          JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_table ON audit_logs(entity_table);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION audit_request_header(header_name TEXT)
RETURNS TEXT AS $$
  SELECT NULLIF(
    COALESCE((current_setting('request.headers', true)::jsonb ->> lower(header_name)), ''),
    ''
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION audit_changed_fields(previous_row JSONB, next_row JSONB)
RETURNS TEXT[] AS $$
DECLARE
  keys TEXT[];
  current_key TEXT;
  changed TEXT[] := '{}';
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT key_value
    FROM (
      SELECT jsonb_object_keys(COALESCE(previous_row, '{}'::jsonb)) AS key_value
      UNION
      SELECT jsonb_object_keys(COALESCE(next_row, '{}'::jsonb)) AS key_value
    ) keys_union
    ORDER BY key_value
  ) INTO keys;

  IF keys IS NULL THEN
    RETURN changed;
  END IF;

  FOREACH current_key IN ARRAY keys LOOP
    IF current_key = 'updated_at' THEN
      CONTINUE;
    END IF;

    IF COALESCE(previous_row -> current_key, 'null'::jsonb) IS DISTINCT FROM COALESCE(next_row -> current_key, 'null'::jsonb) THEN
      changed := array_append(changed, current_key);
    END IF;
  END LOOP;

  RETURN changed;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
DECLARE
  previous_row JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  next_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  actor_email TEXT := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), audit_request_header('x-audit-actor-email'));
  actor_name TEXT := COALESCE(
    audit_request_header('x-audit-actor-name'),
    (SELECT full_name FROM user_profiles WHERE user_email = actor_email LIMIT 1),
    actor_email
  );
  actor_profile_type TEXT := COALESCE(
    audit_request_header('x-audit-actor-profile-type'),
    (SELECT profile_type FROM user_profiles WHERE user_email = actor_email LIMIT 1)
  );
  actor_user_id_text TEXT := COALESCE(NULLIF(auth.uid()::TEXT, ''), audit_request_header('x-audit-actor-id'));
  actor_user_id UUID := CASE
    WHEN actor_user_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN actor_user_id_text::UUID
    ELSE NULL
  END;
  resolved_record_id TEXT := COALESCE(next_row ->> 'id', previous_row ->> 'id');
  resolved_action TEXT := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
    ELSE lower(TG_OP)
  END;
BEGIN
  INSERT INTO audit_logs (
    entity_table,
    record_id,
    action,
    actor_user_id,
    actor_email,
    actor_name,
    actor_profile_type,
    changed_fields,
    previous_record,
    new_record,
    metadata
  )
  VALUES (
    TG_TABLE_NAME,
    resolved_record_id,
    resolved_action,
    actor_user_id,
    actor_email,
    actor_name,
    actor_profile_type,
    audit_changed_fields(previous_row, next_row),
    previous_row,
    next_row,
    jsonb_build_object('schema', TG_TABLE_SCHEMA)
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read audit logs" ON audit_logs;
CREATE POLICY "staff read audit logs" ON audit_logs
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario'));

DO $$
DECLARE
  audited_table TEXT;
BEGIN
  FOREACH audited_table IN ARRAY ARRAY[
    'user_profiles',
    'students',
    'teachers',
    'subjects',
    'classes',
    'attendance',
    'grades',
    'assignments',
    'submissions',
    'messages',
    'events',
    'schedules',
    'class_diary',
    'lesson_plans',
    'library_items',
    'library_loans',
    'goals',
    'goal_tasks',
    'occurrences',
    'app_settings',
    'teacher_calendar_events',
    'homework',
    'homework_completions',
    'direct_messages'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_audit_' || audited_table, audited_table);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION create_audit_log_entry()',
      'trg_audit_' || audited_table,
      audited_table
    );
  END LOOP;
END;
$$;

COMMIT;
-- <<< END migration_audit_logs.sql

-- >>> BEGIN migration_audit_logs_action_fix.sql
-- Corrige o trigger de auditoria para mapear INSERT -> create.
-- Antes, lower(TG_OP) gravava "insert", mas a constraint aceita apenas
-- "create", "update" e "delete".

UPDATE audit_logs
SET action = 'create'
WHERE action = 'insert';

CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
DECLARE
  previous_row JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  next_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  actor_email TEXT := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), audit_request_header('x-audit-actor-email'));
  actor_name TEXT := COALESCE(
    audit_request_header('x-audit-actor-name'),
    (SELECT full_name FROM user_profiles WHERE user_email = actor_email LIMIT 1),
    actor_email
  );
  actor_profile_type TEXT := COALESCE(
    audit_request_header('x-audit-actor-profile-type'),
    (SELECT profile_type FROM user_profiles WHERE user_email = actor_email LIMIT 1)
  );
  actor_user_id_text TEXT := COALESCE(NULLIF(auth.uid()::TEXT, ''), audit_request_header('x-audit-actor-id'));
  actor_user_id UUID := CASE
    WHEN actor_user_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN actor_user_id_text::UUID
    ELSE NULL
  END;
  resolved_record_id TEXT := COALESCE(next_row ->> 'id', previous_row ->> 'id');
  resolved_action TEXT := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
    ELSE lower(TG_OP)
  END;
  has_tenant_column BOOLEAN := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'tenant_id'
  );
  resolved_tenant_id_text TEXT := COALESCE(next_row ->> 'tenant_id', previous_row ->> 'tenant_id');
  resolved_tenant_id UUID := CASE
    WHEN resolved_tenant_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN resolved_tenant_id_text::UUID
    ELSE NULL
  END;
BEGIN
  IF has_tenant_column AND resolved_tenant_id IS NULL AND to_regprocedure('current_tenant_id()') IS NOT NULL THEN
    EXECUTE 'SELECT current_tenant_id()' INTO resolved_tenant_id;
  END IF;

  IF has_tenant_column THEN
    INSERT INTO audit_logs (
      tenant_id,
      entity_table,
      record_id,
      action,
      actor_user_id,
      actor_email,
      actor_name,
      actor_profile_type,
      changed_fields,
      previous_record,
      new_record,
      metadata
    )
    VALUES (
      resolved_tenant_id,
      TG_TABLE_NAME,
      resolved_record_id,
      resolved_action,
      actor_user_id,
      actor_email,
      actor_name,
      actor_profile_type,
      audit_changed_fields(previous_row, next_row),
      previous_row,
      next_row,
      jsonb_build_object('schema', TG_TABLE_SCHEMA)
    );
  ELSE
    INSERT INTO audit_logs (
      entity_table,
      record_id,
      action,
      actor_user_id,
      actor_email,
      actor_name,
      actor_profile_type,
      changed_fields,
      previous_record,
      new_record,
      metadata
    )
    VALUES (
      TG_TABLE_NAME,
      resolved_record_id,
      resolved_action,
      actor_user_id,
      actor_email,
      actor_name,
      actor_profile_type,
      audit_changed_fields(previous_row, next_row),
      previous_row,
      next_row,
      jsonb_build_object('schema', TG_TABLE_SCHEMA)
    );
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- <<< END migration_audit_logs_action_fix.sql

-- >>> BEGIN migration_fix_audit_logs_action_check.sql
BEGIN;

-- Repairs stale audit trigger functions that still write INSERT/UPDATE/DELETE
-- into audit_logs.action, while the table constraint only accepts
-- create/update/delete.
CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
DECLARE
  previous_row JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  next_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  actor_email TEXT := COALESCE(
    NULLIF(auth.jwt() ->> 'email', ''),
    audit_request_header('x-audit-actor-email')
  );
  actor_name TEXT := COALESCE(
    audit_request_header('x-audit-actor-name'),
    (SELECT full_name FROM user_profiles WHERE user_email = actor_email LIMIT 1),
    actor_email
  );
  actor_profile_type TEXT := COALESCE(
    audit_request_header('x-audit-actor-profile-type'),
    (SELECT profile_type FROM user_profiles WHERE user_email = actor_email LIMIT 1)
  );
  actor_user_id_text TEXT := COALESCE(
    NULLIF(auth.uid()::TEXT, ''),
    audit_request_header('x-audit-actor-id')
  );
  actor_user_id UUID := CASE
    WHEN actor_user_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN actor_user_id_text::UUID
    ELSE NULL
  END;
  resolved_record_id TEXT := COALESCE(next_row ->> 'id', previous_row ->> 'id');
  resolved_action TEXT := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
    ELSE lower(TG_OP)
  END;
  has_tenant_column BOOLEAN := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'tenant_id'
  );
  fallback_tenant_id UUID := NULL;
  resolved_tenant_id_text TEXT := COALESCE(
    next_row ->> 'tenant_id',
    previous_row ->> 'tenant_id'
  );
  resolved_tenant_id UUID := NULL;
BEGIN
  IF has_tenant_column THEN
    IF to_regprocedure('public.current_tenant_id()') IS NOT NULL THEN
      EXECUTE 'SELECT current_tenant_id()' INTO fallback_tenant_id;
    END IF;

    resolved_tenant_id := CASE
      WHEN resolved_tenant_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN resolved_tenant_id_text::UUID
      ELSE fallback_tenant_id
    END;

    EXECUTE
      'INSERT INTO audit_logs (
        tenant_id,
        entity_table,
        record_id,
        action,
        actor_user_id,
        actor_email,
        actor_name,
        actor_profile_type,
        changed_fields,
        previous_record,
        new_record,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)'
    USING
      resolved_tenant_id,
      TG_TABLE_NAME,
      resolved_record_id,
      resolved_action,
      actor_user_id,
      actor_email,
      actor_name,
      actor_profile_type,
      audit_changed_fields(previous_row, next_row),
      previous_row,
      next_row,
      jsonb_build_object('schema', TG_TABLE_SCHEMA);
  ELSE
    INSERT INTO audit_logs (
      entity_table,
      record_id,
      action,
      actor_user_id,
      actor_email,
      actor_name,
      actor_profile_type,
      changed_fields,
      previous_record,
      new_record,
      metadata
    ) VALUES (
      TG_TABLE_NAME,
      resolved_record_id,
      resolved_action,
      actor_user_id,
      actor_email,
      actor_name,
      actor_profile_type,
      audit_changed_fields(previous_row, next_row),
      previous_row,
      next_row,
      jsonb_build_object('schema', TG_TABLE_SCHEMA)
    );
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
-- <<< END migration_fix_audit_logs_action_check.sql

-- >>> BEGIN migration_grades_gradebook.sql
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
-- <<< END migration_grades_gradebook.sql

-- >>> BEGIN migration_enterprise_data_base.sql
BEGIN;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
DECLARE
  raw_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  claims_payload JSONB := '{}'::jsonb;
  tenant_candidate TEXT;
BEGIN
  IF raw_claims IS NOT NULL THEN
    claims_payload := raw_claims::jsonb;
  END IF;

  tenant_candidate := COALESCE(
    NULLIF(claims_payload ->> 'tenant_id', ''),
    NULLIF(claims_payload -> 'app_metadata' ->> 'tenant_id', ''),
    NULLIF(current_setting('app.current_tenant_id', true), '')
  );

  IF tenant_candidate IS NULL
     OR tenant_candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  RETURN tenant_candidate::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE notifications ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();

CREATE TABLE IF NOT EXISTS system_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  event_type          TEXT NOT NULL,
  aggregate_type      TEXT,
  aggregate_id        TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  available_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID DEFAULT current_tenant_id(),
  scope               TEXT NOT NULL,
  idempotency_key     TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  response_code       INTEGER,
  response_body       JSONB,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications" ON notifications;
CREATE POLICY "users read own notifications" ON notifications
  FOR SELECT USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "staff read system events" ON system_events;
CREATE POLICY "staff read system events" ON system_events
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "staff read idempotency keys" ON idempotency_keys;
CREATE POLICY "staff read idempotency keys" ON idempotency_keys
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

CREATE OR REPLACE FUNCTION create_audit_log_entry()
RETURNS TRIGGER AS $$
DECLARE
  previous_row JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  next_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  actor_email TEXT := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), audit_request_header('x-audit-actor-email'));
  actor_name TEXT := COALESCE(
    audit_request_header('x-audit-actor-name'),
    (SELECT full_name FROM user_profiles WHERE user_email = actor_email LIMIT 1),
    actor_email
  );
  actor_profile_type TEXT := COALESCE(
    audit_request_header('x-audit-actor-profile-type'),
    (SELECT profile_type FROM user_profiles WHERE user_email = actor_email LIMIT 1)
  );
  actor_user_id_text TEXT := COALESCE(NULLIF(auth.uid()::TEXT, ''), audit_request_header('x-audit-actor-id'));
  actor_user_id UUID := CASE
    WHEN actor_user_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN actor_user_id_text::UUID
    ELSE NULL
  END;
  resolved_record_id TEXT := COALESCE(next_row ->> 'id', previous_row ->> 'id');
  resolved_action TEXT := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
    ELSE lower(TG_OP)
  END;
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    entity_table,
    record_id,
    action,
    actor_user_id,
    actor_email,
    actor_name,
    actor_profile_type,
    changed_fields,
    previous_record,
    new_record,
    metadata
  )
  VALUES (
    COALESCE((next_row ->> 'tenant_id')::uuid, (previous_row ->> 'tenant_id')::uuid, current_tenant_id()),
    TG_TABLE_NAME,
    resolved_record_id,
    resolved_action,
    actor_user_id,
    actor_email,
    actor_name,
    actor_profile_type,
    audit_changed_fields(previous_row, next_row),
    previous_row,
    next_row,
    jsonb_build_object('schema', TG_TABLE_SCHEMA)
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Base enterprise queue tables (`system_events`) and idempotency registry.

COMMIT;
-- <<< END migration_enterprise_data_base.sql

-- >>> BEGIN migration_hardening_enterprise.sql
BEGIN;

ALTER TABLE public.observability_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE public.observability_logs ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_tenant_created_at
  ON public.notifications(recipient_email, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observability_logs_tenant_created_at
  ON public.observability_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_type_class_created_at
  ON public.messages(recipient_type, class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_ids_gin
  ON public.messages USING GIN (recipient_ids);

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_subject_not_blank_check,
  DROP CONSTRAINT IF EXISTS messages_content_not_blank_check,
  DROP CONSTRAINT IF EXISTS messages_channels_known_values_check,
  DROP CONSTRAINT IF EXISTS messages_recipient_class_required_check,
  DROP CONSTRAINT IF EXISTS messages_recipient_ids_required_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_subject_not_blank_check
    CHECK (NULLIF(BTRIM(subject), '') IS NOT NULL) NOT VALID,
  ADD CONSTRAINT messages_content_not_blank_check
    CHECK (NULLIF(BTRIM(content), '') IS NOT NULL) NOT VALID,
  ADD CONSTRAINT messages_channels_known_values_check
    CHECK (COALESCE(channels, '{}'::TEXT[]) <@ ARRAY['app','email']::TEXT[]) NOT VALID,
  ADD CONSTRAINT messages_recipient_class_required_check
    CHECK (recipient_type <> 'turma' OR class_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT messages_recipient_ids_required_check
    CHECK (recipient_type <> 'aluno' OR cardinality(COALESCE(recipient_ids, '{}'::UUID[])) > 0) NOT VALID;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observability_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users update own notifications" ON public.notifications;
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE
  USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  )
  WITH CHECK (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

DROP POLICY IF EXISTS "staff read observability logs" ON public.observability_logs;
CREATE POLICY "staff read observability logs" ON public.observability_logs
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND (tenant_id IS NULL OR tenant_id = current_tenant_id())
  );

COMMIT;
-- <<< END migration_hardening_enterprise.sql
