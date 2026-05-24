// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
/**
 * src/lib/validators.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilitários centralizados de validação e formatação para todo o sistema.
 * Importar de qualquer página com:
 *   import { formatCPF, validateCPF, formatPhone, ... } from '@/lib/validators';
 */

// ═══════════════════════════════════════════════════════════════
// CPF — 000.000.000-00
// ═══════════════════════════════════════════════════════════════
/**
 * Aplica máscara automática ao CPF enquanto o usuário digita.
 * Aceita qualquer entrada e retorna no formato 000.000.000-00.
 */
export function formatCPF(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Valida CPF com dígitos verificadores.
 * Rejeita sequências repetidas (ex: 111.111.111-11).
 */
export function validateCPF(cpf) {
  const c = String(cpf).replace(/\D/g, '');
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(c[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === parseInt(c[10]);
}

/** Remove máscara do CPF → retorna apenas 11 dígitos */
export function cleanCPF(cpf) {
  return String(cpf).replace(/\D/g, '');
}

// ═══════════════════════════════════════════════════════════════
// TELEFONE — (00) 00000-0000 / (00) 0000-0000
// ═══════════════════════════════════════════════════════════════
/**
 * Aplica máscara ao telefone.
 * ≤ 10 dígitos → fixo:   (XX) XXXX-XXXX
 * = 11 dígitos → celular: (XX) XXXXX-XXXX
 */
export function formatPhone(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

/**
 * Valida telefone brasileiro.
 * Aceita fixo (XX) XXXX-XXXX e celular (XX) XXXXX-XXXX.
 */
export function validatePhone(phone) {
  return /^\(\d{2}\) \d{4,5}-\d{4}$/.test(String(phone));
}

/** Remove máscara do telefone */
export function cleanPhone(phone) {
  return String(phone).replace(/\D/g, '');
}

// ═══════════════════════════════════════════════════════════════
// EMAIL
// ═══════════════════════════════════════════════════════════════
/**
 * Normaliza email: lowercase + trim.
 */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Valida formato de email genérico.
 */
export function validateEmail(email) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(email).trim());
}

/**
 * Valida apenas emails @gmail.com (para alunos).
 */
export function validateGmail(email) {
  return /^[a-zA-Z0-9._%+\-]+@gmail\.com$/.test(String(email).trim());
}

// ═══════════════════════════════════════════════════════════════
// NOME
// ═══════════════════════════════════════════════════════════════
/**
 * Capitaliza cada palavra do nome.
 * "MARIA da silva" → "Maria da Silva"
 * Preposições (de, da, do, dos, das, e) permanecem minúsculas.
 */
export function formatName(value) {
  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'para', 'com']);
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && prepositions.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Valida nome: mínimo 3 caracteres, pelo menos 2 palavras.
 */
export function validateName(name) {
  const trimmed = String(name).trim();
  return trimmed.length >= 3 && trimmed.split(/\s+/).filter(Boolean).length >= 2;
}

// ═══════════════════════════════════════════════════════════════
// SENHA
// ═══════════════════════════════════════════════════════════════
/**
 * Valida força da senha.
 * Retorna { valid, errors[] }
 */
export function validatePassword(password) {
  const errors = [];
  if (password.length < 8)            errors.push('Mínimo de 8 caracteres');
  if (!/[A-Z]/.test(password))        errors.push('Pelo menos uma letra maiúscula');
  if (!/[a-z]/.test(password))        errors.push('Pelo menos uma letra minúscula');
  if (!/\d/.test(password))           errors.push('Pelo menos um número');
  if (!/[@#$!%&*\-_+?]/.test(password)) errors.push('Pelo menos um caractere especial (@#$!%&*)');
  return { valid: errors.length === 0, errors };
}

/**
 * Retorna o nível de força da senha.
 * Retorna: 'fraca' | 'media' | 'forte'
 */
export function passwordStrength(password) {
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[@#$!%&*\-_+?]/.test(password),
  ].filter(Boolean).length;

  if (score <= 2) return 'fraca';
  if (score <= 4) return 'media';
  return 'forte';
}

// ═══════════════════════════════════════════════════════════════
// DATAS
// ═══════════════════════════════════════════════════════════════
/**
 * Aplica máscara DD/MM/AAAA enquanto o usuário digita.
 */
export function formatDateInput(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 8);
  return digits
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2');
}

/**
 * Valida data no formato DD/MM/AAAA.
 * Verifica se a data realmente existe (ex: 30/02 é inválida).
 */
export function validateDate(dateStr) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(dateStr))) return false;
  const [d, m, y] = String(dateStr).split('/').map(Number);
  if (y < 1900 || y > new Date().getFullYear() + 1) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** DD/MM/AAAA → AAAA-MM-DD (para salvar no banco) */
export function toISODate(dateStr) {
  const [d, m, y] = String(dateStr).split('/');
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

/** AAAA-MM-DD → DD/MM/AAAA (para exibir ao usuário) */
export function fromISODate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = String(isoDate).split('-');
  return `${d}/${m}/${y}`;
}

// ═══════════════════════════════════════════════════════════════
// CEP — 00000-000
// ═══════════════════════════════════════════════════════════════
export function formatCEP(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, '$1-$2');
}

export function validateCEP(cep) {
  return /^\d{5}-\d{3}$/.test(String(cep));
}

// ═══════════════════════════════════════════════════════════════
// NÚMERO DE REGISTRO / RA
// ═══════════════════════════════════════════════════════════════
export function generateRA() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${year}${random}`;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS GERAIS
// ═══════════════════════════════════════════════════════════════
/**
 * Sanitiza string: remove tags HTML e caracteres perigosos.
 */
export function sanitize(value) {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    .trim();
}

/**
 * Constantes úteis
 */
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
