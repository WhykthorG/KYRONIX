// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
const SAFE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_IDENTIFIER_LIST_RE = /^[A-Za-z_][A-Za-z0-9_]*(\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*$/;

export function isSafeIdentifier(value) {
  return typeof value === 'string' && SAFE_IDENTIFIER_RE.test(value);
}

export function assertSafeIdentifier(value, label = 'Identificador') {
  if (!isSafeIdentifier(value)) {
    throw new Error(`${label} inválido: use apenas identificadores simples do banco.`);
  }

  return value;
}

export function normalizeSafeIdentifierList(value, label = 'Lista de identificadores') {
  if (typeof value !== 'string') {
    throw new Error(`${label} inválida: use uma lista separada por vírgulas.`);
  }

  const trimmed = value.trim();
  if (!trimmed || !SAFE_IDENTIFIER_LIST_RE.test(trimmed)) {
    throw new Error(`${label} inválida: use apenas identificadores simples separados por vírgulas.`);
  }

  const seen = new Set();
  const identifiers = [];

  for (const part of trimmed.split(',')) {
    const identifier = part.trim();
    if (!identifier || seen.has(identifier)) {
      continue;
    }

    assertSafeIdentifier(identifier, label);
    seen.add(identifier);
    identifiers.push(identifier);
  }

  if (!identifiers.length) {
    throw new Error(`${label} inválida: nenhum identificador válido foi informado.`);
  }

  return identifiers.join(',');
}

export function uniqueSafeIdentifiers(values = []) {
  const seen = new Set();
  const safeValues = [];

  for (const value of values) {
    if (!isSafeIdentifier(value) || seen.has(value)) {
      continue;
    }

    seen.add(value);
    safeValues.push(value);
  }

  return safeValues;
}
