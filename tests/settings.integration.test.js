import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSystemSettingsRecord,
  DEFAULT_SYSTEM_SETTINGS,
  isSettingsTableUnavailable,
  mapSystemSettingsRecord,
  normalizeSystemSettings,
  readSystemSettingsFromStorage,
  writeSystemSettingsToStorage,
} from '../shared/src/contracts/settings.js';

function createMemoryStorage() {
  const data = new Map();

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

test('system settings map cleanly between UI and database record formats', () => {
  const normalized = normalizeSystemSettings({
    schoolName: 'Escola Modelo',
    schoolEmail: 'contato@modelo.com',
    notifyDocumentPending: false,
    notifyMessagePosted: false,
    notifyAccessReset: false,
    notifyPaymentDue: false,
    primaryColor: '#10b981',
  });

  const record = buildSystemSettingsRecord(normalized);
  const mappedBack = mapSystemSettingsRecord(record);

  assert.equal(record.id, 'system');
  assert.equal(record.school_name, 'Escola Modelo');
  assert.equal(record.notify_document_pending, false);
  assert.equal(record.notify_message_posted, false);
  assert.equal(record.notify_access_reset, false);
  assert.equal(record.notify_payment_due, false);
  assert.equal(mappedBack.schoolName, 'Escola Modelo');
  assert.equal(mappedBack.primaryColor, '#10b981');
  assert.equal(mappedBack.notifyDocumentPending, false);
  assert.equal(mappedBack.notifyMessagePosted, false);
  assert.equal(mappedBack.notifyAccessReset, false);
  assert.equal(mappedBack.notifyPaymentDue, false);
});

test('system settings storage helpers persist normalized settings', () => {
  const storage = createMemoryStorage();

  writeSystemSettingsToStorage({
    schoolName: '  Escola Nova  ',
    schoolPhone: '',
    requireGuardianApproval: true,
  }, storage);

  const persisted = readSystemSettingsFromStorage(storage);

  assert.equal(persisted.schoolName, 'Escola Nova');
  assert.equal(persisted.schoolPhone, DEFAULT_SYSTEM_SETTINGS.schoolPhone);
  assert.equal(persisted.requireGuardianApproval, true);
});

test('isSettingsTableUnavailable recognizes schema-missing errors', () => {
  assert.equal(isSettingsTableUnavailable({ code: '42P01' }), true);
  assert.equal(isSettingsTableUnavailable({ code: 'PGRST205' }), true);
  assert.equal(isSettingsTableUnavailable({ code: 'PGRST116' }), false);
});
