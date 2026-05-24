// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  canAccessPage,
  canExportSystemData,
  canManageAdministrativeProfiles,
  canManageUsers,
  canCreateOwnClassMessages,
  canUseDirectChat,
  canWriteStudents,
  canWriteTeachers,
  hasPermission,
  PERMISSIONS,
} from '../shared/src/contracts/access.js';

test('student write access is restricted to management roles', () => {
  assert.equal(canWriteStudents('administrador'), true);
  assert.equal(canWriteStudents('coordenador'), true);
  assert.equal(canWriteStudents('secretario'), true);
  assert.equal(canWriteStudents('professor'), false);
  assert.equal(canWriteStudents('aluno'), false);
});

test('teacher write access is restricted to coordination and admin', () => {
  assert.equal(canWriteTeachers('administrador'), true);
  assert.equal(canWriteTeachers('coordenador'), true);
  assert.equal(canWriteTeachers('secretario'), false);
  assert.equal(canWriteTeachers('professor'), false);
});

test('direct chat is available to students and internal staff roles', () => {
  assert.equal(canUseDirectChat('administrador'), true);
  assert.equal(canUseDirectChat('professor'), true);
  assert.equal(canUseDirectChat('aluno'), true);
});

test('students can create messages for their own class', () => {
  assert.equal(canCreateOwnClassMessages('aluno'), true);
  assert.equal(canCreateOwnClassMessages('professor'), false);
});

test('granular administrative capabilities are restricted to coordinator and admin', () => {
  assert.equal(canManageUsers('coordenador'), true);
  assert.equal(canManageUsers('administrador'), true);
  assert.equal(canManageUsers('secretario'), false);

  assert.equal(canManageAdministrativeProfiles('coordenador'), true);
  assert.equal(canManageAdministrativeProfiles('administrador'), true);
  assert.equal(canManageAdministrativeProfiles('secretario'), false);

  assert.equal(canExportSystemData('administrador'), true);
  assert.equal(canExportSystemData('coordenador'), false);
  assert.equal(canExportSystemData('secretario'), false);
  assert.equal(canExportSystemData('professor'), false);
});

test('page access is derived from the permission matrix', () => {
  assert.equal(canAccessPage('coordenador', 'UserManagement'), true);
  assert.equal(canAccessPage('secretario', 'UserManagement'), false);
  assert.equal(canAccessPage('aluno', 'Grades'), true);
  assert.equal(canAccessPage('aluno', 'Teachers'), false);
  assert.equal(canAccessPage('responsavel', 'GuardianPortal'), true);
  assert.equal(canAccessPage('responsavel', 'Messages'), false);
});

test('permission helper exposes explicit capabilities by permission key', () => {
  assert.equal(hasPermission('secretario', PERMISSIONS.EVENTS_WRITE), true);
  assert.equal(hasPermission('professor', PERMISSIONS.EVENTS_WRITE), false);
  assert.equal(hasPermission('aluno', PERMISSIONS.EVENTS_WRITE), false);
  assert.equal(hasPermission('coordenador', PERMISSIONS.USERS_MANAGE_ADMINISTRATIVE), true);
  assert.equal(hasPermission('responsavel', PERMISSIONS.GUARDIAN_PORTAL_VIEW), true);
});

test('rbac sql migration aligns sensitive policies to permission helpers', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_rbac_permissions.sql', import.meta.url),
    'utf8'
  );
  const schema = fs.readFileSync(
    new URL('../supabase/schema.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE OR REPLACE FUNCTION auth_permissions_for_profile/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION auth_has_permission/);
  assert.match(migration, /auth_has_permission\('users\.manage\.administrative'\)/);
  assert.match(migration, /auth_has_permission\('messages\.write'\)/);
  assert.match(migration, /DROP POLICY IF EXISTS "students cannot manage events"/);

  assert.match(schema, /CREATE OR REPLACE FUNCTION auth_permissions_for_profile/);
  assert.doesNotMatch(schema, /CREATE POLICY "messages_insert_staff"/);
  assert.doesNotMatch(schema, /CREATE POLICY "student write class messages"/);
  assert.match(schema, /auth_has_permission\('submissions\.grade'\)/);
});

test('ui discovery and dashboard affordances reuse central permission helpers', () => {
  const globalSearchSource = fs.readFileSync(
    new URL('../frontend/src/lib/globalSearch.js', import.meta.url),
    'utf8'
  );
  const pageHeaderSource = fs.readFileSync(
    new URL('../frontend/src/components/common/PageHeader.jsx', import.meta.url),
    'utf8'
  );

  assert.match(globalSearchSource, /canAccessPage\(profileType, entity\.page\)/);
  assert.doesNotMatch(globalSearchSource, /entity\.roles\.includes\(profileType\)/);
  assert.match(pageHeaderSource, /canAccessDashboardByPermission\(profileType\)/);
  assert.doesNotMatch(pageHeaderSource, /\['coordenador', 'secretario', 'administrador'\]\.includes\(profileType\)/);
});
