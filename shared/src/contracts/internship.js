// Contratos do módulo de Estágio Supervisionado — KYRONIX S.E.N.O
// Whykthor GSV

// ── Status enums ──────────────────────────────────────────────
export const INTERNSHIP_STATUSES = Object.freeze({
  PENDING: 'pendente',
  APPROVED: 'aprovado',
  ACTIVE: 'em_andamento',
  COMPLETED: 'concluido',
  CANCELLED: 'cancelado',
  REPROVED: 'reprovado',
});

export const VALID_INTERNSHIP_STATUSES = Object.values(INTERNSHIP_STATUSES);

export const COMPANY_STATUSES = Object.freeze({
  ACTIVE: 'ativa',
  INACTIVE: 'inativa',
  SUSPENDED: 'suspenso',
});

export const VALID_COMPANY_STATUSES = Object.values(COMPANY_STATUSES);

export const DIARY_STATUSES = Object.freeze({
  DRAFT: 'rascunho',
  APPROVED: 'aprovado',
  REJECTED: 'rejeitado',
});

export const VALID_DIARY_STATUSES = Object.values(DIARY_STATUSES);

export const EVALUATOR_TYPES = Object.freeze({
  SUPERVISOR: 'supervisor',
  TEACHER: 'teacher',
  COMPANY: 'company',
});

export const VALID_EVALUATOR_TYPES = Object.values(EVALUATOR_TYPES);

// ── Labels ────────────────────────────────────────────────────
export const INTERNSHIP_STATUS_LABELS = Object.freeze({
  [INTERNSHIP_STATUSES.PENDING]: 'Pendente',
  [INTERNSHIP_STATUSES.APPROVED]: 'Aprovado',
  [INTERNSHIP_STATUSES.ACTIVE]: 'Em Andamento',
  [INTERNSHIP_STATUSES.COMPLETED]: 'Concluído',
  [INTERNSHIP_STATUSES.CANCELLED]: 'Cancelado',
  [INTERNSHIP_STATUSES.REPROVED]: 'Reprovado',
});

export const COMPANY_STATUS_LABELS = Object.freeze({
  [COMPANY_STATUSES.ACTIVE]: 'Ativa',
  [COMPANY_STATUSES.INACTIVE]: 'Inativa',
  [COMPANY_STATUSES.SUSPENDED]: 'Suspensa',
});

export const DIARY_STATUS_LABELS = Object.freeze({
  [DIARY_STATUSES.DRAFT]: 'Rascunho',
  [DIARY_STATUSES.APPROVED]: 'Aprovado',
  [DIARY_STATUSES.REJECTED]: 'Rejeitado',
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

// ── Company normalizer ────────────────────────────────────────
export function normalizeCompanyPayload(company = {}) {
  return {
    name: normalizeString(company.name) || 'Empresa sem nome',
    cnpj: normalizeString(company.cnpj) || null,
    address: company.address && typeof company.address === 'object' ? company.address : {},
    phone: normalizeString(company.phone) || null,
    email: normalizeString(company.email) || null,
    contact_name: normalizeString(company.contact_name) || null,
    contact_role: normalizeString(company.contact_role) || null,
    partnership_date: normalizeDate(company.partnership_date),
    status: normalizeEnum(company.status, VALID_COMPANY_STATUSES) || COMPANY_STATUSES.ACTIVE,
    notes: normalizeString(company.notes) || null,
    attachment_urls: Array.isArray(company.attachment_urls) ? company.attachment_urls : [],
  };
}

// ── Supervisor normalizer ─────────────────────────────────────
export function normalizeSupervisorPayload(supervisor = {}) {
  return {
    company_id: normalizeString(supervisor.company_id),
    name: normalizeString(supervisor.name) || 'Supervisor sem nome',
    email: normalizeString(supervisor.email) || null,
    phone: normalizeString(supervisor.phone) || null,
    role: normalizeString(supervisor.role) || null,
    is_active: supervisor.is_active !== false,
  };
}

// ── Internship normalizer ─────────────────────────────────────
export function normalizeInternshipPayload(internship = {}) {
  return {
    student_id: normalizeString(internship.student_id),
    company_id: normalizeString(internship.company_id) || null,
    supervisor_id: normalizeString(internship.supervisor_id) || null,
    teacher_advisor_id: normalizeString(internship.teacher_advisor_id) || null,
    class_id: normalizeString(internship.class_id) || null,
    subject_id: normalizeString(internship.subject_id) || null,
    start_date: normalizeDate(internship.start_date),
    end_date: normalizeDate(internship.end_date),
    status: normalizeEnum(internship.status, VALID_INTERNSHIP_STATUSES) || INTERNSHIP_STATUSES.PENDING,
    hours_required: normalizeNumber(internship.hours_required, 0),
    hours_completed: normalizeNumber(internship.hours_completed, 0),
    description: normalizeString(internship.description) || null,
    objectives: normalizeString(internship.objectives) || null,
    activities: normalizeString(internship.activities) || null,
    evaluation_notes: normalizeString(internship.evaluation_notes) || null,
    supervisor_grade: internship.supervisor_grade != null ? normalizeNumber(internship.supervisor_grade, null) : null,
    supervisor_notes: normalizeString(internship.supervisor_notes) || null,
    final_grade: internship.final_grade != null ? normalizeNumber(internship.final_grade, null) : null,
    attachment_urls: Array.isArray(internship.attachment_urls) ? internship.attachment_urls : [],
  };
}

// ── Diary normalizer ──────────────────────────────────────────
export function normalizeDiaryPayload(diary = {}) {
  return {
    internship_id: normalizeString(diary.internship_id),
    date: normalizeDate(diary.date),
    start_time: normalizeString(diary.start_time) || null,
    end_time: normalizeString(diary.end_time) || null,
    hours: normalizeNumber(diary.hours, 0),
    activities_performed: normalizeString(diary.activities_performed),
    challenges: normalizeString(diary.challenges) || null,
    learnings: normalizeString(diary.learnings) || null,
    supervisor_feedback: normalizeString(diary.supervisor_feedback) || null,
    attachment_urls: Array.isArray(diary.attachment_urls) ? diary.attachment_urls : [],
    status: normalizeEnum(diary.status, VALID_DIARY_STATUSES) || DIARY_STATUSES.DRAFT,
  };
}

// ── Evaluation normalizer ─────────────────────────────────────
export function normalizeEvaluationPayload(evaluation = {}) {
  return {
    internship_id: normalizeString(evaluation.internship_id),
    evaluator_type: normalizeEnum(evaluation.evaluator_type, VALID_EVALUATOR_TYPES),
    evaluator_id: normalizeString(evaluation.evaluator_id) || null,
    evaluation_date: normalizeDate(evaluation.evaluation_date),
    criteria: Array.isArray(evaluation.criteria) ? evaluation.criteria : [],
    overall_grade: evaluation.overall_grade != null ? normalizeNumber(evaluation.overall_grade, null) : null,
    comments: normalizeString(evaluation.comments) || null,
    strengths: normalizeString(evaluation.strengths) || null,
    improvements: normalizeString(evaluation.improvements) || null,
  };
}

// ── Builders ──────────────────────────────────────────────────
export function buildInternshipMutationInput(internship = {}) {
  const normalized = normalizeInternshipPayload(internship);

  if (!normalized.student_id) {
    throw new Error('student_id é obrigatório para criar um estágio.');
  }

  if (!normalized.start_date) {
    throw new Error('start_date é obrigatório para criar um estágio.');
  }

  return normalized;
}

export function buildCompanyMutationInput(company = {}) {
  const normalized = normalizeCompanyPayload(company);

  if (!normalized.name || normalized.name === 'Empresa sem nome') {
    throw new Error('name é obrigatório para criar uma empresa.');
  }

  return normalized;
}

// ── Helpers ───────────────────────────────────────────────────
export function getInternshipStatusLabel(status) {
  return INTERNSHIP_STATUS_LABELS[status] || status;
}

export function getCompanyStatusLabel(status) {
  return COMPANY_STATUS_LABELS[status] || status;
}

export function getDiaryStatusLabel(status) {
  return DIARY_STATUS_LABELS[status] || status;
}

export function canApproveInternship(internship, profileType) {
  if (!internship || !profileType) return false;
  return ['administrador', 'coordenador'].includes(profileType)
    && internship.status === INTERNSHIP_STATUSES.PENDING;
}

export function canCompleteInternship(internship, profileType) {
  if (!internship || !profileType) return false;
  return ['administrador', 'coordenador', 'professor'].includes(profileType)
    && internship.status === INTERNSHIP_STATUSES.ACTIVE;
}

export function calculateInternshipProgress(internship) {
  if (!internship || !internship.hours_required) return 0;
  return Math.min(100, Math.round((internship.hours_completed / internship.hours_required) * 100));
}

export function isInternshipOverdue(internship) {
  if (!internship || !internship.end_date) return false;
  if (internship.status !== INTERNSHIP_STATUSES.ACTIVE) return false;
  return new Date(internship.end_date) < new Date();
}

export function getUpcomingDeadlines(internships = []) {
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return internships
    .filter((i) => i.end_date && i.status === INTERNSHIP_STATUSES.ACTIVE)
    .filter((i) => {
      const endDate = new Date(i.end_date);
      return endDate >= now && endDate <= twoWeeks;
    })
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
}
