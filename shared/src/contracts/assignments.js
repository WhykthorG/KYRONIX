// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
export const ASSIGNMENT_STATUSES = Object.freeze({
  DRAFT: 'rascunho',
  PUBLISHED: 'publicado',
  CLOSED: 'encerrado',
  ARCHIVED: 'arquivado',
});

const VALID_ASSIGNMENT_STATUSES = new Set(Object.values(ASSIGNMENT_STATUSES));
const LEGACY_ASSIGNMENT_ALIASES = Object.freeze({
  publicada: ASSIGNMENT_STATUSES.PUBLISHED,
});

export function normalizeAssignmentStatus(value) {
  const normalized = LEGACY_ASSIGNMENT_ALIASES[value] ?? value;
  return VALID_ASSIGNMENT_STATUSES.has(normalized) ? normalized : null;
}

export function buildPublishedAssignmentUpdate(assignment, now = new Date().toISOString()) {
  if (!assignment?.id) {
    throw new Error('Atividade inválida para publicação.');
  }

  return {
    ...assignment,
    status: ASSIGNMENT_STATUSES.PUBLISHED,
    published_at: now,
  };
}

export function isAssignmentPublished(assignment) {
  return normalizeAssignmentStatus(assignment?.status) === ASSIGNMENT_STATUSES.PUBLISHED;
}

export function isAssignmentOverdue(assignment, now = new Date()) {
  if (!assignment?.due_date) return false;
  const dueDate = new Date(assignment.due_date);
  return Number.isFinite(dueDate.getTime()) && dueDate.getTime() < now.getTime();
}

export function shouldAutoCloseAssignment(assignment, now = new Date()) {
  return (
    isAssignmentPublished(assignment)
    && !assignment?.allow_late_submission
    && isAssignmentOverdue(assignment, now)
  );
}
