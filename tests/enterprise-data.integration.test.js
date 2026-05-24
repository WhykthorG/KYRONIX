import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('enterprise data migration provisions tenant-aware base tables and helpers', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_enterprise_data_base.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE OR REPLACE FUNCTION current_tenant_id\(\)/);
  assert.match(migration, /request\.headers/);
  assert.match(migration, /headers_payload ->> 'x-tenant-id'/);
  assert.match(migration, /ALTER TABLE notifications\s+ADD COLUMN IF NOT EXISTS tenant_id UUID;/);
  assert.match(migration, /ALTER TABLE audit_logs\s+ADD COLUMN IF NOT EXISTS tenant_id UUID;/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS system_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS idempotency_keys/);
  assert.match(migration, /CREATE POLICY "users read own notifications" ON notifications/);
  assert.match(migration, /tenant_id IS NULL OR tenant_id = current_tenant_id\(\)/);
  assert.match(migration, /CREATE POLICY "staff read system events" ON system_events/);
  assert.match(migration, /CREATE POLICY "staff read idempotency keys" ON idempotency_keys/);
  assert.match(migration, /INSERT INTO audit_logs \(\s*tenant_id,/s);
  assert.match(migration, /`system_events`/);
});

test('schema keeps calendar events intact while exposing enterprise system events and idempotency tables', () => {
  const schema = fs.readFileSync(
    new URL('../supabase/schema.sql', import.meta.url),
    'utf8'
  );

  assert.match(schema, /EVENTS \(school calendar\)/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION current_tenant_id\(\)/);
  assert.match(schema, /request\.headers/);
  assert.match(schema, /headers_payload ->> 'x-tenant-id'/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION tenant_matches_current\(row_tenant_id UUID\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS notifications \(\s*id\s+UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\),\s*tenant_id\s+UUID DEFAULT current_tenant_id\(\),/s);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS system_events/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS idempotency_keys/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS user_profiles \(\s*id\s+UUID PRIMARY KEY DEFAULT gen_random_uuid\(\),\s*tenant_id\s+UUID DEFAULT current_tenant_id\(\),/s);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS audit_logs \(\s*id\s+UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\),\s*tenant_id\s+UUID DEFAULT current_tenant_id\(\),/s);
  assert.match(schema, /ALTER TABLE system_events\s+ENABLE ROW LEVEL SECURITY;/);
  assert.match(schema, /ALTER TABLE idempotency_keys\s+ENABLE ROW LEVEL SECURITY;/);
  assert.match(schema, /CREATE POLICY "staff read system events" ON system_events/);
  assert.match(schema, /CREATE POLICY "staff read idempotency keys" ON idempotency_keys/);
  assert.match(schema, /CREATE POLICY "staff read audit logs" ON audit_logs\s+FOR SELECT USING \(\s*auth_has_permission\('audit\.read'\)\s+AND tenant_matches_current\(tenant_id\)\s*\);/s);
});

test('hardening migration tightens tenant isolation and critical query support without replacing prior foundations', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_hardening_enterprise.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /idx_notifications_recipient_tenant_created_at/);
  assert.match(migration, /CREATE POLICY "users update own notifications" ON public\.notifications/);
  assert.match(migration, /ALTER TABLE public\.observability_logs\s+ADD COLUMN IF NOT EXISTS tenant_id UUID;/);
  assert.match(migration, /idx_observability_logs_tenant_created_at/);
  assert.match(migration, /idx_messages_recipient_type_class_created_at/);
  assert.match(migration, /idx_messages_recipient_ids_gin/);
});

test('tenant scope enforcement migration hardens profile, audit and guardian access with explicit tenant matching', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_tenant_scope_enforcement.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE OR REPLACE FUNCTION tenant_matches_current\(row_tenant_id UUID\)/);
  assert.match(migration, /row_tenant_id IS NULL OR row_tenant_id = current_tenant_id\(\)/);
  assert.match(migration, /ALTER TABLE public\.user_profiles\s+ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT current_tenant_id\(\);/);
  assert.match(migration, /idx_user_profiles_tenant_email/);
  assert.match(migration, /CREATE POLICY "admin read all profiles" ON public\.user_profiles/);
  assert.match(migration, /lower\(user_email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(migration, /tenant_matches_current\(tenant_id\)/);
  assert.match(migration, /CREATE POLICY "guardian read linked students" ON public\.students/);
  assert.match(migration, /CREATE POLICY "guardian read linked occurrences" ON public\.occurrences/);
});

test('proxy tenant header migration lets RLS resolve tenant during authenticated REST bootstrap', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_proxy_tenant_header_bootstrap.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.current_tenant_id\(\)/);
  assert.match(migration, /request\.headers/);
  assert.match(migration, /headers_payload ->> 'x-tenant-id'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.auth_profile_type\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.tenant_matches_current\(row_tenant_id UUID\)/);
  assert.match(migration, /row_tenant_id IS NULL OR row_tenant_id = current_tenant_id\(\)/);
  assert.match(migration, /lower\(user_email\) = lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\)/);
  assert.match(migration, /DROP POLICY IF EXISTS "own profile readable" ON public\.user_profiles/);
});
