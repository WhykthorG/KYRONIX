import test from 'node:test';
import assert from 'node:assert/strict';

import { completeFirstAccess } from '../shared/src/contracts/auth.js';

const validPassword = () => ({ valid: true, errors: [] });

test('completeFirstAccess updates password before clearing first-login flag', async () => {
  const calls = [];

  const result = await completeFirstAccess({
    newPassword: 'SenhaForte1@',
    confirmPassword: 'SenhaForte1@',
    validatePassword: validPassword,
    updatePassword: async (password) => {
      calls.push(['updatePassword', password]);
    },
    clearFirstLoginFlag: async () => {
      calls.push(['clearFirstLoginFlag']);
    },
  });

  assert.deepEqual(calls, [
    ['updatePassword', 'SenhaForte1@'],
    ['clearFirstLoginFlag'],
  ]);
  assert.equal(result.passwordUpdated, true);
  assert.equal(result.firstAccessCleared, true);
});

test('completeFirstAccess retries only the profile flag when password is already updated', async () => {
  const calls = [];

  await completeFirstAccess({
    newPassword: 'SenhaForte1@',
    confirmPassword: 'SenhaForte1@',
    validatePassword: validPassword,
    passwordAlreadyUpdated: true,
    updatePassword: async () => {
      calls.push(['updatePassword']);
    },
    clearFirstLoginFlag: async () => {
      calls.push(['clearFirstLoginFlag']);
    },
  });

  assert.deepEqual(calls, [['clearFirstLoginFlag']]);
});

test('completeFirstAccess blocks completion when password confirmation fails', async () => {
  const calls = [];

  await assert.rejects(
    completeFirstAccess({
      newPassword: 'SenhaForte1@',
      confirmPassword: 'OutraSenha1@',
      validatePassword: validPassword,
      updatePassword: async () => {
        calls.push(['updatePassword']);
      },
      clearFirstLoginFlag: async () => {
        calls.push(['clearFirstLoginFlag']);
      },
    }),
    /As senhas nao coincidem|As senhas não coincidem/,
  );

  assert.deepEqual(calls, []);
});
