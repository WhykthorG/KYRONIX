// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
import { fromISODate, toISODate, validateDate } from '../validators.js';
import {
  extractStoragePath,
  normalizeStorageFileReferences,
} from './storage.js';

export const ENROLLMENT_STATUSES = {
  ACTIVE: 'ativo',
  INACTIVE: 'inativo',
  TRANSFERRED: 'transferido',
  GRADUATED: 'formado',
  DROPPED_OUT: 'evadido',
  PENDING: 'pendente',
};

export const ENROLLMENT_REGULARIZATION_ROLES = new Set([
  'administrador',
  'coordenador',
  'secretario',
  'gestao',
]);

export const REGULARIZABLE_ENROLLMENT_STATUSES = new Set([
  ENROLLMENT_STATUSES.PENDING,
  ENROLLMENT_STATUSES.INACTIVE,
]);

const VALID_ENROLLMENT_STATUSES = new Set(Object.values(ENROLLMENT_STATUSES));
const VALID_GENDERS = new Set(['masculino', 'feminino', 'outro']);
const VALID_MARITAL_STATUSES = new Set(['solteiro', 'casado', 'viuvo', 'divorciado', 'outro']);
const VALID_ENTRY_METHODS = new Set(['vestibular', 'enem', 'transferencia', 'portador_diploma', 'outro']);
const VALID_GUARDIAN_RELATIONSHIPS = new Set(['pai', 'mae', 'avo', 'tio', 'responsavel_legal', 'outro']);
const VALID_SHIFTS = new Set(['matutino', 'vespertino', 'noturno', 'integral']);

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeEnum(value, validValues) {
  const normalized = normalizeString(value);
  return normalized && validValues.has(normalized) ? normalized : null;
}

function normalizeEnrollmentDate(value) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  if (validateDate(normalized)) return toISODate(normalized);
  return null;
}

function normalizeEnrollmentAddress(address) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null;

  const normalizedAddress = Object.fromEntries(
    Object.entries(address)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
  );

  return Object.keys(normalizedAddress).length > 0 ? normalizedAddress : null;
}

export function normalizeEnrollmentEmail(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function collectEnrollmentAttachmentPaths(student = {}) {
  const attachments = Array.isArray(student?.attachments) ? student.attachments : [];

  return [...new Set(
    attachments
      .map((attachment) => extractStoragePath(attachment))
      .filter(Boolean)
  )];
}

export function normalizeEnrollmentAccess(
  access = {},
  student = {},
  { passwordFactory = null } = {}
) {
  const createAccess = Boolean(access?.create_access);

  if (!createAccess) {
    return {
      create_access: false,
      email: null,
      password: null,
    };
  }

  const email = normalizeEnrollmentEmail(access?.email || student?.email);
  const password = normalizeString(access?.password)
    || (typeof passwordFactory === 'function' ? passwordFactory() : null);

  return {
    create_access: true,
    email,
    password,
  };
}

export function normalizeEnrollmentStudentPayload(student = {}, access = {}) {
  const normalizedAccess = normalizeEnrollmentAccess(access, student);
  const normalizedEmail = normalizedAccess.create_access
    ? normalizedAccess.email
    : normalizeEnrollmentEmail(student?.email);
  const normalizedAttachments = normalizeStorageFileReferences(student?.attachments);

  const normalizedMedicalConditions = normalizeString(
    student?.medical_conditions || student?.health_conditions
  );

  const normalizedPayload = {
    ...student,
    email: normalizedEmail,
    attachments: normalizedAttachments,
    birth_date: normalizeEnrollmentDate(student?.birth_date || student?.birth_date_display),
    enrollment_date: normalizeEnrollmentDate(student?.enrollment_date),
    current_class_id: normalizeString(student?.current_class_id),
    enrollment_status: normalizeEnum(student?.enrollment_status, VALID_ENROLLMENT_STATUSES)
      || ENROLLMENT_STATUSES.PENDING,
    gender: normalizeEnum(student?.gender, VALID_GENDERS),
    marital_status: normalizeEnum(student?.marital_status, VALID_MARITAL_STATUSES),
    entry_method: normalizeEnum(student?.entry_method, VALID_ENTRY_METHODS),
    guardian_relationship: normalizeEnum(student?.guardian_relationship, VALID_GUARDIAN_RELATIONSHIPS),
    shift: normalizeEnum(student?.shift, VALID_SHIFTS),
    address: normalizeEnrollmentAddress(student?.address),
    medical_conditions: normalizedMedicalConditions,
  };

  delete normalizedPayload.birth_date_display;
  delete normalizedPayload.health_conditions;

  return Object.fromEntries(
    Object.entries(normalizedPayload).filter(([, value]) => value !== undefined)
  );
}

export function buildEnrollmentMutationInput({
  student,
  access = {},
  passwordFactory = null,
}) {
  const normalizedAccess = normalizeEnrollmentAccess(access, student, { passwordFactory });
  const normalizedStudent = normalizeEnrollmentStudentPayload(student, normalizedAccess);

  return {
    student: {
      ...normalizedStudent,
      enrollment_status: ENROLLMENT_STATUSES.PENDING,
    },
    access: normalizedAccess,
    tempPassword: normalizedAccess.create_access ? normalizedAccess.password : null,
  };
}

function formatAuditDate(now) {
  return now.toISOString().slice(0, 10);
}

export function canManageEnrollmentRegularization(profileType) {
  return ENROLLMENT_REGULARIZATION_ROLES.has(profileType);
}

export function canRegularizeEnrollment(student, profileType) {
  return Boolean(
    student?.id
    && canManageEnrollmentRegularization(profileType)
    && REGULARIZABLE_ENROLLMENT_STATUSES.has(student.enrollment_status)
  );
}

export function filterStudentsPendingRegularization(students = [], profileType) {
  if (!canManageEnrollmentRegularization(profileType)) return [];
  return students.filter((student) => canRegularizeEnrollment(student, profileType));
}

export function countStudentsBlockedForRegularization(students = [], profileType) {
  return filterStudentsPendingRegularization(students, profileType)
    .filter((student) => getEnrollmentRegularizationIssues(student).length > 0)
    .length;
}

export function getEnrollmentRegularizationIssues(student) {
  const issues = [];

  if (!student?.current_class_id) {
    issues.push('Vincule o aluno a uma turma antes de regularizar a matrícula.');
  }

  if (!student?.current_grade?.trim()) {
    issues.push('Informe a série/ano do aluno antes de regularizar a matrícula.');
  }

  return issues;
}

export function buildEnrollmentRegularizationPayload(
  student,
  { actorName = 'gestao', now = new Date() } = {}
) {
  const regularizationDate = formatAuditDate(now);
  const auditLine = `[${regularizationDate}] Matrícula regularizada por ${actorName}.`;
  const notes = student?.notes?.trim()
    ? `${student.notes.trim()}\n${auditLine}`
    : auditLine;

  return {
    enrollment_status: ENROLLMENT_STATUSES.ACTIVE,
    enrollment_date: student?.enrollment_date || regularizationDate,
    notes,
  };
}

export function formatEnrollmentStudentFormInitialData(student = {}) {
  if (!student || typeof student !== 'object') return student;

  return {
    ...student,
    birth_date: student?.birth_date ? fromISODate(student.birth_date) : '',
    health_conditions: student?.health_conditions || student?.medical_conditions || '',
  };
}
