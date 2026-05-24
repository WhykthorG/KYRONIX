import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  canAccessPage,
  hasPermission,
  PERMISSIONS,
} from '../shared/src/contracts/access.js';

test('guardian access is limited to the dedicated portal view', () => {
  assert.equal(hasPermission('responsavel', PERMISSIONS.GUARDIAN_PORTAL_VIEW), true);
  assert.equal(canAccessPage('responsavel', 'GuardianPortal'), true);
  assert.equal(canAccessPage('responsavel', 'Messages'), false);
  assert.equal(canAccessPage('responsavel', 'UserManagement'), false);
  assert.equal(canAccessPage('aluno', 'GuardianPortal'), false);
});

test('guardian portal migration provisions the link table, rpc and linked-data policies', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_guardian_portal_mvp.sql', import.meta.url),
    'utf8'
  );
  const schema = fs.readFileSync(
    new URL('../supabase/schema.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS guardian_student_links/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION list_guardian_portal_students/);
  assert.match(migration, /CREATE POLICY "guardians read own links"/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION list_guardian_portal_students/);
  assert.match(migration, /CREATE POLICY "guardian read linked grades"/);
  assert.match(migration, /CREATE POLICY "guardian read linked attendance"/);
  assert.match(migration, /CREATE POLICY "guardian read linked messages"/);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS guardian_student_links/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION list_guardian_portal_students/);
  assert.match(schema, /CREATE POLICY "guardians read own links"/);
  assert.match(schema, /CREATE POLICY "guardian read linked grades"/);
  assert.match(schema, /CREATE POLICY "guardian read linked attendance"/);
  assert.match(schema, /CREATE POLICY "guardian read linked messages"/);
});

test('guardian document access stays behind the authenticated server-side endpoint', () => {
  const handlerSource = fs.readFileSync(
    new URL('../backend/src/routes/guardian/documents.js', import.meta.url),
    'utf8'
  );

  assert.match(handlerSource, /requireAuthenticatedRequest/);
  assert.match(handlerSource, /createRequestScopedClient/);
  assert.match(handlerSource, /rpc\('list_guardian_portal_students'\)/);
  assert.match(handlerSource, /createServiceRoleClient/);
  assert.match(handlerSource, /createSignedUrl/);
});

test('guardian portal student listing stays behind an authenticated server-side endpoint', () => {
  const handlerSource = fs.readFileSync(
    new URL('../backend/src/routes/guardian/students.js', import.meta.url),
    'utf8'
  );

  assert.match(handlerSource, /requireAuthenticatedRequest/);
  assert.match(handlerSource, /req\.method !== 'GET'/);
  assert.match(handlerSource, /profile_type !== 'responsavel'/);
  assert.match(handlerSource, /createRequestScopedClient/);
  assert.match(handlerSource, /rpc\('list_guardian_portal_students'\)/);
});

test('guardian monthly report stays behind the authenticated server-side endpoint and compiles linked monthly data', () => {
  const handlerSource = fs.readFileSync(
    new URL('../backend/src/routes/guardian/monthly-report.js', import.meta.url),
    'utf8'
  );

  assert.match(handlerSource, /requireAuthenticatedRequest/);
  assert.match(handlerSource, /req\.method !== 'GET'/);
  assert.match(handlerSource, /profile_type !== 'responsavel'/);
  assert.match(handlerSource, /createRequestScopedClient/);
  assert.match(handlerSource, /rpc\('list_guardian_portal_students'\)/);
  assert.match(handlerSource, /from\('grades'\)/);
  assert.match(handlerSource, /from\('attendance'\)/);
  assert.match(handlerSource, /from\('occurrences'\)/);
  assert.match(handlerSource, /month/);
});

test('guardian portal client uses the authenticated guardian api base for linked students', () => {
  const clientSource = fs.readFileSync(
    new URL('../frontend/src/lib/guardianPortalClient.js', import.meta.url),
    'utf8'
  );

  assert.match(clientSource, /authenticatedJsonRequest\(`\$\{GUARDIAN_API_BASE\}\/students`/);
  assert.doesNotMatch(clientSource, /fetch\('\/api\/guardian\/students'/);
});

test('guardian portal client uses the authenticated guardian api base for monthly reports', () => {
  const clientSource = fs.readFileSync(
    new URL('../frontend/src/lib/guardianPortalClient.js', import.meta.url),
    'utf8'
  );

  assert.match(clientSource, /authenticatedJsonRequest\(\s*`\$\{GUARDIAN_API_BASE\}\/monthly-report\?/);
});
