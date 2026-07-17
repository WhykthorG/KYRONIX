// Contratos do módulo de Certificados — EduGest
// Whykthor GSV

// ── Tipos de certificado ──────────────────────────────────────
export const CERTIFICATE_TYPES = Object.freeze({
  COMPLETION: 'conclusao',
  DECLARATION: 'declaracao',
  HISTORY: 'historico',
  MODULE: 'modulo',
  COURSE: 'curso',
});

export const VALID_CERTIFICATE_TYPES = Object.values(CERTIFICATE_TYPES);

// ── Status ────────────────────────────────────────────────────
export const CERTIFICATE_STATUSES = Object.freeze({
  ISSUED: 'emitido',
  CANCELLED: 'cancelado',
  EXPIRED: 'expirado',
});

export const VALID_CERTIFICATE_STATUSES = Object.values(CERTIFICATE_STATUSES);

// ── Labels ────────────────────────────────────────────────────
export const CERTIFICATE_TYPE_LABELS = Object.freeze({
  [CERTIFICATE_TYPES.COMPLETION]: 'Certificado de Conclusão',
  [CERTIFICATE_TYPES.DECLARATION]: 'Declaração',
  [CERTIFICATE_TYPES.HISTORY]: 'Histórico Escolar',
  [CERTIFICATE_TYPES.MODULE]: 'Certificado por Módulo',
  [CERTIFICATE_TYPES.COURSE]: 'Certificado de Curso',
});

export const CERTIFICATE_STATUS_LABELS = Object.freeze({
  [CERTIFICATE_STATUSES.ISSUED]: 'Emitido',
  [CERTIFICATE_STATUSES.CANCELLED]: 'Cancelado',
  [CERTIFICATE_STATUSES.EXPIRED]: 'Expirado',
});

// ── Normalizers ───────────────────────────────────────────────
function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEnum(value, validValues) {
  const normalized = normalizeString(value).toLowerCase();
  return validValues.includes(normalized) ? normalized : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const str = normalizeString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  try {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// ── Certificate normalizer ────────────────────────────────────
export function normalizeCertificatePayload(data = {}) {
  return {
    student_id: normalizeString(data.student_id),
    type: normalizeEnum(data.type, VALID_CERTIFICATE_TYPES) || CERTIFICATE_TYPES.DECLARATION,
    title: normalizeString(data.title),
    description: normalizeString(data.description) || null,
    issue_date: normalizeDate(data.issue_date) || new Date().toISOString().slice(0, 10),
    valid_until: normalizeDate(data.valid_until) || null,
    series_number: normalizeString(data.series_number) || null,
    status: normalizeEnum(data.status, VALID_CERTIFICATE_STATUSES) || CERTIFICATE_STATUSES.ISSUED,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
  };
}

// ── Builders ──────────────────────────────────────────────────
export function buildCertificateMutationInput(data = {}) {
  const normalized = normalizeCertificatePayload(data);
  if (!normalized.student_id) throw new Error('student_id é obrigatório.');
  if (!normalized.title) throw new Error('title é obrigatório.');
  return normalized;
}

// ── Helpers ───────────────────────────────────────────────────
export function getCertificateTypeLabel(type) {
  return CERTIFICATE_TYPE_LABELS[type] || type;
}

export function getCertificateStatusLabel(status) {
  return CERTIFICATE_STATUS_LABELS[status] || status;
}

export function generateSeriesNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${year}/${random}`;
}
