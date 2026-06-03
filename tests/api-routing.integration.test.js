// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getApiRouteSegments, resolveApiHandlerFromRoot } from '../backend/src/services/apiRouteResolver.js';
import { createNetlifyRequest, createNetlifyResponse } from '../backend/src/services/netlifyApiBridge.js';
import { resolveApiHandlerFromManifest } from '../infra/netlify/functions/apiRouteManifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '../backend/src/routes');

test('getApiRouteSegments normalizes Vercel and Netlify API prefixes', () => {
  assert.deepEqual(
    getApiRouteSegments('/api/chat/conversations'),
    ['chat', 'conversations']
  );
  assert.deepEqual(
    getApiRouteSegments('/.netlify/functions/api/chat/calls/abc123/join'),
    ['chat', 'calls', 'abc123', 'join']
  );
  assert.deepEqual(
    getApiRouteSegments('/api/security/supabase/rest/v1/user_profiles'),
    ['security', 'supabase', 'rest', 'v1', 'user_profiles']
  );
});

test('resolveApiHandlerFromRoot resolves direct, dynamic and catch-all handlers', () => {
  const direct = resolveApiHandlerFromRoot(apiRoot, ['chat', 'conversations']);
  const dynamic = resolveApiHandlerFromRoot(apiRoot, ['chat', 'calls', 'abc123', 'join']);
  const catchAll = resolveApiHandlerFromRoot(apiRoot, ['security', 'supabase', 'rest', 'v1', 'students']);

  assert.equal(path.basename(direct.filePath), 'index.js');
  assert.match(direct.filePath, /backend[\\/]src[\\/]routes[\\/]chat[\\/]conversations[\\/]index\.js$/);

  assert.equal(dynamic.params.callId, 'abc123');
  assert.match(dynamic.filePath, /backend[\\/]src[\\/]routes[\\/]chat[\\/]calls[\\/]\[callId\][\\/]join\.js$/);

  assert.deepEqual(catchAll.params.path, ['rest', 'v1', 'students']);
  assert.match(catchAll.filePath, /backend[\\/]src[\\/]routes[\\/]security[\\/]supabase[\\/]\[\.\.\.path\]\.js$/);
});

test('Netlify request and response bridges preserve handler-friendly shapes', () => {
  const req = createNetlifyRequest({
    httpMethod: 'POST',
    rawUrl: 'https://wg-eighteen.netlify.app/api/chat/conversations',
    headers: {
      'content-type': 'application/json',
      cookie: 'sb-access-token=abc123; theme=dark',
    },
    body: JSON.stringify({ type: 'direct' }),
    isBase64Encoded: false,
  }, {
    pathname: '/api/chat/conversations',
    query: { mode: 'direct' },
  });

  assert.equal(req.method, 'POST');
  assert.equal(req.query.mode, 'direct');
  assert.equal(req.body.type, 'direct');
  assert.equal(req.cookies.theme, 'dark');

  const res = createNetlifyResponse();
  res.status(201);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));

  assert.deepEqual(res.toNetlifyResponse(), {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ok: true }),
  });
});

test('Netlify static route manifest resolves direct, dynamic and catch-all handlers', async () => {
  const direct = resolveApiHandlerFromManifest(['chat', 'conversations']);
  const dynamic = resolveApiHandlerFromManifest(['chat', 'calls', 'abc123', 'join']);
  const catchAll = resolveApiHandlerFromManifest(['security', 'supabase', 'rest', 'v1', 'students']);

  assert.equal(typeof direct.loadHandler, 'function');
  assert.equal(typeof await direct.loadHandler(), 'function');
  assert.deepEqual(direct.params, {});
  assert.deepEqual(direct.pattern, ['chat', 'conversations']);

  assert.equal(typeof dynamic.loadHandler, 'function');
  assert.equal(typeof await dynamic.loadHandler(), 'function');
  assert.equal(dynamic.params.callId, 'abc123');
  assert.deepEqual(dynamic.pattern, ['chat', 'calls', '[callId]', 'join']);

  assert.equal(typeof catchAll.loadHandler, 'function');
  assert.equal(typeof await catchAll.loadHandler(), 'function');
  assert.deepEqual(catchAll.params.path, ['rest', 'v1', 'students']);
  assert.deepEqual(catchAll.pattern, ['security', 'supabase', '[...path]']);

  assert.equal(resolveApiHandlerFromManifest(['missing', 'route']), null);
  assert.equal(resolveApiHandlerFromManifest(['security', 'supabase']), null);
});

test('Netlify route resolution tolerates relative rawUrl values', async () => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

  const { handler } = await import('../infra/netlify/functions/api.js');

  const response = await handler({
    httpMethod: 'GET',
    rawUrl: '/api/security/me/profile',
    headers: {},
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
  });

  assert.equal(response.statusCode, 401);
});
