CREATE OR REPLACE FUNCTION tenant_matches_current(row_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT row_tenant_id IS NULL OR row_tenant_id = current_tenant_id();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_email
  ON public.user_profiles(tenant_id, user_email);

DROP POLICY IF EXISTS "own profile readable" ON public.user_profiles;
DROP POLICY IF EXISTS "admin read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "admin manage profiles" ON public.user_profiles;

CREATE POLICY "own profile readable" ON public.user_profiles
  FOR SELECT USING (
    lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin read all profiles" ON public.user_profiles
  FOR SELECT USING (
    (auth_profile_type() IN ('administrador','coordenador','secretario') OR auth.role() = 'service_role')
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "admin manage profiles" ON public.user_profiles
  FOR ALL
  USING (
    (auth_has_permission('users.manage.administrative') OR auth.role() = 'service_role')
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    (auth_has_permission('users.manage.administrative') OR auth.role() = 'service_role')
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users update own notifications" ON public.notifications;

CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  );

CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE
  USING (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  )
  WITH CHECK (
    lower(recipient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "staff read system events" ON public.system_events;
CREATE POLICY "staff read system events" ON public.system_events
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "staff read idempotency keys" ON public.idempotency_keys;
CREATE POLICY "staff read idempotency keys" ON public.idempotency_keys
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "staff read audit logs" ON public.audit_logs;
CREATE POLICY "staff read audit logs" ON public.audit_logs
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "staff read observability logs" ON public.observability_logs;
CREATE POLICY "staff read observability logs" ON public.observability_logs
  FOR SELECT USING (
    auth_has_permission('audit.read')
    AND tenant_matches_current(tenant_id)
  );

DROP POLICY IF EXISTS "guardian read linked students" ON public.students;
CREATE POLICY "guardian read linked students" ON public.students
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  );

DROP POLICY IF EXISTS "guardian read linked occurrences" ON public.occurrences;
CREATE POLICY "guardian read linked occurrences" ON public.occurrences
  FOR SELECT USING (
    auth_has_permission('guardian_portal.view')
    AND student_id IN (SELECT auth_linked_student_ids.student_id FROM auth_linked_student_ids())
  );
