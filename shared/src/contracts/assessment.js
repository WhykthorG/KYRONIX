// Contratos para melhorias no módulo de Avaliações — KYRONIX S.E.N.O
// Whykthor GSV

// ── Segunda Chamada ──────────────────────────────────────────
export const SECOND_CHANCE_STATUSES = Object.freeze({
  PENDING: 'pendente',
  SCHEDULED: 'agendada',
  COMPLETED: 'realizada',
  CANCELLED: 'cancelada',
  EXEMPT: 'dispensada',
});

export const VALID_SECOND_CHANCE_STATUSES = Object.values(SECOND_CHANCE_STATUSES);

export const SECOND_CHANCE_STATUS_LABELS = Object.freeze({
  [SECOND_CHANCE_STATUSES.PENDING]: 'Pendente',
  [SECOND_CHANCE_STATUSES.SCHEDULED]: 'Agendada',
  [SECOND_CHANCE_STATUSES.COMPLETED]: 'Realizada',
  [SECOND_CHANCE_STATUSES.CANCELLED]: 'Cancelada',
  [SECOND_CHANCE_STATUSES.EXEMPT]: 'Dispensada',
});

// ── Conselho de Classe ───────────────────────────────────────
export const COUNCIL_STATUSES = Object.freeze({
  SCHEDULED: 'agendado',
  IN_PROGRESS: 'em_andamento',
  COMPLETED: 'realizado',
  CANCELLED: 'cancelado',
});

export const VALID_COUNCIL_STATUSES = Object.values(COUNCIL_STATUSES);

export const COUNCIL_STATUS_LABELS = Object.freeze({
  [COUNCIL_STATUSES.SCHEDULED]: 'Agendado',
  [COUNCIL_STATUSES.IN_PROGRESS]: 'Em Andamento',
  [COUNCIL_STATUSES.COMPLETED]: 'Realizado',
  [COUNCIL_STATUSES.CANCELLED]: 'Cancelado',
});

export const COUNCIL_DECISION_TYPES = Object.freeze({
  APPROVED: 'aprovado',
  REPROVED: 'reprovado',
  RECOVERY: 'recuperacao',
  CONDITIONAL: 'condicional',
  TRANSFER: 'transferencia',
  WITHDRAWAL: 'evasao',
});

export const VALID_COUNCIL_DECISION_TYPES = Object.values(COUNCIL_DECISION_TYPES);

export const COUNCIL_DECISION_LABELS = Object.freeze({
  [COUNCIL_DECISION_TYPES.APPROVED]: 'Aprovado',
  [COUNCIL_DECISION_TYPES.REPROVED]: 'Reprovado',
  [COUNCIL_DECISION_TYPES.RECOVERY]: 'Recuperação',
  [COUNCIL_DECISION_TYPES.CONDITIONAL]: 'Condicional',
  [COUNCIL_DECISION_TYPES.TRANSFER]: 'Transferência',
  [COUNCIL_DECISION_TYPES.WITHDRAWAL]: 'Evasão',
});

// ── Tipos de Avaliação Melhorados ────────────────────────────
export const EVALUATION_TYPES = Object.freeze({
  EXAM: 'prova',
  WORK: 'trabalho',
  PROJECT: 'projeto',
  PRESENTATION: 'apresentacao',
  PRACTICAL: 'pratica',
  ORAL: 'oral',
  HOMEWORK: 'lição_de_casa',
  PARTICIPATION: 'participacao',
  OTHER: 'outro',
});

export const VALID_EVALUATION_TYPES = Object.values(EVALUATION_TYPES);

export const EVALUATION_TYPE_LABELS = Object.freeze({
  [EVALUATION_TYPES.EXAM]: 'Prova',
  [EVALUATION_TYPES.WORK]: 'Trabalho',
  [EVALUATION_TYPES.PROJECT]: 'Projeto',
  [EVALUATION_TYPES.PRESENTATION]: 'Apresentação',
  [EVALUATION_TYPES.PRACTICAL]: 'Prática',
  [EVALUATION_TYPES.ORAL]: 'Oral',
  [EVALUATION_TYPES.HOMEWORK]: 'Lição de Casa',
  [EVALUATION_TYPES.PARTICIPATION]: 'Participação',
  [EVALUATION_TYPES.OTHER]: 'Outro',
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

// ── Second Chance normalizer ──────────────────────────────────
export function normalizeSecondChancePayload(data = {}) {
  return {
    student_id: normalizeString(data.student_id),
    subject_id: normalizeString(data.subject_id),
    class_id: normalizeString(data.class_id),
    teacher_id: normalizeString(data.teacher_id) || null,
    bimester: normalizeNumber(data.bimester, 1),
    year: normalizeNumber(data.year, new Date().getFullYear()),
    scheduled_date: normalizeDate(data.scheduled_date),
    scheduled_time: normalizeString(data.scheduled_time) || null,
    location: normalizeString(data.location) || null,
    status: normalizeEnum(data.status, VALID_SECOND_CHANCE_STATUSES) || SECOND_CHANCE_STATUSES.PENDING,
    original_grade: data.original_grade != null ? normalizeNumber(data.original_grade, null) : null,
    new_grade: data.new_grade != null ? normalizeNumber(data.new_grade, null) : null,
    max_score: normalizeNumber(data.max_score, 10),
    weight: normalizeNumber(data.weight, 1),
    notes: normalizeString(data.notes) || null,
    justification: normalizeString(data.justification) || null,
  };
}

// ── Council normalizer ────────────────────────────────────────
export function normalizeCouncilPayload(data = {}) {
  return {
    class_id: normalizeString(data.class_id),
    academic_year: normalizeNumber(data.academic_year, new Date().getFullYear()),
    bimester: normalizeNumber(data.bimester, 1),
    scheduled_date: normalizeDate(data.scheduled_date),
    scheduled_time: normalizeString(data.scheduled_time) || null,
    location: normalizeString(data.location) || null,
    status: normalizeEnum(data.status, VALID_COUNCIL_STATUSES) || COUNCIL_STATUSES.SCHEDULED,
    coordinator_id: normalizeString(data.coordinator_id) || null,
    participants: Array.isArray(data.participants) ? data.participants : [],
    agenda: normalizeString(data.agenda) || null,
    minutes: normalizeString(data.minutes) || null,
    decisions: Array.isArray(data.decisions) ? data.decisions : [],
  };
}

// ── Council Student Decision normalizer ───────────────────────
export function normalizeCouncilDecisionPayload(data = {}) {
  return {
    council_id: normalizeString(data.council_id),
    student_id: normalizeString(data.student_id),
    decision: normalizeEnum(data.decision, VALID_COUNCIL_DECISION_TYPES),
    average_grade: data.average_grade != null ? normalizeNumber(data.average_grade, null) : null,
    attendance_rate: data.attendance_rate != null ? normalizeNumber(data.attendance_rate, null) : null,
    observations: normalizeString(data.observations) || null,
    recommended_actions: normalizeString(data.recommended_actions) || null,
    follow_up_date: normalizeDate(data.follow_up_date) || null,
  };
}

// ── Builders ──────────────────────────────────────────────────
export function buildSecondChanceMutationInput(data = {}) {
  const normalized = normalizeSecondChancePayload(data);
  if (!normalized.student_id) throw new Error('student_id é obrigatório.');
  if (!normalized.subject_id) throw new Error('subject_id é obrigatório.');
  if (!normalized.class_id) throw new Error('class_id é obrigatório.');
  if (!normalized.scheduled_date) throw new Error('scheduled_date é obrigatório.');
  return normalized;
}

export function buildCouncilMutationInput(data = {}) {
  const normalized = normalizeCouncilPayload(data);
  if (!normalized.class_id) throw new Error('class_id é obrigatório.');
  if (!normalized.scheduled_date) throw new Error('scheduled_date é obrigatório.');
  return normalized;
}

export function buildCouncilDecisionMutationInput(data = {}) {
  const normalized = normalizeCouncilDecisionPayload(data);
  if (!normalized.council_id) throw new Error('council_id é obrigatório.');
  if (!normalized.student_id) throw new Error('student_id é obrigatório.');
  if (!normalized.decision) throw new Error('decision é obrigatório.');
  return normalized;
}

// ── Helpers ───────────────────────────────────────────────────
export function getSecondChanceStatusLabel(status) {
  return SECOND_CHANCE_STATUS_LABELS[status] || status;
}

export function getCouncilStatusLabel(status) {
  return COUNCIL_STATUS_LABELS[status] || status;
}

export function getCouncilDecisionLabel(decision) {
  return COUNCIL_DECISION_LABELS[decision] || decision;
}

export function getEvaluationTypeLabel(type) {
  return EVALUATION_TYPE_LABELS[type] || type;
}

export function canScheduleSecondChance(student, subject, bimester, year) {
  if (!student || !subject) return false;
  return student.status === 'aprovado_em_recuperacao'
    || student.attendance_rate >= 0.75
    || student.average_grade >= 3;
}

export function isSecondChanceEligible(grade, passingGrade = 6) {
  if (!grade) return false;
  return grade >= 3 && grade < passingGrade;
}

export function calculateRecoveryGrade(grades) {
  if (!grades || grades.length === 0) return null;
  const sum = grades.reduce((acc, g) => acc + (g.score || 0), 0);
  return sum / grades.length;
}
