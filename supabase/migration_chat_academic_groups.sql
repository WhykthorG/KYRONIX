BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_academic_groups (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID DEFAULT current_tenant_id(),
  conversation_id        UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  class_id               UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id             UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id             UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  coordinator_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_chat_academic_groups_updated_at ON public.chat_academic_groups;
CREATE TRIGGER trg_chat_academic_groups_updated_at
  BEFORE UPDATE ON public.chat_academic_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_academic_groups_unique
  ON public.chat_academic_groups (tenant_id, class_id, subject_id) NULLS NOT DISTINCT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_academic_groups_conversation
  ON public.chat_academic_groups (conversation_id);

ALTER TABLE public.chat_academic_groups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.normalize_chat_participant_email(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(trim(COALESCE(p_value, ''))), '');
$$;

CREATE OR REPLACE FUNCTION public.sync_chat_academic_group(
  p_class_id UUID,
  p_subject_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_record RECORD;
  v_group_record RECORD;
  v_conversation_id UUID;
  v_created_by_email TEXT;
BEGIN
  IF p_class_id IS NULL OR p_subject_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    (array_remove(array_agg(s.teacher_id), NULL))[1] AS teacher_id,
    c.coordinator_id AS coordinator_teacher_id,
    c.name AS class_name,
    sub.name AS subject_name,
    COALESCE(
      current_tenant_id(),
      (array_remove(array_agg(up.tenant_id), NULL))[1],
      (array_remove(array_agg(existing_group.tenant_id), NULL))[1]
    ) AS tenant_id
  INTO v_schedule_record
  FROM public.schedules s
  JOIN public.classes c
    ON c.id = s.class_id
  JOIN public.subjects sub
    ON sub.id = s.subject_id
  LEFT JOIN public.chat_academic_groups existing_group
    ON existing_group.class_id = s.class_id
   AND existing_group.subject_id = s.subject_id
  LEFT JOIN public.user_profiles up
    ON public.normalize_chat_participant_email(up.user_email) IN (
      public.normalize_chat_participant_email((
        SELECT t.email
        FROM public.teachers t
        WHERE t.id = s.teacher_id
      )),
      public.normalize_chat_participant_email((
        SELECT t2.email
        FROM public.teachers t2
        WHERE t2.id = c.coordinator_id
      ))
    )
  WHERE s.class_id = p_class_id
    AND s.subject_id = p_subject_id
    AND COALESCE(s.is_active, TRUE)
  GROUP BY c.coordinator_id, c.name, sub.name;

  IF NOT FOUND THEN
    UPDATE public.chat_academic_groups
       SET is_active = FALSE,
           updated_at = NOW()
     WHERE class_id = p_class_id
       AND subject_id = p_subject_id;

    RETURN NULL;
  END IF;

  SELECT *
    INTO v_group_record
    FROM public.chat_academic_groups
   WHERE class_id = p_class_id
     AND subject_id = p_subject_id
     AND tenant_id IS NOT DISTINCT FROM v_schedule_record.tenant_id
   LIMIT 1;

  WITH expected_candidates AS (
    SELECT
      public.normalize_chat_participant_email(t.email) AS participant_email,
      'owner'::TEXT AS role,
      1 AS priority
    FROM public.teachers t
    WHERE t.id = v_schedule_record.teacher_id

    UNION ALL

    SELECT
      public.normalize_chat_participant_email(t.email) AS participant_email,
      'member'::TEXT AS role,
      2 AS priority
    FROM public.teachers t
    WHERE t.id = v_schedule_record.coordinator_teacher_id

    UNION ALL

    SELECT
      public.normalize_chat_participant_email(s.email) AS participant_email,
      'member'::TEXT AS role,
      3 AS priority
    FROM public.students s
    WHERE s.current_class_id = p_class_id
      AND s.enrollment_status = 'ativo'
  ),
  expected_profiles AS (
    SELECT DISTINCT ON (candidate.participant_email)
      candidate.participant_email,
      candidate.role
    FROM expected_candidates candidate
    JOIN public.user_profiles profile
      ON public.normalize_chat_participant_email(profile.user_email) = candidate.participant_email
    WHERE candidate.participant_email IS NOT NULL
      AND candidate.participant_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      AND profile.status = 'ativo'
      AND (
        (candidate.priority IN (1, 2) AND profile.profile_type IN ('professor', 'coordenador', 'administrador'))
        OR (candidate.priority = 3 AND profile.profile_type = 'aluno')
      )
    ORDER BY candidate.participant_email, candidate.priority
  )
  SELECT
    COALESCE(
      MAX(participant_email) FILTER (WHERE role = 'owner'),
      MIN(participant_email),
      'sistema-chat@local.invalid'
    )
  INTO v_created_by_email
  FROM expected_profiles;

  IF v_group_record.conversation_id IS NULL THEN
    INSERT INTO public.chat_conversations (
      tenant_id,
      type,
      title,
      created_by_email
    ) VALUES (
      v_schedule_record.tenant_id,
      'group',
      format('Turma %s - %s', v_schedule_record.class_name, v_schedule_record.subject_name),
      v_created_by_email
    )
    RETURNING id INTO v_conversation_id;

    INSERT INTO public.chat_academic_groups (
      tenant_id,
      conversation_id,
      class_id,
      subject_id,
      teacher_id,
      coordinator_teacher_id,
      is_active
    ) VALUES (
      v_schedule_record.tenant_id,
      v_conversation_id,
      p_class_id,
      p_subject_id,
      v_schedule_record.teacher_id,
      v_schedule_record.coordinator_teacher_id,
      TRUE
    )
    ON CONFLICT (tenant_id, class_id, subject_id)
    DO UPDATE SET
      conversation_id = EXCLUDED.conversation_id,
      teacher_id = EXCLUDED.teacher_id,
      coordinator_teacher_id = EXCLUDED.coordinator_teacher_id,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  ELSE
    v_conversation_id := v_group_record.conversation_id;

    UPDATE public.chat_conversations
       SET type = 'group',
           title = format('Turma %s - %s', v_schedule_record.class_name, v_schedule_record.subject_name),
           created_by_email = COALESCE(v_created_by_email, created_by_email),
           updated_at = NOW()
     WHERE id = v_conversation_id;

    UPDATE public.chat_academic_groups
       SET teacher_id = v_schedule_record.teacher_id,
           coordinator_teacher_id = v_schedule_record.coordinator_teacher_id,
           is_active = TRUE,
           updated_at = NOW()
     WHERE id = v_group_record.id;
  END IF;

  WITH expected_candidates AS (
    SELECT
      public.normalize_chat_participant_email(t.email) AS participant_email,
      'owner'::TEXT AS role,
      1 AS priority
    FROM public.teachers t
    WHERE t.id = v_schedule_record.teacher_id

    UNION ALL

    SELECT
      public.normalize_chat_participant_email(t.email) AS participant_email,
      'member'::TEXT AS role,
      2 AS priority
    FROM public.teachers t
    WHERE t.id = v_schedule_record.coordinator_teacher_id

    UNION ALL

    SELECT
      public.normalize_chat_participant_email(s.email) AS participant_email,
      'member'::TEXT AS role,
      3 AS priority
    FROM public.students s
    WHERE s.current_class_id = p_class_id
      AND s.enrollment_status = 'ativo'
  ),
  expected_profiles AS (
    SELECT DISTINCT ON (candidate.participant_email)
      candidate.participant_email,
      candidate.role
    FROM expected_candidates candidate
    JOIN public.user_profiles profile
      ON public.normalize_chat_participant_email(profile.user_email) = candidate.participant_email
    WHERE candidate.participant_email IS NOT NULL
      AND candidate.participant_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      AND profile.status = 'ativo'
      AND (
        (candidate.priority IN (1, 2) AND profile.profile_type IN ('professor', 'coordenador', 'administrador'))
        OR (candidate.priority = 3 AND profile.profile_type = 'aluno')
      )
    ORDER BY candidate.participant_email, candidate.priority
  )
  INSERT INTO public.chat_conversation_participants (
    tenant_id,
    conversation_id,
    participant_email,
    role
  )
  SELECT
    v_schedule_record.tenant_id,
    v_conversation_id,
    expected_profiles.participant_email,
    expected_profiles.role
  FROM expected_profiles
  ON CONFLICT (conversation_id, participant_email)
  DO UPDATE SET
    role = EXCLUDED.role;

  WITH expected_candidates AS (
    SELECT
      public.normalize_chat_participant_email(t.email) AS participant_email,
      1 AS priority
    FROM public.teachers t
    WHERE t.id = v_schedule_record.teacher_id

    UNION ALL

    SELECT
      public.normalize_chat_participant_email(t.email) AS participant_email,
      2 AS priority
    FROM public.teachers t
    WHERE t.id = v_schedule_record.coordinator_teacher_id

    UNION ALL

    SELECT
      public.normalize_chat_participant_email(s.email) AS participant_email,
      3 AS priority
    FROM public.students s
    WHERE s.current_class_id = p_class_id
      AND s.enrollment_status = 'ativo'
  ),
  expected_profiles AS (
    SELECT DISTINCT ON (candidate.participant_email)
      candidate.participant_email
    FROM expected_candidates candidate
    JOIN public.user_profiles profile
      ON public.normalize_chat_participant_email(profile.user_email) = candidate.participant_email
    WHERE candidate.participant_email IS NOT NULL
      AND candidate.participant_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      AND profile.status = 'ativo'
      AND (
        (candidate.priority IN (1, 2) AND profile.profile_type IN ('professor', 'coordenador', 'administrador'))
        OR (candidate.priority = 3 AND profile.profile_type = 'aluno')
      )
    ORDER BY candidate.participant_email, candidate.priority
  )
  DELETE FROM public.chat_conversation_participants participant
   WHERE participant.conversation_id = v_conversation_id
     AND NOT EXISTS (
       SELECT 1
       FROM expected_profiles
       WHERE expected_profiles.participant_email = participant.participant_email
     );

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_chat_academic_groups_for_class(
  p_class_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
BEGIN
  IF p_class_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
     WHERE s.class_id = p_class_id
       AND COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM public.sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;

  UPDATE public.chat_academic_groups academic_group
     SET is_active = FALSE,
         updated_at = NOW()
   WHERE academic_group.class_id = p_class_id
     AND NOT EXISTS (
       SELECT 1
         FROM public.schedules s
        WHERE s.class_id = academic_group.class_id
          AND s.subject_id = academic_group.subject_id
          AND COALESCE(s.is_active, TRUE)
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_chat_academic_groups_for_subject(
  p_subject_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
BEGIN
  IF p_subject_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
     WHERE s.subject_id = p_subject_id
       AND COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM public.sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_chat_academic_groups_for_teacher(
  p_teacher_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
BEGIN
  IF p_teacher_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
     WHERE s.teacher_id = p_teacher_id
       AND COALESCE(s.is_active, TRUE)

    UNION

    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
      JOIN public.classes c
        ON c.id = s.class_id
     WHERE c.coordinator_id = p_teacher_id
       AND COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM public.sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_chat_academic_groups_for_user_email(
  p_user_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := public.normalize_chat_participant_email(p_user_email);
  v_combo RECORD;
BEGIN
  IF v_email IS NULL THEN
    RETURN;
  END IF;

  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
      JOIN public.students student
        ON student.current_class_id = s.class_id
     WHERE COALESCE(s.is_active, TRUE)
       AND public.normalize_chat_participant_email(student.email) = v_email

    UNION

    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
      JOIN public.teachers teacher
        ON teacher.id = s.teacher_id
     WHERE COALESCE(s.is_active, TRUE)
       AND public.normalize_chat_participant_email(teacher.email) = v_email

    UNION

    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
      JOIN public.classes c
        ON c.id = s.class_id
      JOIN public.teachers teacher
        ON teacher.id = c.coordinator_id
     WHERE COALESCE(s.is_active, TRUE)
       AND public.normalize_chat_participant_email(teacher.email) = v_email
  LOOP
    PERFORM public.sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_all_chat_academic_groups()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_combo IN
    SELECT DISTINCT s.class_id, s.subject_id
      FROM public.schedules s
     WHERE COALESCE(s.is_active, TRUE)
  LOOP
    PERFORM public.sync_chat_academic_group(v_combo.class_id, v_combo.subject_id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.chat_academic_groups academic_group
     SET is_active = FALSE,
         updated_at = NOW()
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.schedules s
      WHERE s.class_id = academic_group.class_id
        AND s.subject_id = academic_group.subject_id
        AND COALESCE(s.is_active, TRUE)
   );

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_chat_academic_groups_from_schedules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_chat_academic_group(OLD.class_id, OLD.subject_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_chat_academic_group(NEW.class_id, NEW.subject_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_schedules ON public.schedules;
CREATE TRIGGER trg_sync_chat_academic_groups_schedules
  AFTER INSERT OR UPDATE OF is_active, class_id, subject_id, teacher_id OR DELETE
  ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_chat_academic_groups_from_schedules();

CREATE OR REPLACE FUNCTION public.trg_sync_chat_academic_groups_from_students()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_chat_academic_groups_for_class(OLD.current_class_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_chat_academic_groups_for_class(NEW.current_class_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_students ON public.students;
CREATE TRIGGER trg_sync_chat_academic_groups_students
  AFTER INSERT OR UPDATE OF current_class_id, enrollment_status, email OR DELETE
  ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_chat_academic_groups_from_students();

CREATE OR REPLACE FUNCTION public.trg_sync_chat_academic_groups_from_classes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_chat_academic_groups_for_class(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_classes ON public.classes;
CREATE TRIGGER trg_sync_chat_academic_groups_classes
  AFTER UPDATE OF coordinator_id, name
  ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_chat_academic_groups_from_classes();

CREATE OR REPLACE FUNCTION public.trg_sync_chat_academic_groups_from_subjects()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_chat_academic_groups_for_subject(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_subjects ON public.subjects;
CREATE TRIGGER trg_sync_chat_academic_groups_subjects
  AFTER UPDATE OF name
  ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_chat_academic_groups_from_subjects();

CREATE OR REPLACE FUNCTION public.trg_sync_chat_academic_groups_from_teachers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_chat_academic_groups_for_teacher(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_teachers ON public.teachers;
CREATE TRIGGER trg_sync_chat_academic_groups_teachers
  AFTER UPDATE OF email
  ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_chat_academic_groups_from_teachers();

CREATE OR REPLACE FUNCTION public.trg_sync_chat_academic_groups_from_user_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.sync_chat_academic_groups_for_user_email(OLD.user_email);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_chat_academic_groups_for_user_email(NEW.user_email);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chat_academic_groups_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_sync_chat_academic_groups_user_profiles
  AFTER INSERT OR UPDATE OF status, user_email, profile_type OR DELETE
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_chat_academic_groups_from_user_profiles();

SELECT public.sync_all_chat_academic_groups();

COMMIT;
