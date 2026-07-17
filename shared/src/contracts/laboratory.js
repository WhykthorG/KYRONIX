// Contratos do módulo de Laboratórios — KYRONIX S.E.N.O
// Whykthor GSV

// ── Status enums ──────────────────────────────────────────────
export const LAB_STATUSES = Object.freeze({
  AVAILABLE: 'disponivel',
  IN_USE: 'em_uso',
  MAINTENANCE: 'manutencao',
  CLOSED: 'fechado',
});

export const VALID_LAB_STATUSES = Object.values(LAB_STATUSES);

export const RESERVATION_STATUSES = Object.freeze({
  PENDING: 'pendente',
  CONFIRMED: 'confirmada',
  IN_PROGRESS: 'em_andamento',
  COMPLETED: 'concluida',
  CANCELLED: 'cancelada',
});

export const VALID_RESERVATION_STATUSES = Object.values(RESERVATION_STATUSES);

export const EQUIPMENT_STATUSES = Object.freeze({
  AVAILABLE: 'disponivel',
  IN_USE: 'em_uso',
  MAINTENANCE: 'manutencao',
  LOST: 'perdido',
  RETIRED: 'descontinuado',
});

export const VALID_EQUIPMENT_STATUSES = Object.values(EQUIPMENT_STATUSES);

export const LOAN_STATUSES = Object.freeze({
  ACTIVE: 'ativo',
  RETURNED: 'devolvido',
  OVERDUE: 'atrasado',
  LOST: 'perdido',
});

export const VALID_LOAN_STATUSES = Object.values(LOAN_STATUSES);

// ── Labels ────────────────────────────────────────────────────
export const LAB_STATUS_LABELS = Object.freeze({
  [LAB_STATUSES.AVAILABLE]: 'Disponível',
  [LAB_STATUSES.IN_USE]: 'Em Uso',
  [LAB_STATUSES.MAINTENANCE]: 'Manutenção',
  [LAB_STATUSES.CLOSED]: 'Fechado',
});

export const RESERVATION_STATUS_LABELS = Object.freeze({
  [RESERVATION_STATUSES.PENDING]: 'Pendente',
  [RESERVATION_STATUSES.CONFIRMED]: 'Confirmada',
  [RESERVATION_STATUSES.IN_PROGRESS]: 'Em Andamento',
  [RESERVATION_STATUSES.COMPLETED]: 'Concluída',
  [RESERVATION_STATUSES.CANCELLED]: 'Cancelada',
});

export const EQUIPMENT_STATUS_LABELS = Object.freeze({
  [EQUIPMENT_STATUSES.AVAILABLE]: 'Disponível',
  [EQUIPMENT_STATUSES.IN_USE]: 'Em Uso',
  [EQUIPMENT_STATUSES.MAINTENANCE]: 'Manutenção',
  [EQUIPMENT_STATUSES.LOST]: 'Perdido',
  [EQUIPMENT_STATUSES.RETIRED]: 'Descontinuado',
});

export const LOAN_STATUS_LABELS = Object.freeze({
  [LOAN_STATUSES.ACTIVE]: 'Ativo',
  [LOAN_STATUSES.RETURNED]: 'Devolvido',
  [LOAN_STATUSES.OVERDUE]: 'Atrasado',
  [LOAN_STATUSES.LOST]: 'Perdido',
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

// ── Lab normalizer ────────────────────────────────────────────
export function normalizeLabPayload(lab = {}) {
  return {
    name: normalizeString(lab.name),
    code: normalizeString(lab.code) || null,
    location: normalizeString(lab.location) || null,
    capacity: normalizeNumber(lab.capacity, 0),
    description: normalizeString(lab.description) || null,
    resources: normalizeString(lab.resources) || null,
    status: normalizeEnum(lab.status, VALID_LAB_STATUSES) || LAB_STATUSES.AVAILABLE,
    rules: normalizeString(lab.rules) || null,
    opening_hours: lab.opening_hours || null,
    attachment_urls: Array.isArray(lab.attachment_urls) ? lab.attachment_urls : [],
  };
}

// ── Reservation normalizer ────────────────────────────────────
export function normalizeReservationPayload(reservation = {}) {
  return {
    lab_id: normalizeString(reservation.lab_id),
    title: normalizeString(reservation.title),
    description: normalizeString(reservation.description) || null,
    requester_id: normalizeString(reservation.requester_id) || null,
    requester_type: normalizeString(reservation.requester_type) || 'professor',
    class_id: normalizeString(reservation.class_id) || null,
    subject_id: normalizeString(reservation.subject_id) || null,
    date: normalizeDate(reservation.date),
    start_time: normalizeString(reservation.start_time),
    end_time: normalizeString(reservation.end_time),
    status: normalizeEnum(reservation.status, VALID_RESERVATION_STATUSES) || RESERVATION_STATUSES.PENDING,
    students_expected: normalizeNumber(reservation.students_expected, 0),
    notes: normalizeString(reservation.notes) || null,
  };
}

// ── Equipment normalizer ──────────────────────────────────────
export function normalizeEquipmentPayload(equipment = {}) {
  return {
    lab_id: normalizeString(equipment.lab_id),
    name: normalizeString(equipment.name),
    code: normalizeString(equipment.code) || null,
    description: normalizeString(equipment.description) || null,
    brand: normalizeString(equipment.brand) || null,
    model: normalizeString(equipment.model) || null,
    serial_number: normalizeString(equipment.serial_number) || null,
    status: normalizeEnum(equipment.status, VALID_EQUIPMENT_STATUSES) || EQUIPMENT_STATUSES.AVAILABLE,
    quantity: normalizeNumber(equipment.quantity, 1),
    location_detail: normalizeString(equipment.location_detail) || null,
    purchase_date: normalizeDate(equipment.purchase_date),
    warranty_date: normalizeDate(equipment.warranty_date),
    attachment_urls: Array.isArray(equipment.attachment_urls) ? equipment.attachment_urls : [],
  };
}

// ── Material Loan normalizer ──────────────────────────────────
export function normalizeMaterialLoanPayload(loan = {}) {
  return {
    lab_id: normalizeString(loan.lab_id),
    equipment_id: normalizeString(loan.equipment_id) || null,
    material_name: normalizeString(loan.material_name),
    borrower_id: normalizeString(loan.borrower_id),
    borrower_type: normalizeString(loan.borrower_type) || 'aluno',
    quantity: normalizeNumber(loan.quantity, 1),
    loan_date: normalizeDate(loan.loan_date),
    expected_return_date: normalizeDate(loan.expected_return_date),
    actual_return_date: normalizeDate(loan.actual_return_date),
    status: normalizeEnum(loan.status, VALID_LOAN_STATUSES) || LOAN_STATUSES.ACTIVE,
    notes: normalizeString(loan.notes) || null,
  };
}

// ── Usage Log normalizer ──────────────────────────────────────
export function normalizeUsageLogPayload(log = {}) {
  return {
    lab_id: normalizeString(log.lab_id),
    reservation_id: normalizeString(log.reservation_id) || null,
    user_id: normalizeString(log.user_id),
    user_type: normalizeString(log.user_type) || 'professor',
    date: normalizeDate(log.date),
    start_time: normalizeString(log.start_time),
    end_time: normalizeString(log.end_time),
    activity: normalizeString(log.activity),
    students_count: normalizeNumber(log.students_count, 0),
    equipment_used: Array.isArray(log.equipment_used) ? log.equipment_used : [],
    notes: normalizeString(log.notes) || null,
  };
}

// ── Builders ──────────────────────────────────────────────────
export function buildLabMutationInput(lab = {}) {
  const normalized = normalizeLabPayload(lab);
  if (!normalized.name) throw new Error('name é obrigatório para criar um laboratório.');
  return normalized;
}

export function buildReservationMutationInput(reservation = {}) {
  const normalized = normalizeReservationPayload(reservation);
  if (!normalized.lab_id) throw new Error('lab_id é obrigatório para criar uma reserva.');
  if (!normalized.date) throw new Error('date é obrigatório para criar uma reserva.');
  if (!normalized.start_time || !normalized.end_time) throw new Error('start_time e end_time são obrigatórios.');
  return normalized;
}

export function buildEquipmentMutationInput(equipment = {}) {
  const normalized = normalizeEquipmentPayload(equipment);
  if (!normalized.lab_id) throw new Error('lab_id é obrigatório para criar equipamento.');
  if (!normalized.name) throw new Error('name é obrigatório para criar equipamento.');
  return normalized;
}

export function buildMaterialLoanMutationInput(loan = {}) {
  const normalized = normalizeMaterialLoanPayload(loan);
  if (!normalized.lab_id) throw new Error('lab_id é obrigatório para criar empréstimo.');
  if (!normalized.material_name) throw new Error('material_name é obrigatório.');
  if (!normalized.borrower_id) throw new Error('borrower_id é obrigatório.');
  return normalized;
}

// ── Helpers ───────────────────────────────────────────────────
export function getLabStatusLabel(status) {
  return LAB_STATUS_LABELS[status] || status;
}

export function getReservationStatusLabel(status) {
  return RESERVATION_STATUS_LABELS[status] || status;
}

export function getEquipmentStatusLabel(status) {
  return EQUIPMENT_STATUS_LABELS[status] || status;
}

export function getMaterialLoanStatusLabel(status) {
  return LOAN_STATUS_LABELS[status] || status;
}

export function isLabAvailable(lab) {
  return lab?.status === LAB_STATUSES.AVAILABLE;
}

export function isReservationConflict(reservation, existingReservations) {
  if (!reservation.date || !reservation.start_time || !reservation.end_time) return false;
  return existingReservations.some((r) =>
    r.lab_id === reservation.lab_id
    && r.date === reservation.date
    && r.id !== reservation.id
    && r.status !== RESERVATION_STATUSES.CANCELLED
    && r.start_time < reservation.end_time
    && r.end_time > reservation.start_time
  );
}
