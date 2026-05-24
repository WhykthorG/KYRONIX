import test from 'node:test';
import assert from 'node:assert/strict';

import {
  filterGradesVisibleToStudent,
  GRADE_STATUSES,
  isGradePublished,
  normalizeGradeStatus,
} from '../shared/src/contracts/grades.js';

test('student grade visibility returns only own published grades', () => {
  const visibleGrades = filterGradesVisibleToStudent([
    { id: 'grade-1', student_id: 'student-1', status: 'publicado' },
    { id: 'grade-2', student_id: 'student-1', status: 'rascunho' },
    { id: 'grade-3', student_id: 'student-2', status: 'publicado' },
    { id: 'grade-4', student_id: 'student-1', status: 'publicada' },
  ], 'student-1');

  assert.deepEqual(visibleGrades.map((grade) => grade.id), ['grade-1', 'grade-4']);
});

test('grade contracts normalize publication aliases for student visibility', () => {
  assert.equal(normalizeGradeStatus('publicada'), GRADE_STATUSES.PUBLISHED);
  assert.equal(isGradePublished({ status: GRADE_STATUSES.PUBLISHED }), true);
  assert.equal(isGradePublished({ status: GRADE_STATUSES.DRAFT }), false);
});
