// Contratos do módulo de TCC/Projeto Integrador — KYRONIX S.E.N.O
// Whykthor GSV

// ── Status enums ──────────────────────────────────────────────
export const TCC_STATUSES = Object.freeze({
  PENDING: 'pendente',
  IN_PROGRESS: 'em_andamento',
  DELIVERED: 'entregue',
  UNDER_REVIEW: 'em_avaliacao',
  APPROVED: 'aprovado',
  REPROVED: 'reprovado',
  CANCELLED: 'cancelado',
});

export const VALID_TCC_STATUSES = Object.values(TCC_STATUSES);

export const TCC_PHASES = Object.freeze({
  SELECTION: 'selecao_tema',
  ORIENTATION: 'orientacao',
  RESEARCH: 'pesquisa',
  WRITING: 'redacao',
  REVIEW: 'revisao',
  FINAL: 'final',
});

export const VALID_TCC_PHASES = Object.values(TCC_PHASES);

export const DELIVERY_STATUSES = Object.freeze({
  PENDING: 'pendente',
  SUBMITTED: 'entregue',
  LATE: 'atrasada',
  ACCEPTED: 'aceita',
  REJECTED: 'rejeitada',
});

export const VALID_DELIVERY_STATUSES = Object.values(DELIVERY_STATUSES);

export const BANCA_STATUSES = Object.freeze({
  SCHEDULED: 'agendada',
  IN_PROGRESS: 'em_andamento',
  COMPLETED: 'realizada',
  CANCELLED: 'cancelada',
});

export const VALID_BANCA_STATUSES = Object.values(BANCA_STATUSES);

// ── Labels ────────────────────────────────────────────────────
export const TCC_STATUS_LABELS = Object.freeze({
  [TCC_STATUSES.PENDING]: 'Pendente',
  [TCC_STATUSES.IN_PROGRESS]: 'Em Andamento',
  [TCC_STATUSES.DELIVERED]: 'Entregue',
  [TCC_STATUSES.UNDER_REVIEW]: 'Em Avaliação',
  [TCC_STATUSES.APPROVED]: 'Aprovado',
  [TCC_STATUSES.REPROVED]: 'Reprovado',
  [TCC_STATUSES.CANCELLED]: 'Cancelado',
});

export const TCC_PHASE_LABELS = Object.freeze({
  [TCC_PHASES.SELECTION]: 'Seleção de Tema',
  [TCC_PHASES.ORIENTATION]: 'Orientação',
  [TCC_PHASES.RESEARCH]: 'Pesquisa',
  [TCC_PHASES.WRITING]: 'Redação',
  [TCC_PHASES.REVIEW]: 'Revisão',
  [TCC_PHASES.FINAL]: 'Final',
});

export const DELIVERY_STATUS_LABELS = Object.freeze({
  [DELIVERY_STATUSES.PENDING]: 'Pendente',
  [DELIVERY_STATUSES.SUBMITTED]: 'Entregue',
  [DELIVERY_STATUSES.LATE]: 'Atrasada',
  [DELIVERY_STATUSES.ACCEPTED]: 'Aceita',
  [DELIVERY_STATUSES.REJECTED]: 'Rejeitada',
});

export const BANCA_STATUS_LABELS = Object.freeze({
  [BANCA_STATUSES.SCHEDULED]: 'Agendada',
  [BANCA_STATUSES.IN_PROGRESS]: 'Em Andamento',
  [BANCA_STATUSES.COMPLETED]: 'Realizada',
  [BANCA_STATUSES.CANCELLED]: 'Cancelada',
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

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

// ── TCC normalizer ────────────────────────────────────────────
export function normalizeTccPayload(tcc = {}) {
  return {
    title: normalizeString(tcc.title),
    theme: normalizeString(tcc.theme) || null,
    description: normalizeString(tcc.description) || null,
    student_ids: Array.isArray(tcc.student_ids) ? tcc.student_ids : [],
    advisor_id: normalizeString(tcc.advisor_id) || null,
    co_advisor_id: normalizeString(tcc.co_advisor_id) || null,
    class_id: normalizeString(tcc.class_id) || null,
    subject_id: normalizeString(tcc.subject_id) || null,
    start_date: normalizeDate(tcc.start_date),
    expected_end_date: normalizeDate(tcc.expected_end_date),
    defense_date: normalizeDate(tcc.defense_date),
    status: normalizeEnum(tcc.status, VALID_TCC_STATUSES) || TCC_STATUSES.PENDING,
    phase: normalizeEnum(tcc.phase, VALID_TCC_PHASES) || TCC_PHASES.SELECTION,
    final_grade: tcc.final_grade != null ? normalizeNumber(tcc.final_grade, null) : null,
    advisor_notes: normalizeString(tcc.advisor_notes) || null,
    keywords: Array.isArray(tcc.keywords) ? tcc.keywords : [],
    objectives: normalizeString(tcc.objectives) || null,
    methodology: normalizeString(tcc.methodology) || null,
    results: normalizeString(tcc.results) || null,
    conclusion: normalizeString(tcc.conclusion) || null,
    attachment_urls: Array.isArray(tcc.attachment_urls) ? tcc.attachment_urls : [],
  };
}

// ── Delivery normalizer ───────────────────────────────────────
export function normalizeDeliveryPayload(delivery = {}) {
  return {
    tcc_id: normalizeString(delivery.tcc_id),
    title: normalizeString(delivery.title),
    description: normalizeString(delivery.description) || null,
    due_date: normalizeDate(delivery.due_date),
    status: normalizeEnum(delivery.status, VALID_DELIVERY_STATUSES) || DELIVERY_STATUSES.PENDING,
    grade: delivery.grade != null ? normalizeNumber(delivery.grade, null) : null,
    feedback: normalizeString(delivery.feedback) || null,
    attachment_urls: Array.isArray(delivery.attachment_urls) ? delivery.attachment_urls : [],
    submitted_at: normalizeDate(delivery.submitted_at),
  };
}

// ── Banca normalizer ──────────────────────────────────────────
export function normalizeBancaPayload(banca = {}) {
  return {
    tcc_id: normalizeString(banca.tcc_id),
    date: normalizeDate(banca.date),
    time: normalizeString(banca.time) || null,
    location: normalizeString(banca.location) || null,
    status: normalizeEnum(banca.status, VALID_BANCA_STATUSES) || BANCA_STATUSES.SCHEDULED,
    members: Array.isArray(banca.members) ? banca.members : [],
    notes: normalizeString(banca.notes) || null,
  };
}

// ── Builders ──────────────────────────────────────────────────
export function buildTccMutationInput(tcc = {}) {
  const normalized = normalizeTccPayload(tcc);

  if (!normalized.title) {
    throw new Error('title é obrigatório para criar um TCC.');
  }

  if (!normalized.student_ids || normalized.student_ids.length === 0) {
    throw new Error('Pelo menos um aluno é obrigatório para criar um TCC.');
  }

  return normalized;
}

export function buildDeliveryMutationInput(delivery = {}) {
  const normalized = normalizeDeliveryPayload(delivery);

  if (!normalized.tcc_id) {
    throw new Error('tcc_id é obrigatório para criar uma entrega.');
  }

  if (!normalized.title) {
    throw new Error('title é obrigatório para criar uma entrega.');
  }

  return normalized;
}

export function buildBancaMutationInput(banca = {}) {
  const normalized = normalizeBancaPayload(banca);

  if (!normalized.tcc_id) {
    throw new Error('tcc_id é obrigatório para criar uma banca.');
  }

  if (!normalized.date) {
    throw new Error('date é obrigatório para criar uma banca.');
  }

  return normalized;
}

// ── Helpers ───────────────────────────────────────────────────
export function getTccStatusLabel(status) {
  return TCC_STATUS_LABELS[status] || status;
}

export function getTccPhaseLabel(phase) {
  return TCC_PHASE_LABELS[phase] || phase;
}

export function getDeliveryStatusLabel(status) {
  return DELIVERY_STATUS_LABELS[status] || status;
}

export function getBancaStatusLabel(status) {
  return BANCA_STATUS_LABELS[status] || status;
}

export function canSubmitTcc(tcc, profileType) {
  if (!tcc || !profileType) return false;
  if (profileType === 'aluno') {
    return tcc.status === TCC_STATUSES.IN_PROGRESS;
  }
  return false;
}

export function canDefenseTcc(tcc, profileType) {
  if (!tcc || !profileType) return false;
  return ['administrador', 'coordenador', 'professor'].includes(profileType)
    && tcc.status === TCC_STATUSES.UNDER_REVIEW;
}

export function calculateTccProgress(tcc) {
  const phases = Object.values(TCC_PHASES);
  const currentIndex = phases.indexOf(tcc.phase);
  return Math.round(((currentIndex + 1) / phases.length) * 100);
}

export function getUpcomingDeadlines(tccs = []) {
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return tccs
    .filter((t) => t.expected_end_date && t.status === TCC_STATUSES.IN_PROGRESS)
    .filter((t) => {
      const endDate = new Date(t.expected_end_date);
      return endDate >= now && endDate <= twoWeeks;
    })
    .sort((a, b) => new Date(a.expected_end_date).getTime() - new Date(b.expected_end_date).getTime());
}
