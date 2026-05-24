import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRequestIp,
  hashRequestIp,
  resolveSecurityPolicy,
} from '../backend/src/middlewares/requestSecurity.js';
import {
  messageCreateSchema,
  notificationActionSchema,
  parseRequestSchema,
  systemExportQuerySchema,
} from '../backend/src/middlewares/requestSchemas.js';

test('getRequestIp prefers the forwarded client IP', () => {
  const ip = getRequestIp({
    headers: {
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
    },
  });

  assert.equal(ip, '203.0.113.10');
});

test('hashRequestIp is deterministic', () => {
  assert.equal(hashRequestIp('203.0.113.10'), hashRequestIp('203.0.113.10'));
});

test('resolveSecurityPolicy raises protection on critical routes', () => {
  const policy = resolveSecurityPolicy('critical');

  assert.equal(policy.limit, 8);
  assert.equal(policy.windowSeconds, 300);
  assert.equal(policy.blockSeconds, 3600);
});

test('messageCreateSchema validates and normalizes payloads', () => {
  const payload = parseRequestSchema(messageCreateSchema, {
    subject: '  Boletim da turma  ',
    content: '  Conteudo importante  ',
    recipient_type: 'turma',
    recipient_ids: [],
    priority: 'normal',
    category: 'comunicado',
    channels: ['app'],
  });

  assert.equal(payload.subject, 'Boletim da turma');
  assert.equal(payload.content, 'Conteudo importante');
});

test('messageCreateSchema rejects unexpected fields', () => {
  assert.throws(() => {
    parseRequestSchema(messageCreateSchema, {
      subject: 'Teste',
      content: 'Corpo',
      recipient_type: 'turma',
      extra: true,
    });
  }, /Payload|Requisicao invalida/);
});

test('notificationActionSchema only allows the expected action', () => {
  const payload = parseRequestSchema(notificationActionSchema, {
    action: 'mark_all_read',
  });

  assert.equal(payload.action, 'mark_all_read');
});

test('systemExportQuerySchema defaults to xlsx', () => {
  const payload = parseRequestSchema(systemExportQuerySchema, {});

  assert.equal(payload.format, 'xlsx');
});
