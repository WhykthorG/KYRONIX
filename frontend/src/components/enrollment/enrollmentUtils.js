// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
// Re-exports de @/lib/validators para compatibilidade com imports existentes
export {
  validateCPF,
  formatCPF,
  formatPhone,
  validatePhone,
  formatCEP,
  validateCEP,
  validateDate,
  formatDateInput,
  toISODate,
  generateRA,
  BRAZIL_STATES,
  ENTRY_PERIODS,
  validateEmail,
} from '@/lib/validators';

// Mantido por compatibilidade: o fluxo de matrícula agora aceita qualquer e-mail válido.
export function validateGmail(email) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(email).trim());
}
