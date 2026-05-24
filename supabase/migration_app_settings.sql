-- ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
BEGIN;

CREATE TABLE IF NOT EXISTS app_settings (
  id                          TEXT PRIMARY KEY DEFAULT 'system' CHECK (id = 'system'),
  school_name                 TEXT NOT NULL DEFAULT 'Project WG Escola',
  school_email                TEXT,
  school_phone                TEXT,
  school_address              TEXT,
  notify_new_enrollment       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_payment_due          BOOLEAN NOT NULL DEFAULT TRUE,
  notify_grade_posted         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_attendance_issue     BOOLEAN NOT NULL DEFAULT TRUE,
  allow_student_photo_upload  BOOLEAN NOT NULL DEFAULT TRUE,
  require_guardian_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  enable_tooltips             BOOLEAN NOT NULL DEFAULT TRUE,
  primary_color               TEXT NOT NULL DEFAULT '#6366f1',
  language                    TEXT NOT NULL DEFAULT 'pt-BR',
  timezone                    TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read app settings" ON app_settings;
DROP POLICY IF EXISTS "staff write app settings" ON app_settings;

CREATE POLICY "staff read app settings" ON app_settings
  FOR SELECT USING (auth_profile_type() IN ('administrador','coordenador','secretario'));

CREATE POLICY "staff write app settings" ON app_settings
  FOR ALL USING (auth_profile_type() IN ('administrador','coordenador','secretario'));

COMMIT;
