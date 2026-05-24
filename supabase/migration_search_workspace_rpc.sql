-- ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
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
