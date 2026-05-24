import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIT_ACTIONS,
  AUDIT_EVENT_TYPES,
  buildStorageUploadAuditMetadata,
  buildAuditEventLogEntry,
  getAuditActorFromRequester,
  resolveClientAuditEventRequest,
  resolveAuditEventDefinition,
} from '../shared/src/auditLog.js';

test('manual audit event definitions map login, upload and enrollment transaction to create actions', () => {
  const loginDefinition = resolveAuditEventDefinition(AUDIT_EVENT_TYPES.AUTH_LOGIN);
  const uploadDefinition = resolveAuditEventDefinition(AUDIT_EVENT_TYPES.STORAGE_UPLOAD);
  const enrollmentDefinition = resolveAuditEventDefinition(AUDIT_EVENT_TYPES.ENROLLMENT_TRANSACTION);

  assert.equal(loginDefinition.entityTable, 'auth_sessions');
  assert.equal(loginDefinition.action, AUDIT_ACTIONS.CREATE);
  assert.deepEqual(loginDefinition.metadata, { operation: 'login' });
  assert.equal(loginDefinition.clientWritable, true);
  assert.equal(loginDefinition.requiresProfile, false);

  assert.equal(uploadDefinition.entityTable, 'storage_uploads');
  assert.equal(uploadDefinition.action, AUDIT_ACTIONS.CREATE);
  assert.deepEqual(uploadDefinition.metadata, { operation: 'upload' });
  assert.equal(uploadDefinition.clientWritable, true);
  assert.equal(uploadDefinition.requiresProfile, true);

  assert.equal(enrollmentDefinition.entityTable, 'enrollment_transactions');
  assert.equal(enrollmentDefinition.action, AUDIT_ACTIONS.CREATE);
  assert.deepEqual(enrollmentDefinition.metadata, { operation: 'transaction' });
  assert.equal(enrollmentDefinition.clientWritable, false);
  assert.equal(enrollmentDefinition.requiresProfile, true);
});

test('buildAuditEventLogEntry reuses event definitions and sanitizes sensitive metadata', () => {
  const entry = buildAuditEventLogEntry({
    eventType: AUDIT_EVENT_TYPES.AUTH_LOGIN,
    recordId: 'user-1',
    actor: {
      actor_user_id: '8f7de711-f64b-40e6-98b2-29fd2f86f8f2',
      actor_email: 'admin@escola.com',
      actor_name: 'Administrador',
      actor_profile_type: 'administrador',
      actor_tenant_id: '11111111-1111-1111-1111-111111111111',
    },
    newRecord: {
      id: 'user-1',
      token: 'should-hide',
    },
    metadata: {
      provider: 'password',
      access_token: 'hide-me',
    },
  });

  assert.equal(entry.entity_table, 'auth_sessions');
  assert.equal(entry.tenant_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(entry.action, AUDIT_ACTIONS.CREATE);
  assert.equal(entry.record_id, 'user-1');
  assert.deepEqual(entry.new_record, {
    id: 'user-1',
    token: '[redacted]',
  });
  assert.deepEqual(entry.metadata, {
    operation: 'login',
    event_type: AUDIT_EVENT_TYPES.AUTH_LOGIN,
    provider: 'password',
    access_token: '[redacted]',
  });
});

test('resolveClientAuditEventRequest derives login actor context server-side', () => {
  const result = resolveClientAuditEventRequest({
    eventType: AUDIT_EVENT_TYPES.AUTH_LOGIN,
    requester: {
      user: {
        id: 'user-123',
        email: 'professor@escola.com',
      },
      profile: null,
    },
    metadata: {
      provider: 'password',
      source: 'spoofed-client-source',
      email: 'outro@escola.com',
    },
  });

  assert.equal(result.definition.entityTable, 'auth_sessions');
  assert.equal(result.recordId, 'user-123');
  assert.deepEqual(result.metadata, {
    provider: 'password',
    source: 'AuthContext.signIn',
  });
});

test('resolveClientAuditEventRequest requires profile and canonical path for storage uploads', () => {
  assert.throws(() => resolveClientAuditEventRequest({
    eventType: AUDIT_EVENT_TYPES.STORAGE_UPLOAD,
    requester: {
      user: {
        id: 'user-123',
        email: 'professor@escola.com',
      },
      profile: null,
    },
    metadata: {
      path: 'assignments/file.pdf',
    },
  }), (error) => {
    assert.equal(error.code, 'AUDIT_EVENT_PROFILE_REQUIRED');
    assert.equal(error.statusCode, 403);
    return true;
  });

  const result = resolveClientAuditEventRequest({
    eventType: AUDIT_EVENT_TYPES.STORAGE_UPLOAD,
    requester: {
      user: {
        id: 'user-123',
        email: 'professor@escola.com',
      },
      profile: {
        profile_type: 'professor',
      },
    },
    metadata: {
      bucket: 'project-wg-files',
      folder: 'assignments',
      path: 'assignments/file.pdf',
      file_name: 'prova.pdf',
      size_bytes: '1024',
      source: 'spoofed-client-source',
    },
  });

  assert.equal(result.recordId, 'assignments/file.pdf');
  assert.deepEqual(result.metadata, {
    bucket: 'project-wg-files',
    folder: 'assignments',
    path: 'assignments/file.pdf',
    file_name: 'prova.pdf',
    size_bytes: 1024,
    source: 'storageFiles.uploadStorageFile',
  });
});

test('buildStorageUploadAuditMetadata normalizes audit payload for successful uploads', () => {
  assert.deepEqual(
    buildStorageUploadAuditMetadata({
      bucket: 'project-wg-files',
      folder: 'attachments',
      path: 'attachments/doc.pdf',
      fileName: 'documento.pdf',
      contentType: 'application/pdf',
      sizeBytes: '2048',
      source: 'storageFiles.uploadStorageFile',
    }),
    {
      bucket: 'project-wg-files',
      folder: 'attachments',
      path: 'attachments/doc.pdf',
      file_name: 'documento.pdf',
      content_type: 'application/pdf',
      size_bytes: 2048,
      source: 'storageFiles.uploadStorageFile',
    }
  );
});

test('resolveClientAuditEventRequest blocks audit events that must stay server-side', () => {
  assert.throws(() => resolveClientAuditEventRequest({
    eventType: AUDIT_EVENT_TYPES.ENROLLMENT_TRANSACTION,
    requester: {
      user: {
        id: 'admin-1',
        email: 'admin@escola.com',
      },
      profile: {
        profile_type: 'administrador',
      },
    },
    metadata: {},
  }), (error) => {
    assert.equal(error.code, 'AUDIT_EVENT_CLIENT_FORBIDDEN');
    assert.equal(error.statusCode, 403);
    return true;
  });
});

test('audit actor carries the verified tenant context for service-side writes', () => {
  const actor = getAuditActorFromRequester({
    tenantId: '11111111-1111-1111-1111-111111111111',
    user: {
      id: 'admin-1',
      email: 'admin@escola.com',
    },
    profile: {
      full_name: 'Administrador',
      profile_type: 'administrador',
    },
  });

  assert.equal(actor.actor_email, 'admin@escola.com');
  assert.equal(actor.actor_tenant_id, '11111111-1111-1111-1111-111111111111');
});
