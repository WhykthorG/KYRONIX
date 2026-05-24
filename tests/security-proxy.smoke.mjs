import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

import {
  handleSupabaseProxyRequest,
  buildSupabaseProxyPathname,
  collectForwardHeaders,
  getProxyTargetUrl,
} from '../backend/src/services/supabaseProxyServer.js';
import {
  buildSupabaseProxyPath,
  isProxyableSupabasePath,
} from '../shared/src/supabaseProxyRouting.js';

function createMockRequest({
  method = 'GET',
  url = '/',
  headers = {},
  body = '',
} = {}) {
  const req = Readable.from(body ? [body] : []);
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: Buffer.alloc(0),
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(chunk) {
      if (chunk === undefined || chunk === null) {
        this.body = Buffer.alloc(0);
        return;
      }

      this.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    },
  };
}

async function withNodeEnv(value, callback) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
}

process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';

assert.equal(isProxyableSupabasePath('/rest/v1/students'), true);
assert.equal(isProxyableSupabasePath('/rpc/approve_grade'), true);
assert.equal(isProxyableSupabasePath('/storage/v1/object/project-wg-files/foo.png'), true);
assert.equal(isProxyableSupabasePath('/auth/v1/token?grant_type=password'), true);
assert.equal(isProxyableSupabasePath('/favicon.ico'), false);
assert.equal(
  buildSupabaseProxyPath('/rest/v1/students', '?select=*'),
  '/api/security/supabase/rest/v1/students?select=*'
);
assert.equal(buildSupabaseProxyPathname(['rest', 'v1', 'students']), '/rest/v1/students');
assert.equal(getProxyTargetUrl('/rest/v1/students', '?select=*'), 'https://example.supabase.co/rest/v1/students?select=*');

const headers = collectForwardHeaders(
  {
    headers: {
      authorization: 'Bearer test-token',
      apikey: 'anon-key',
      'accept-encoding': 'gzip, deflate, br',
      prefer: 'count=exact',
      'content-type': 'application/json',
      'x-client-info': 'supabase-js/2.0',
    },
  },
  {
    tenantId: 'tenant-123',
    user: { id: 'user-123', email: 'aluno@example.com' },
    profile: { full_name: 'Aluno Teste', profile_type: 'aluno', tenant_id: 'tenant-123' },
  }
);

assert.equal(headers.get('authorization'), 'Bearer test-token');
assert.equal(headers.get('x-tenant-id'), 'tenant-123');
assert.equal(headers.get('x-audit-actor-email'), 'aluno@example.com');
assert.equal(headers.get('accept-encoding'), null);

{
  const req = createMockRequest({
    method: 'POST',
    url: '/api/security/supabase/rest/v1/students?select=*',
    headers: {
      authorization: 'Bearer user-token',
      apikey: 'anon-key',
      prefer: 'return=representation',
      'content-type': 'application/json',
      'x-client-info': 'supabase-js/2.0',
    },
    body: JSON.stringify({ full_name: 'Maria' }),
  });
  const res = createMockResponse();
  const requests = [];

  await handleSupabaseProxyRequest(req, res, {
    pathParts: ['rest', 'v1', 'students'],
    resolveRequester: async () => ({
      tenantId: 'tenant-123',
      user: { id: 'user-123', email: 'aluno@example.com' },
      profile: { full_name: 'Aluno Teste', profile_type: 'aluno', tenant_id: 'tenant-123' },
    }),
    securityCheck: async (args) => {
      requests.push(args);
      return null;
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'gzip',
          'content-length': '999',
          'x-test': '1',
        },
      });
    },
  });

  const forwarded = requests.find((entry) => entry.url);
  assert.equal(forwarded.url, 'https://example.supabase.co/rest/v1/students?select=*');
  assert.equal(forwarded.options.method, 'POST');
  assert.equal(forwarded.options.headers.get('authorization'), 'Bearer user-token');
  assert.equal(forwarded.options.headers.get('x-tenant-id'), 'tenant-123');
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-test'], '1');
  assert.equal(res.headers['content-encoding'], undefined);
  assert.equal(res.headers['content-length'], undefined);
  assert.equal(res.body.toString('utf8'), '{"ok":true}');
}

for (const nodeEnv of ['development', 'production']) {
  await withNodeEnv(nodeEnv, async () => {
    const req = createMockRequest({
      method: 'POST',
      url: '/api/security/supabase/rest/v1/students',
      headers: {
        authorization: 'Bearer user-token',
        apikey: 'anon-key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ full_name: 'Maria' }),
    });
    const res = createMockResponse();
    let fetchCalls = 0;

    await handleSupabaseProxyRequest(req, res, {
      pathParts: ['rest', 'v1', 'students'],
      resolveRequester: async () => null,
      securityCheck: async () => {
        const error = new Error('Limite de requisicoes excedido.');
        error.statusCode = 429;
        error.code = 'REQUEST_RATE_LIMITED';
        error.traceId = 'trace-rate-limit';
        throw error;
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('fetch should not be called when blocked');
      },
    });

    const payload = JSON.parse(res.body.toString('utf8'));
    assert.equal(fetchCalls, 0);
    assert.equal(res.statusCode, 429);
    assert.equal(payload.code, 'REQUEST_RATE_LIMITED');
  });
}

await withNodeEnv('development', async () => {
  const req = createMockRequest({
    method: 'GET',
    url: '/api/security/supabase/rest/v1/app_settings?select=*&id=eq.system&limit=1',
    headers: {
      authorization: 'Bearer user-token',
      apikey: 'anon-key',
    },
  });
  const res = createMockResponse();
  let fetchCalls = 0;

  await handleSupabaseProxyRequest(req, res, {
    pathParts: ['rest', 'v1', 'app_settings'],
    resolveRequester: async () => null,
    securityCheck: async () => {
      const error = new Error('Falha ao validar controles de requisicao.');
      error.statusCode = 500;
      error.code = 'REQUEST_SECURITY_CHECK_FAILED';
      error.traceId = 'trace-security-dev';
      throw error;
    },
    fetchImpl: async (url, options) => {
      fetchCalls += 1;
      assert.equal(url, 'https://example.supabase.co/rest/v1/app_settings?select=*&id=eq.system&limit=1');
      assert.equal(options.method, 'GET');
      return new Response(JSON.stringify([{ id: 'system' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(fetchCalls, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body.toString('utf8')), [{ id: 'system' }]);
});

await withNodeEnv('production', async () => {
  const req = createMockRequest({
    method: 'GET',
    url: '/api/security/supabase/rest/v1/app_settings?select=*&id=eq.system&limit=1',
    headers: {
      authorization: 'Bearer user-token',
      apikey: 'anon-key',
    },
  });
  const res = createMockResponse();
  let fetchCalls = 0;

  await handleSupabaseProxyRequest(req, res, {
    pathParts: ['rest', 'v1', 'app_settings'],
    resolveRequester: async () => null,
    securityCheck: async () => {
      const error = new Error('Falha ao validar controles de requisicao.');
      error.statusCode = 500;
      error.code = 'REQUEST_SECURITY_CHECK_FAILED';
      error.traceId = 'trace-security-prod';
      throw error;
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('fetch should not be called when request security fails in production');
    },
  });

  const payload = JSON.parse(res.body.toString('utf8'));
  assert.equal(fetchCalls, 0);
  assert.equal(res.statusCode, 500);
  assert.equal(payload.code, 'REQUEST_SECURITY_CHECK_FAILED');
});

await withNodeEnv('production', async () => {
  const req = createMockRequest({
    method: 'GET',
    url: '/api/security/supabase/rest/v1/app_settings?select=*&id=eq.system&limit=1',
    headers: {
      authorization: 'Bearer user-token',
      apikey: 'anon-key',
      host: '127.0.0.1:5173',
      origin: 'http://127.0.0.1:5173',
    },
  });
  const res = createMockResponse();
  let fetchCalls = 0;

  req.socket = { remoteAddress: '127.0.0.1' };

  await handleSupabaseProxyRequest(req, res, {
    pathParts: ['rest', 'v1', 'app_settings'],
    resolveRequester: async () => null,
    securityCheck: async () => {
      const error = new Error('Falha ao validar controles de requisicao.');
      error.statusCode = 500;
      error.code = 'REQUEST_SECURITY_CHECK_FAILED';
      error.traceId = 'trace-security-localhost';
      throw error;
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify([{ id: 'system' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(fetchCalls, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body.toString('utf8')), [{ id: 'system' }]);
});

{
  const req = createMockRequest({
    method: 'POST',
    url: '/api/security/supabase/auth/v1/token?grant_type=password',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'aluno@example.com',
      password: 'senha-forte',
    }),
  });
  const res = createMockResponse();

  await handleSupabaseProxyRequest(req, res, {
    pathParts: ['auth', 'v1', 'token'],
    resolveRequester: async () => null,
    securityCheck: async () => null,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://example.supabase.co/auth/v1/token?grant_type=password');
      assert.equal(options.headers.get('content-type'), 'application/json');
      return new Response(JSON.stringify({ access_token: 'token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body.toString('utf8')).access_token, 'token');
}

{
  const req = createMockRequest({
    method: 'POST',
    url: '/api/security/supabase/auth/v1/token?grant_type=password',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'aluno@example.com',
      password: 'senha-forte',
    }),
  });
  const res = createMockResponse();
  let securityCheckCalls = 0;

  await handleSupabaseProxyRequest(req, res, {
    pathParts: ['auth', 'v1', 'token'],
    resolveRequester: async () => null,
    securityCheck: async () => {
      securityCheckCalls += 1;
      throw new Error('securityCheck should not be called for public auth routes');
    },
    fetchImpl: async () => {
      return new Response(JSON.stringify({ access_token: 'fallback-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(securityCheckCalls, 0);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body.toString('utf8')).access_token, 'fallback-token');
}

console.log('security proxy smoke tests passed');
