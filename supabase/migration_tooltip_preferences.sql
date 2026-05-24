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
