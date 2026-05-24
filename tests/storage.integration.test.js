// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createStorageFileReference,
  diffRemovedStorageFileReferences,
  extractStoragePath,
  getStoredFileName,
  getStorageFileKey,
  normalizeStorageFileReference,
  normalizeStorageFileReferences,
} from '../shared/src/contracts/storage.js';
import {
  buildOptimizedImageFileName,
  shouldOptimizeImageBeforeUpload,
} from '../frontend/src/lib/imageUploadOptimizer.js';

test('extractStoragePath supports canonical objects and legacy storage URLs', () => {
  assert.equal(
    extractStoragePath({ file_path: 'attachments/student/doc.pdf' }),
    'attachments/student/doc.pdf'
  );
  assert.equal(
    extractStoragePath('https://example.supabase.co/storage/v1/object/public/project-wg-files/attachments/student/doc.pdf'),
    'attachments/student/doc.pdf'
  );
  assert.equal(
    extractStoragePath('https://example.supabase.co/storage/v1/object/sign/project-wg-files/submissions/user-1/work.docx?token=abc'),
    'submissions/user-1/work.docx'
  );
});

test('normalizeStorageFileReference converts legacy values to canonical file_path objects', () => {
  assert.deepEqual(
    normalizeStorageFileReference({
      path: 'attachments/student/doc.pdf',
      file_name: 'documento.pdf',
      description: 'RG',
    }),
    {
      description: 'RG',
      file_path: 'attachments/student/doc.pdf',
      file_name: 'documento.pdf',
      bucket: 'project-wg-files',
    }
  );

  assert.deepEqual(
    normalizeStorageFileReference('https://example.supabase.co/storage/v1/object/public/project-wg-files/diary/material-1.pdf'),
    {
      file_path: 'diary/material-1.pdf',
      file_name: 'material-1.pdf',
      bucket: 'project-wg-files',
    }
  );
});

test('normalizeStorageFileReferences keeps valid refs and derives stable names and keys', () => {
  const refs = normalizeStorageFileReferences([
    createStorageFileReference({
      path: 'submissions/user-1/work.docx',
      fileName: 'Trabalho Final.docx',
      metadata: 'kept',
    }),
    null,
    '',
    { url: 'https://cdn.example.com/manual.pdf', file_name: 'Manual.pdf' },
  ]);

  assert.deepEqual(refs, [
    {
      metadata: 'kept',
      file_path: 'submissions/user-1/work.docx',
      file_name: 'Trabalho Final.docx',
      bucket: 'project-wg-files',
    },
    {
      file_name: 'Manual.pdf',
      url: 'https://cdn.example.com/manual.pdf',
    },
  ]);

  assert.equal(getStoredFileName(refs[0]), 'Trabalho Final.docx');
  assert.equal(getStorageFileKey(refs[0]), 'project-wg-files:submissions/user-1/work.docx');
  assert.equal(getStorageFileKey(refs[1]), 'https://cdn.example.com/manual.pdf');
});

test('normalizeStorageFileReference ignores bucket overrides outside the configured private bucket', () => {
  assert.deepEqual(
    normalizeStorageFileReference({
      file_path: 'submissions/user-1/work.docx',
      file_name: 'work.docx',
      bucket: 'another-bucket',
    }),
    {
      file_path: 'submissions/user-1/work.docx',
      file_name: 'work.docx',
      bucket: 'project-wg-files',
    }
  );
});

test('diffRemovedStorageFileReferences identifies only files removed from the persisted set', () => {
  const previous = normalizeStorageFileReferences([
    { file_path: 'diary/kept.pdf', file_name: 'kept.pdf' },
    { file_path: 'diary/removed.pdf', file_name: 'removed.pdf' },
  ]);
  const next = normalizeStorageFileReferences([
    { file_path: 'diary/kept.pdf', file_name: 'kept.pdf' },
    { file_path: 'diary/new.pdf', file_name: 'new.pdf' },
  ]);

  assert.deepEqual(diffRemovedStorageFileReferences(previous, next), [
    {
      file_path: 'diary/removed.pdf',
      file_name: 'removed.pdf',
      bucket: 'project-wg-files',
    },
  ]);
});

test('storage secure migration enforces server-side validation and cleanup policies', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_storage_secure_files.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /students_attachments_private_storage_check/);
  assert.match(migration, /submissions_file_urls_private_storage_check/);
  assert.match(migration, /class_diary_attachment_urls_private_storage_check/);
  assert.match(migration, /lesson_plans_attachment_urls_private_storage_check/);
  assert.match(migration, /staff_read_school_files/);
  assert.match(migration, /student_delete_own_submission_files/);
});

test('image upload optimizer targets supported raster formats and rewrites optimized extensions', () => {
  assert.equal(shouldOptimizeImageBeforeUpload({ type: 'image/jpeg' }), true);
  assert.equal(shouldOptimizeImageBeforeUpload({ type: 'image/png' }), true);
  assert.equal(shouldOptimizeImageBeforeUpload({ type: 'image/webp' }), true);
  assert.equal(shouldOptimizeImageBeforeUpload({ type: 'application/pdf' }), false);
  assert.equal(shouldOptimizeImageBeforeUpload({ type: 'image/gif' }), false);

  assert.equal(buildOptimizedImageFileName('foto-original.png', 'image/webp'), 'foto-original.webp');
  assert.equal(buildOptimizedImageFileName('aluno', 'image/jpeg'), 'aluno.jpg');
});

test('storage upload pipeline optimizes supported images before sending to supabase', () => {
  const source = fs.readFileSync(
    new URL('../frontend/src/lib/storageFiles.js', import.meta.url),
    'utf8'
  );

  assert.match(source, /optimizeImageForUpload/);
  assert.match(source, /optimizationResult = await optimizeImageForUpload\(file\)/);
  assert.match(source, /const uploadFile = optimizationResult\.file \|\| file/);
  assert.match(source, /optimized_image: Boolean\(optimizationResult\.optimized\)/);
});

test('assignment submission previews resolve signed urls only on demand', () => {
  const source = fs.readFileSync(
    new URL('../frontend/src/pages/Assignments.jsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const openSubmissionFile = async \(fileRef\) =>/);
  assert.match(source, /const url = await resolveStorageFileUrl\(fileRef, \{ bucket: BUCKET \}\)/);
  assert.match(source, /window\.open\(url, '_blank', 'noopener,noreferrer'\)/);
  assert.doesNotMatch(source, /submissionFileLinks/);
});
