// Contratos de Assinatura Eletrônica — EduGest
// Whykthor GSV

// ── Status de assinatura ──────────────────────────────────────
export const SIGNATURE_STATUSES = Object.freeze({
  PENDING: 'pendente',
  SIGNED: 'assinado',
  REJECTED: 'rejeitado',
  EXPIRED: 'expirado',
});

export const VALID_SIGNATURE_STATUSES = Object.values(SIGNATURE_STATUSES);

// ── Labels ────────────────────────────────────────────────────
export const SIGNATURE_STATUS_LABELS = Object.freeze({
  [SIGNATURE_STATUSES.PENDING]: 'Pendente',
  [SIGNATURE_STATUSES.SIGNED]: 'Assinado',
  [SIGNATURE_STATUSES.REJECTED]: 'Rejeitado',
  [SIGNATURE_STATUSES.EXPIRED]: 'Expirado',
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

// ── Signature normalizer ──────────────────────────────────────
export function normalizeSignaturePayload(data = {}) {
  return {
    document_type: normalizeString(data.document_type),
    document_id: normalizeString(data.document_id),
    signer_id: normalizeString(data.signer_id),
    signer_name: normalizeString(data.signer_name),
    signer_role: normalizeString(data.signer_role) || null,
    status: normalizeEnum(data.status, VALID_SIGNATURE_STATUSES) || SIGNATURE_STATUSES.PENDING,
    signed_at: data.signed_at || null,
    expires_at: normalizeDate(data.expires_at) || null,
    notes: normalizeString(data.notes) || null,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
  };
}

// ── Builders ──────────────────────────────────────────────────
export function buildSignatureMutationInput(data = {}) {
  const normalized = normalizeSignaturePayload(data);
  if (!normalized.document_type) throw new Error('document_type é obrigatório.');
  if (!normalized.document_id) throw new Error('document_id é obrigatório.');
  if (!normalized.signer_id) throw new Error('signer_id é obrigatório.');
  if (!normalized.signer_name) throw new Error('signer_name é obrigatório.');
  return normalized;
}

// ── Helpers ───────────────────────────────────────────────────
export function getSignatureStatusLabel(status) {
  return SIGNATURE_STATUS_LABELS[status] || status;
}

export function isSignatureExpired(signature) {
  if (!signature.expires_at) return false;
  return new Date(signature.expires_at) < new Date();
}

export function generateSignatureHash(signatureData) {
  const dataString = JSON.stringify({
    document_type: signatureData.document_type,
    document_id: signatureData.document_id,
    signer_id: signatureData.signer_id,
    signed_at: signatureData.signed_at,
  });
  
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  
  return `SIG-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}-${Date.now().toString(36).toUpperCase()}`;
}
