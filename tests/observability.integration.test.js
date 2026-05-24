// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildFrontendRoute,
  buildObservabilityLogEntry,
  OBSERVABILITY_CHANNELS,
  OBSERVABILITY_EVENT_TYPES,
  OBSERVABILITY_LEVELS,
  resolveClientObservabilityEventRequest,
  resolveObservabilityEventDefinition,
} from '../shared/src/contracts/observability.js';

test('observability event definitions keep client logging restricted to known frontend events', () => {
  const renderError = resolveObservabilityEventDefinition(
    OBSERVABILITY_EVENT_TYPES.FRONTEND_RENDER_ERROR,
  );
  const navigation = resolveObservabilityEventDefinition(
    OBSERVABILITY_EVENT_TYPES.FRONTEND_NAVIGATION,
  );
  const backend = resolveObservabilityEventDefinition(
    OBSERVABILITY_EVENT_TYPES.BACKEND_API_ERROR,
  );

  assert.equal(renderError.channel, OBSERVABILITY_CHANNELS.FRONTEND);
  assert.equal(renderError.level, OBSERVABILITY_LEVELS.ERROR);
  assert.equal(renderError.clientWritable, true);

  assert.equal(navigation.channel, OBSERVABILITY_CHANNELS.FRONTEND);
  assert.equal(navigation.level, OBSERVABILITY_LEVELS.INFO);
  assert.equal(navigation.clientWritable, true);

  assert.equal(backend.channel, OBSERVABILITY_CHANNELS.BACKEND);
  assert.equal(backend.clientWritable, false);
});

test('buildFrontendRoute keeps frontend error and navigation routes canonical', () => {
  assert.equal(buildFrontendRoute('/Desktop', '?tab=grades'), '/Desktop?tab=grades');
  assert.equal(buildFrontendRoute('/Desktop', 'tab=grades'), '/Desktop?tab=grades');
  assert.equal(buildFrontendRoute('/Desktop', ''), '/Desktop');
  assert.equal(buildFrontendRoute('', ''), null);
});

test('resolveClientObservabilityEventRequest normalizes frontend render errors and redacts sensitive metadata', () => {
  const result = resolveClientObservabilityEventRequest({
    eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_RENDER_ERROR,
    requester: {
      user: {
        id: 'user-123',
        email: 'professor@escola.com',
      },
    },
    message: 'Falha ao renderizar dashboard',
    route: '/Desktop',
    metadata: {
      source: 'ErrorBoundary.componentDidCatch',
      name: 'TypeError',
      stack: 'stack-trace',
      access_token: 'nao-deve-vazar',
      component_stack: ' at Dashboard',
    },
    traceId: 'trace-obs-1',
  });

  assert.equal(result.eventType, OBSERVABILITY_EVENT_TYPES.FRONTEND_RENDER_ERROR);
  assert.equal(result.traceId, 'trace-obs-1');
  assert.equal(result.message, 'Falha ao renderizar dashboard');
  assert.equal(result.route, '/Desktop');
  assert.equal(result.source, 'ErrorBoundary.componentDidCatch');
  assert.deepEqual(result.context, {
    name: 'TypeError',
    stack: 'stack-trace',
    component_stack: 'at Dashboard',
    rejection: false,
  });
});

test('resolveClientObservabilityEventRequest blocks backend-only event types from the client', () => {
  assert.throws(() => resolveClientObservabilityEventRequest({
    eventType: OBSERVABILITY_EVENT_TYPES.BACKEND_API_ERROR,
    requester: {
      user: {
        id: 'user-123',
        email: 'professor@escola.com',
      },
    },
    message: 'erro',
  }), (error) => {
    assert.equal(error.code, 'OBSERVABILITY_EVENT_CLIENT_FORBIDDEN');
    assert.equal(error.statusCode, 403);
    return true;
  });
});

test('navigation events require route and keep only compact telemetry fields', () => {
  const result = resolveClientObservabilityEventRequest({
    eventType: OBSERVABILITY_EVENT_TYPES.FRONTEND_NAVIGATION,
    requester: {
      user: {
        id: 'user-123',
        email: 'professor@escola.com',
      },
    },
    route: '/Desktop',
    metadata: {
      kind: 'page_load',
      from: '/login',
      to: '/Desktop',
      duration_ms: '812',
      dom_content_loaded_ms: 240,
      redirect_count: '0',
    },
  });

  assert.equal(result.level, OBSERVABILITY_LEVELS.INFO);
  assert.equal(result.route, '/Desktop');
  assert.equal(result.message, 'Navegacao registrada para /Desktop');
  assert.deepEqual(result.context, {
    kind: 'page_load',
    from: '/login',
    to: '/Desktop',
    duration_ms: 812,
    dom_content_loaded_ms: 240,
    redirect_count: 0,
  });
});

test('buildObservabilityLogEntry preserves actor context and sanitizes nested secrets', () => {
  const entry = buildObservabilityLogEntry({
    eventType: OBSERVABILITY_EVENT_TYPES.BACKEND_API_ERROR,
    traceId: 'trace-api-1',
    message: 'Falha ao criar matricula',
    operation: 'POST /api/admin/enrollments',
    source: 'api/admin/enrollments',
    route: '/api/admin/enrollments',
    actor: {
      actor_user_id: 'admin-1',
      actor_email: 'admin@escola.com',
      actor_name: 'Administrador',
      actor_profile_type: 'administrador',
      actor_tenant_id: '11111111-1111-1111-1111-111111111111',
    },
    context: {
      code: 'ENROLLMENT_TRANSACTION_FAILED',
      request: {
        authorization: 'Bearer secret',
      },
    },
  });

  assert.equal(entry.event_type, OBSERVABILITY_EVENT_TYPES.BACKEND_API_ERROR);
  assert.equal(entry.actor_email, 'admin@escola.com');
  assert.equal(entry.tenant_id, '11111111-1111-1111-1111-111111111111');
  assert.deepEqual(entry.context, {
    code: 'ENROLLMENT_TRANSACTION_FAILED',
    request: {
      authorization: '[redacted]',
    },
  });
});

test('frontend observability uses the shared route builder and fully resets boundary state', () => {
  const errorBoundarySource = fs.readFileSync(
    new URL('../frontend/src/components/common/ErrorBoundary.jsx', import.meta.url),
    'utf8'
  );
  const navigationTrackerSource = fs.readFileSync(
    new URL('../frontend/src/lib/NavigationTracker.jsx', import.meta.url),
    'utf8'
  );
  const clientSource = fs.readFileSync(
    new URL('../frontend/src/lib/observabilityClient.js', import.meta.url),
    'utf8'
  );

  assert.match(errorBoundarySource, /buildFrontendRoute\(window\.location\.pathname, window\.location\.search\)/);
  assert.match(errorBoundarySource, /errorCount:\s*0,/);
  assert.match(navigationTrackerSource, /buildFrontendRoute\(location\.pathname, location\.search\)/);
  assert.match(clientSource, /buildFrontendRoute\(window\.location\?\.pathname, window\.location\?\.search\)/);
});

test('enterprise hardening scopes observability logs by tenant in schema and migration', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migration_hardening_enterprise.sql', import.meta.url),
    'utf8'
  );
  const schema = fs.readFileSync(
    new URL('../supabase/schema.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /ALTER TABLE public\.observability_logs\s+ADD COLUMN IF NOT EXISTS tenant_id UUID;/);
  assert.match(migration, /idx_observability_logs_tenant_created_at/);
  assert.match(migration, /CREATE POLICY "staff read observability logs" ON public\.observability_logs/);
  assert.match(migration, /tenant_id IS NULL OR tenant_id = current_tenant_id\(\)/);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS observability_logs \(\s*id\s+UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\),\s*tenant_id\s+UUID DEFAULT current_tenant_id\(\),/s);
  assert.match(schema, /CREATE INDEX idx_observability_logs_tenant_created_at/);
  assert.match(schema, /CREATE POLICY "staff read observability logs" ON observability_logs\s+FOR SELECT USING \(\s*auth_has_permission\('audit\.read'\)\s+AND tenant_matches_current\(tenant_id\)\s*\);/s);
});
