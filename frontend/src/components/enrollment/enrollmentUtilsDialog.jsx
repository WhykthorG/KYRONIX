// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
// CPF validation (format + check digit)
export function validateCPF(cpf) {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(cleaned[10]);
}

// Format CPF as XXX.XXX.XXX-XX
export function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Format phone (XX) XXXXX-XXXX or (XX) XXXX-XXXX
export function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

// Validate phone: (XX) XXXX-XXXX or (XX) XXXXX-XXXX
export function validatePhone(phone) {
  return /^\(\d{2}\) \d{4,5}-\d{4}$/.test(phone);
}

// Format CEP XXXXX-XXX
export function formatCEP(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, '$1-$2');
}

// Validate CEP
export function validateCEP(cep) {
  return /^\d{5}-\d{3}$/.test(cep);
}

// Validate Gmail
export function validateGmail(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
}

// Validate date DD/MM/YYYY
export function validateDate(dateStr) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return false;
  const [d, m, y] = dateStr.split('/').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Format date input DD/MM/YYYY
export function formatDateInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2');
}

// Convert DD/MM/YYYY to ISO YYYY-MM-DD
export function toISODate(dateStr) {
  const [d, m, y] = dateStr.split('/');
  return `${y}-${m}-${d}`;
}

// Generate RA: year + 6 random digits
export function generateRA() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${year}${random}`;
}

export const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO'
];

export const ENTRY_PERIODS = (() => {
  const periods = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear + 1; y >= currentYear - 3; y--) {
    periods.push(`2º Semestre de ${y}`);
    periods.push(`1º Semestre de ${y}`);
  }
  return periods;
})();
