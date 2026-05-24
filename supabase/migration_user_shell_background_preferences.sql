-- ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
BEGIN;

DO $$
DECLARE
  has_tenant_id BOOLEAN;
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'tenant_id'
  ) INTO has_tenant_id;

  ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS shell_background_mode TEXT,
    ADD COLUMN IF NOT EXISTS shell_background_asset_id TEXT;

  DROP POLICY IF EXISTS "own profile update" ON user_profiles;

  IF has_tenant_id THEN
    EXECUTE $policy$
      CREATE POLICY "own profile update" ON user_profiles
        FOR UPDATE
        USING (
          user_email = auth.jwt() ->> 'email'
          AND tenant_matches_current(tenant_id)
        )
        WITH CHECK (
          user_email = auth.jwt() ->> 'email'
          AND tenant_matches_current(tenant_id)
        )
    $policy$;
  ELSE
    EXECUTE $policy$
      CREATE POLICY "own profile update" ON user_profiles
        FOR UPDATE
        USING (
          user_email = auth.jwt() ->> 'email'
        )
        WITH CHECK (
          user_email = auth.jwt() ->> 'email'
        )
    $policy$;
  END IF;
END $$;

COMMIT;
