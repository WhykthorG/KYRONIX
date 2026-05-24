CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
DECLARE
  raw_claims TEXT := NULLIF(current_setting('request.jwt.claims', true), '');
  raw_headers TEXT := NULLIF(current_setting('request.headers', true), '');
  claims_payload JSONB := '{}'::jsonb;
  headers_payload JSONB := '{}'::jsonb;
  tenant_candidate TEXT;
BEGIN
  IF raw_claims IS NOT NULL THEN
    claims_payload := raw_claims::jsonb;
  END IF;

  IF raw_headers IS NOT NULL THEN
    headers_payload := raw_headers::jsonb;
  END IF;

  tenant_candidate := COALESCE(
    NULLIF(claims_payload ->> 'tenant_id', ''),
    NULLIF(claims_payload -> 'app_metadata' ->> 'tenant_id', ''),
    NULLIF(headers_payload ->> 'x-tenant-id', ''),
    NULLIF(current_setting('app.current_tenant_id', true), '')
  );

  IF tenant_candidate IS NULL
    OR tenant_candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;

  RETURN tenant_candidate::UUID;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.auth_profile_type()
RETURNS TEXT AS $$
  SELECT profile_type FROM public.user_profiles
  WHERE lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.tenant_matches_current(row_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT row_tenant_id IS NULL OR row_tenant_id = current_tenant_id();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY IF EXISTS "own profile readable" ON public.user_profiles;
CREATE POLICY "own profile readable" ON public.user_profiles
  FOR SELECT USING (
    lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND tenant_matches_current(tenant_id)
  );
