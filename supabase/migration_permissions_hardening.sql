-- Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
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
