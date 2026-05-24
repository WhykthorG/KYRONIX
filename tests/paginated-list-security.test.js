import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertSafeIdentifier,
  isSafeIdentifier,
  normalizeSafeIdentifierList,
  uniqueSafeIdentifiers,
} from '../shared/src/contracts/dbIdentifiers.js';
import {
  dedupeRecordsById,
  sortRecordsByColumn,
} from '../frontend/src/components/examples/paginatedListSecurity.js';

test('identifier helpers only accept simple database identifiers', () => {
  assert.equal(isSafeIdentifier('students'), true);
  assert.equal(isSafeIdentifier('created_at'), true);
  assert.equal(isSafeIdentifier('students.email'), false);
  assert.equal(isSafeIdentifier('students;drop table'), false);

  assert.equal(assertSafeIdentifier('full_name', 'Campo'), 'full_name');
  assert.throws(() => assertSafeIdentifier('full_name desc', 'Campo'));
  assert.equal(normalizeSafeIdentifierList('id, created_at', 'Lista'), 'id,created_at');
  assert.throws(() => normalizeSafeIdentifierList('id;drop table', 'Lista'));
});

test('uniqueSafeIdentifiers filters invalid and duplicated values', () => {
  assert.deepEqual(
    uniqueSafeIdentifiers(['name', 'email', 'email', 'students.email', 'created_at']),
    ['name', 'email', 'created_at']
  );
});

test('dedupeRecordsById and sortRecordsByColumn preserve a stable safe result set', () => {
  const merged = dedupeRecordsById([
    { id: 'b', name: 'Bruna', created_at: '2026-05-02T10:00:00Z' },
    { id: 'a', name: 'Ana', created_at: '2026-05-03T10:00:00Z' },
    { id: 'b', name: 'Bruna duplicada', created_at: '2026-05-01T10:00:00Z' },
  ]);

  assert.deepEqual(
    sortRecordsByColumn(merged, 'name', true).map((row) => row.id),
    ['a', 'b']
  );

  assert.deepEqual(
    sortRecordsByColumn(merged, 'created_at', false).map((row) => row.id),
    ['a', 'b']
  );
});
