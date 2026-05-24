-- ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
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
UPDATE storage.buckets
SET public = false
WHERE id = 'project-wg-files';

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
