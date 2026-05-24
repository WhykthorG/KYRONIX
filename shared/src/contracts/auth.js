export const FIRST_ACCESS_STEPS = Object.freeze({
  PROMPT: 'prompt',
  FORM: 'form',
  DONE: 'done',
});

export function validateFirstAccessPassword({
  newPassword,
  confirmPassword,
  validatePassword,
}) {
  const { valid, errors } = validatePassword(newPassword);

  if (!valid) {
    throw new Error(errors[0] || 'Senha não atende aos requisitos mínimos.');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('As senhas não coincidem.');
  }
}

export async function completeFirstAccess({
  newPassword,
  confirmPassword,
  validatePassword,
  updatePassword,
  clearFirstLoginFlag,
  passwordAlreadyUpdated = false,
}) {
  validateFirstAccessPassword({
    newPassword,
    confirmPassword,
    validatePassword,
  });

  if (!passwordAlreadyUpdated) {
    await updatePassword(newPassword);
  }

  await clearFirstLoginFlag();

  return {
    passwordUpdated: true,
    firstAccessCleared: true,
  };
}
