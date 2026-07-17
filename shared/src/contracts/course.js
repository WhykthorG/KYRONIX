// Contratos do módulo de Cursos e Séries — EduGest
// Whykthor GSV

// ── Status enums ──────────────────────────────────────────────
export const COURSE_STATUSES = Object.freeze({
  ACTIVE: 'ativo',
  INACTIVE: 'inativo',
});

export const VALID_COURSE_STATUSES = Object.values(COURSE_STATUSES);

export const SERIES_STATUSES = Object.freeze({
  ACTIVE: 'ativa',
  INACTIVE: 'inativa',
});

export const VALID_SERIES_STATUSES = Object.values(SERIES_STATUSES);

// ── Labels ────────────────────────────────────────────────────
export const COURSE_STATUS_LABELS = Object.freeze({
  [COURSE_STATUSES.ACTIVE]: 'Ativo',
  [COURSE_STATUSES.INACTIVE]: 'Inativo',
});

export const SERIES_STATUS_LABELS = Object.freeze({
  [SERIES_STATUSES.ACTIVE]: 'Ativa',
  [SERIES_STATUSES.INACTIVE]: 'Inativa',
});

// ── Normalizers ───────────────────────────────────────────────
function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEnum(value, validValues) {
  const normalized = normalizeString(value).toLowerCase();
  return validValues.includes(normalized) ? normalized : null;
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

// ── Course normalizer ─────────────────────────────────────────
export function normalizeCoursePayload(course = {}) {
  return {
    name: normalizeString(course.name),
    code: normalizeString(course.code) || null,
    description: normalizeString(course.description) || null,
    duration_years: normalizeNumber(course.duration_years, 1),
    total_hours: normalizeNumber(course.total_hours, 0),
    status: normalizeEnum(course.status, VALID_COURSE_STATUSES) || COURSE_STATUSES.ACTIVE,
  };
}

// ── Series normalizer ─────────────────────────────────────────
export function normalizeSeriesPayload(series = {}) {
  return {
    course_id: normalizeString(series.course_id),
    name: normalizeString(series.name),
    code: normalizeString(series.code) || null,
    order_index: normalizeNumber(series.order_index, 1),
    year: normalizeNumber(series.year, null) || null,
    status: normalizeEnum(series.status, VALID_SERIES_STATUSES) || SERIES_STATUSES.ACTIVE,
  };
}

// ── Class-Series normalizer ───────────────────────────────────
export function normalizeClassSeriesPayload(data = {}) {
  return {
    class_id: normalizeString(data.class_id),
    series_id: normalizeString(data.series_id),
    academic_year: normalizeNumber(data.academic_year, new Date().getFullYear()),
  };
}

// ── Builders ──────────────────────────────────────────────────
export function buildCourseMutationInput(course = {}) {
  const normalized = normalizeCoursePayload(course);
  if (!normalized.name) throw new Error('name é obrigatório para criar um curso.');
  return normalized;
}

export function buildSeriesMutationInput(series = {}) {
  const normalized = normalizeSeriesPayload(series);
  if (!normalized.course_id) throw new Error('course_id é obrigatório para criar uma série.');
  if (!normalized.name) throw new Error('name é obrigatório para criar uma série.');
  return normalized;
}

// ── Helpers ───────────────────────────────────────────────────
export function getCourseStatusLabel(status) {
  return COURSE_STATUS_LABELS[status] || status;
}

export function getSeriesStatusLabel(status) {
  return SERIES_STATUS_LABELS[status] || status;
}
