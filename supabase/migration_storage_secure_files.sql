BEGIN;

CREATE OR REPLACE FUNCTION storage_extract_known_path(raw_value TEXT, bucket_name TEXT DEFAULT 'project-wg-files')
RETURNS TEXT AS $$
DECLARE
  v_trimmed TEXT := NULLIF(BTRIM(raw_value), '');
  v_match TEXT[];
  v_bucket_pattern TEXT := regexp_replace(COALESCE(bucket_name, ''), '([.[\\]{}()*+?^$|\\\\-])', '\\\1', 'g');
BEGIN
  IF v_trimmed IS NULL THEN RETURN NULL; END IF;
  IF v_trimmed !~* '^https?://' THEN RETURN v_trimmed; END IF;
  v_match := regexp_match(v_trimmed, '/storage/v1/object/(?:sign|public|authenticated)/' || v_bucket_pattern || '/([^?]+)');
  IF v_match IS NULL THEN
    v_match := regexp_match(v_trimmed, '/storage/v1/object/' || v_bucket_pattern || '/([^?]+)');
  END IF;
  IF v_match IS NULL OR array_length(v_match, 1) = 0 THEN RETURN NULL; END IF;
  RETURN NULLIF(BTRIM(v_match[1]), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_jsonb_reference_path(reference_value JSONB, bucket_name TEXT DEFAULT 'project-wg-files')
RETURNS TEXT AS $$
DECLARE
  v_type TEXT := jsonb_typeof(reference_value);
BEGIN
  IF reference_value IS NULL THEN RETURN NULL; END IF;
  IF v_type = 'string' THEN RETURN storage_extract_known_path(reference_value #>> '{}', bucket_name); END IF;
  IF v_type <> 'object' THEN RETURN NULL; END IF;
  RETURN COALESCE(
    NULLIF(BTRIM(reference_value ->> 'file_path'), ''),
    NULLIF(BTRIM(reference_value ->> 'path'), ''),
    NULLIF(BTRIM(reference_value ->> 'filePath'), ''),
    storage_extract_known_path(reference_value ->> 'signedUrl', bucket_name),
    storage_extract_known_path(reference_value ->> 'publicUrl', bucket_name),
    storage_extract_known_path(reference_value ->> 'url', bucket_name)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_path_matches_prefixes(file_path TEXT, allowed_prefixes TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(allowed_prefixes, ARRAY[]::TEXT[])) AS prefix
    WHERE file_path LIKE prefix || '%'
  );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION storage_file_array_is_valid(
  file_values JSONB,
  bucket_name TEXT DEFAULT 'project-wg-files',
  allowed_prefixes TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN file_values IS NULL THEN TRUE
    WHEN jsonb_typeof(file_values) <> 'array' THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(file_values) AS item(value)
      CROSS JOIN LATERAL (
        SELECT
          storage_jsonb_reference_path(item.value, bucket_name) AS file_path,
          NULLIF(BTRIM(item.value ->> 'bucket'), '') AS object_bucket
      ) AS ref
      WHERE ref.file_path IS NULL
        OR NOT storage_path_matches_prefixes(ref.file_path, allowed_prefixes)
        OR (ref.object_bucket IS NOT NULL AND ref.object_bucket <> bucket_name)
    )
  END;
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_attachments_private_storage_check;
ALTER TABLE students ADD CONSTRAINT students_attachments_private_storage_check
  CHECK (storage_file_array_is_valid(attachments, 'project-wg-files', ARRAY['attachments/'])) NOT VALID;

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_file_urls_private_storage_check;
ALTER TABLE submissions ADD CONSTRAINT submissions_file_urls_private_storage_check
  CHECK (storage_file_array_is_valid(file_urls, 'project-wg-files', ARRAY['submissions/'])) NOT VALID;

ALTER TABLE class_diary DROP CONSTRAINT IF EXISTS class_diary_attachment_urls_private_storage_check;
ALTER TABLE class_diary ADD CONSTRAINT class_diary_attachment_urls_private_storage_check
  CHECK (storage_file_array_is_valid(attachment_urls, 'project-wg-files', ARRAY['diary/'])) NOT VALID;

ALTER TABLE lesson_plans DROP CONSTRAINT IF EXISTS lesson_plans_attachment_urls_private_storage_check;
ALTER TABLE lesson_plans ADD CONSTRAINT lesson_plans_attachment_urls_private_storage_check
  CHECK (storage_file_array_is_valid(attachment_urls, 'project-wg-files', ARRAY['diary/'])) NOT VALID;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-wg-files', 'project-wg-files', false)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false;

DROP POLICY IF EXISTS "staff_manage_school_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_read_school_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_manage_enrollment_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_manage_diary_files" ON storage.objects;
DROP POLICY IF EXISTS "staff_read_submission_files" ON storage.objects;
DROP POLICY IF EXISTS "student_upload_own_submissions" ON storage.objects;
DROP POLICY IF EXISTS "student_read_own_submission_files" ON storage.objects;
DROP POLICY IF EXISTS "student_delete_own_submission_files" ON storage.objects;

CREATE POLICY "staff_read_school_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() IN ('administrador', 'coordenador', 'secretario', 'professor')
  );

CREATE POLICY "staff_manage_enrollment_files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND name LIKE 'attachments/%'
    AND auth_has_permission('enrollments.manage')
  )
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND name LIKE 'attachments/%'
    AND auth_has_permission('enrollments.manage')
  );

CREATE POLICY "staff_manage_diary_files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND name LIKE 'diary/%'
    AND auth_has_permission('diary.write')
  )
  WITH CHECK (
    bucket_id = 'project-wg-files'
    AND name LIKE 'diary/%'
    AND auth_has_permission('diary.write')
  );

CREATE POLICY "staff_read_submission_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND name LIKE 'submissions/%'
    AND auth_has_permission('submissions.read.all')
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

CREATE POLICY "student_delete_own_submission_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-wg-files'
    AND auth_profile_type() = 'aluno'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

COMMIT;
