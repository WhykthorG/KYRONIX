-- ð¡ð¢Ðì ð▒Ê»ÐéÐìÐìð│ð┤ÐìÐàÊ»Ê»ð¢ð©ð╣ð│ ð▒Ê»ÐàÐìð╗ð┤ ð¢Ðî Whyktor GSV Ê»ð╣ð╗ð┤ð▓ÐìÐÇð╗Ðìð┤Ðìð│.
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
