-- P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
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
