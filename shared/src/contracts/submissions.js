export const SUBMISSION_STATUSES = Object.freeze({
  DRAFT: 'rascunho',
  SENT: 'enviado',
  IN_REVIEW: 'em_revisao',
  GRADED: 'corrigido',
  RETURNED: 'devolvido',
});

const VALID_SUBMISSION_STATUSES = new Set(Object.values(SUBMISSION_STATUSES));
const LEGACY_SUBMISSION_ALIASES = Object.freeze({
  entregue: SUBMISSION_STATUSES.SENT,
  avaliada: SUBMISSION_STATUSES.GRADED,
});

export function normalizeSubmissionStatus(value) {
  const normalized = LEGACY_SUBMISSION_ALIASES[value] ?? value;
  return VALID_SUBMISSION_STATUSES.has(normalized) ? normalized : null;
}

export function countPendingGradings(submissions, assignments) {
  const assignmentIds = new Set((assignments ?? []).map((assignment) => assignment.id));

  return (submissions ?? []).filter((submission) => {
    return (
      assignmentIds.has(submission.assignment_id) &&
      normalizeSubmissionStatus(submission.status) === SUBMISSION_STATUSES.SENT
    );
  }).length;
}
