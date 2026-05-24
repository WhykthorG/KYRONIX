import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEnrollmentMutationInput,
  buildEnrollmentRegularizationPayload,
  canManageEnrollmentRegularization,
  canRegularizeEnrollment,
  collectEnrollmentAttachmentPaths,
  countStudentsBlockedForRegularization,
  ENROLLMENT_STATUSES,
  filterStudentsPendingRegularization,
  getEnrollmentRegularizationIssues,
  normalizeEnrollmentAccess,
} from '../shared/src/contracts/enrollment.js';

test('regularization is allowed only for management roles and pending-like statuses', () => {
  const student = { id: 'student-1', enrollment_status: ENROLLMENT_STATUSES.PENDING };

  assert.equal(canRegularizeEnrollment(student, 'administrador'), true);
  assert.equal(canRegularizeEnrollment(student, 'coordenador'), true);
  assert.equal(canRegularizeEnrollment(student, 'secretario'), true);
  assert.equal(canRegularizeEnrollment(student, 'gestao'), true);
  assert.equal(canRegularizeEnrollment(student, 'professor'), false);
  assert.equal(
    canRegularizeEnrollment({ ...student, enrollment_status: ENROLLMENT_STATUSES.TRANSFERRED }, 'administrador'),
    false
  );
});

test('regularization payload activates the enrollment and appends an audit note', () => {
  const payload = buildEnrollmentRegularizationPayload({
    enrollment_status: ENROLLMENT_STATUSES.PENDING,
    enrollment_date: null,
    notes: 'Documentação conferida',
  }, {
    actorName: 'coordenador',
    now: new Date('2026-03-30T12:00:00.000Z'),
  });

  assert.equal(payload.enrollment_status, ENROLLMENT_STATUSES.ACTIVE);
  assert.equal(payload.enrollment_date, '2026-03-30');
  assert.match(payload.notes, /Documentação conferida/);
  assert.match(payload.notes, /Matrícula regularizada por coordenador/);
});

test('regularization flags missing academic linkage before activation', () => {
  const issues = getEnrollmentRegularizationIssues({
    id: 'student-1',
    enrollment_status: ENROLLMENT_STATUSES.PENDING,
    current_class_id: null,
    current_grade: '',
  });

  assert.deepEqual(issues, [
    'Vincule o aluno a uma turma antes de regularizar a matrícula.',
    'Informe a série/ano do aluno antes de regularizar a matrícula.',
  ]);
});

test('pending regularization queues are only exposed to management roles', () => {
  const students = [
    { id: 'student-1', enrollment_status: ENROLLMENT_STATUSES.PENDING, current_class_id: 'class-1', current_grade: '1 ano' },
    { id: 'student-2', enrollment_status: ENROLLMENT_STATUSES.INACTIVE, current_class_id: null, current_grade: '' },
    { id: 'student-3', enrollment_status: ENROLLMENT_STATUSES.ACTIVE, current_class_id: 'class-1', current_grade: '1 ano' },
  ];

  assert.equal(canManageEnrollmentRegularization('coordenador'), true);
  assert.equal(canManageEnrollmentRegularization('professor'), false);
  assert.deepEqual(
    filterStudentsPendingRegularization(students, 'coordenador').map((student) => student.id),
    ['student-1', 'student-2']
  );
  assert.equal(countStudentsBlockedForRegularization(students, 'coordenador'), 1);
  assert.deepEqual(filterStudentsPendingRegularization(students, 'professor'), []);
});

test('transactional enrollment input normalizes access, email and fallback status', () => {
  const request = buildEnrollmentMutationInput({
    student: {
      full_name: 'Ana Souza',
      email: 'Ana.Souza@Email.com ',
      attachments: null,
      current_class_id: '',
      enrollment_status: 'inativo',
    },
    access: {
      create_access: true,
    },
    passwordFactory: () => 'Temp#1234',
  });

  assert.deepEqual(request.access, {
    create_access: true,
    email: 'ana.souza@email.com',
    password: 'Temp#1234',
  });
  assert.equal(request.tempPassword, 'Temp#1234');
  assert.equal(request.student.email, 'ana.souza@email.com');
  assert.equal(request.student.enrollment_status, ENROLLMENT_STATUSES.PENDING);
  assert.equal(request.student.current_class_id, null);
  assert.deepEqual(request.student.attachments, []);
});

test('enrollment access normalization disables credentials when access is not requested', () => {
  assert.deepEqual(
    normalizeEnrollmentAccess(
      {
        create_access: false,
        email: 'ignored@example.com',
        password: 'ignored',
      },
      {
        email: 'student@example.com',
      }
    ),
    {
      create_access: false,
      email: null,
      password: null,
    }
  );
});

test('attachment path collector extracts unique storage paths from mixed payloads', () => {
  const paths = collectEnrollmentAttachmentPaths({
    attachments: [
      { path: 'attachments/doc-1.pdf', file_name: 'doc-1.pdf' },
      'attachments/doc-2.pdf',
      { file_path: 'attachments/doc-1.pdf', file_name: 'doc-1-copy.pdf' },
      'https://example.supabase.co/storage/v1/object/public/project-wg-files/attachments/doc-3.pdf',
      { file_name: 'sem-path.pdf' },
      null,
    ],
  });

  assert.deepEqual(paths, [
    'attachments/doc-1.pdf',
    'attachments/doc-2.pdf',
    'attachments/doc-3.pdf',
  ]);
});

test('transactional enrollment input canonicalizes attachment payloads to file_path', () => {
  const request = buildEnrollmentMutationInput({
    student: {
      full_name: 'Ana Souza',
      attachments: [
        { path: 'attachments/doc-1.pdf', file_name: 'RG.pdf', description: 'RG' },
        'https://example.supabase.co/storage/v1/object/public/project-wg-files/attachments/doc-2.pdf',
      ],
    },
  });

  assert.deepEqual(request.student.attachments, [
    {
      description: 'RG',
      file_path: 'attachments/doc-1.pdf',
      file_name: 'RG.pdf',
      bucket: 'project-wg-files',
    },
    {
      file_path: 'attachments/doc-2.pdf',
      file_name: 'doc-2.pdf',
      bucket: 'project-wg-files',
    },
  ]);
});
