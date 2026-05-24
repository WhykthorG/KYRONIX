import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAttendanceListRows,
  buildGuardianMonthlyStudentReportPdfModel,
  buildStudentReportCardPdfModel,
  normalizePdfLayoutOptions,
  sanitizePdfFilename,
} from '../shared/src/contracts/pdfReports.js';

test('pdf layout options keep defaults and trim custom fields', () => {
  assert.deepEqual(
    normalizePdfLayoutOptions({
      headerTitle: '  Escola Horizonte  ',
      headerSubtitle: '   ',
      footerLeft: '  Secretaria escolar  ',
      footerRight: '  Contato: (11) 0000-0000  ',
    }),
    {
      headerTitle: 'Escola Horizonte',
      headerSubtitle: 'Relatorios escolares',
      footerLeft: 'Secretaria escolar',
      footerRight: 'Contato: (11) 0000-0000',
    },
  );
});

test('student report card pdf model groups grades, computes averages and attendance summary', () => {
  const model = buildStudentReportCardPdfModel({
    student: {
      id: 'student-1',
      full_name: 'Ana Clara Souza',
      registration_number: 'MAT-001',
    },
    grades: [
      { student_id: 'student-1', subject_id: 'history', bimester: 1, score: 4, status: 'publicado' },
      { student_id: 'student-1', subject_id: 'history', bimester: 2, score: 6, status: 'publicado' },
      { student_id: 'student-1', subject_id: 'math', bimester: 1, score: 8, status: 'publicado' },
      { student_id: 'student-1', subject_id: 'math', bimester: 2, score: 6, status: 'publicada' },
      { student_id: 'student-1', subject_id: 'math', bimester: 3, score: 10, status: 'rascunho' },
      { student_id: 'student-2', subject_id: 'math', bimester: 1, score: 10, status: 'publicado' },
    ],
    attendance: [
      { status: 'presente' },
      { status: 'atrasado' },
      { status: 'ausente' },
      { status: 'justificado' },
    ],
    subjects: [
      { id: 'history', name: 'Historia' },
      { id: 'math', name: 'Matematica' },
    ],
    className: '1A - Ensino Medio',
  });

  assert.equal(model.studentName, 'Ana Clara Souza');
  assert.equal(model.registrationNumber, 'MAT-001');
  assert.equal(model.className, '1A - Ensino Medio');
  assert.equal(model.overallAverage, '6.0');
  assert.deepEqual(model.attendanceSummary, {
    total: 4,
    present: 2,
    absent: 1,
    justified: 1,
    late: 1,
    rate: 50,
  });
  assert.deepEqual(model.rows, [
    {
      subjectName: 'Historia',
      b1: '4.0',
      b2: '6.0',
      b3: '-',
      b4: '-',
      average: '5.0',
      situation: 'Recuperacao',
    },
    {
      subjectName: 'Matematica',
      b1: '8.0',
      b2: '6.0',
      b3: '-',
      b4: '-',
      average: '7.0',
      situation: 'Aprovado',
    },
  ]);
});

test('attendance list rows keep the latest status per student and sanitize filenames', () => {
  const rows = buildAttendanceListRows({
    students: [
      { id: 'student-1', full_name: 'Ana Clara Souza', registration_number: 'MAT-001' },
      { id: 'student-2', full_name: 'Bruno Lima', registration_number: 'MAT-002' },
    ],
    attendanceRecords: [
      {
        student_id: 'student-1',
        status: 'presente',
        updated_at: '2026-03-31T07:00:00Z',
      },
      {
        student_id: 'student-1',
        status: 'ausente',
        updated_at: '2026-03-31T08:30:00Z',
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      index: 1,
      studentName: 'Ana Clara Souza',
      registrationNumber: 'MAT-001',
      status: 'ausente',
      statusLabel: 'Ausente',
    },
    {
      index: 2,
      studentName: 'Bruno Lima',
      registrationNumber: 'MAT-002',
      status: 'nao_registrado',
      statusLabel: 'Nao registrado',
    },
  ]);

  assert.equal(
    sanitizePdfFilename('Lista Presenca 1A / 31-03-2026'),
    'lista-presenca-1a-31-03-2026',
  );
});

test('guardian monthly pdf model compiles grades, attendance issues and occurrences for the selected month', () => {
  const model = buildGuardianMonthlyStudentReportPdfModel({
    student: {
      id: 'student-1',
      full_name: 'Ana Clara Souza',
      registration_number: 'MAT-001',
    },
    month: '2026-03',
    classRecord: {
      id: 'class-1',
      name: '1A',
      year: 2026,
    },
    subjects: [
      { id: 'math', name: 'Matematica' },
      { id: 'history', name: 'Historia' },
    ],
    grades: [
      {
        id: 'grade-1',
        subject_id: 'math',
        bimester: 1,
        evaluation_name: 'Prova mensal',
        evaluation_date: '2026-03-10',
        score: 8.5,
        max_score: 10,
        status: 'publicado',
      },
      {
        id: 'grade-2',
        subject_id: 'history',
        bimester: 1,
        evaluation_name: 'Seminario',
        evaluation_date: '2026-03-18',
        score: 6,
        max_score: 10,
        status: 'revisado',
      },
      {
        id: 'grade-3',
        subject_id: 'history',
        bimester: 1,
        evaluation_name: 'Fora do mes',
        evaluation_date: '2026-04-01',
        score: 10,
        max_score: 10,
        status: 'publicado',
      },
    ],
    attendance: [
      { id: 'att-1', date: '2026-03-02', status: 'presente' },
      { id: 'att-2', date: '2026-03-05', status: 'ausente', subject_id: 'math', justification: '' },
      { id: 'att-3', date: '2026-03-11', status: 'justificado', subject_id: 'history', justification: 'Atestado' },
      { id: 'att-4', date: '2026-04-03', status: 'ausente', subject_id: 'history', justification: 'Nao entra' },
    ],
    occurrences: [
      { id: 'occ-1', date: '2026-03-08', type: 'observacao', severity: 'leve', title: 'Observacao em sala', status: 'aberta' },
      { id: 'occ-2', date: '2026-03-22', type: 'disciplinar', severity: 'critica', title: 'Conflito no intervalo', status: 'resolvida' },
      { id: 'occ-3', date: '2026-04-02', type: 'elogio', severity: 'leve', title: 'Fora do mes', status: 'resolvida' },
    ],
  });

  assert.equal(model.studentName, 'Ana Clara Souza');
  assert.equal(model.registrationNumber, 'MAT-001');
  assert.equal(model.className, '1A - 2026');
  assert.equal(model.monthKey, '2026-03');
  assert.equal(model.monthLabel, 'Março de 2026');
  assert.deepEqual(model.gradeSummary, {
    total: 2,
    average: '7.3',
    highest: '8.5',
    lowest: '6.0',
  });
  assert.deepEqual(model.attendanceSummary, {
    total: 3,
    present: 1,
    absent: 1,
    justified: 1,
    late: 0,
    rate: 33,
  });
  assert.deepEqual(model.occurrenceSummary, {
    total: 2,
    open: 1,
    resolved: 1,
    critical: 1,
  });
  assert.deepEqual(model.gradeRows, [
    {
      date: '10/03/2026',
      subjectName: 'Matematica',
      evaluationName: 'Prova mensal',
      bimesterLabel: '1B',
      scoreLabel: '8.5 / 10.0',
      statusLabel: 'Publicado',
    },
    {
      date: '18/03/2026',
      subjectName: 'Historia',
      evaluationName: 'Seminario',
      bimesterLabel: '1B',
      scoreLabel: '6.0 / 10.0',
      statusLabel: 'Revisado',
    },
  ]);
  assert.deepEqual(model.attendanceRows, [
    {
      date: '05/03/2026',
      subjectName: 'Matematica',
      statusLabel: 'Ausente',
      justification: '-',
    },
    {
      date: '11/03/2026',
      subjectName: 'Historia',
      statusLabel: 'Justificado',
      justification: 'Atestado',
    },
  ]);
  assert.deepEqual(model.occurrenceRows, [
    {
      date: '08/03/2026',
      typeLabel: 'Observacao',
      severityLabel: 'Leve',
      title: 'Observacao em sala',
      statusLabel: 'Aberta',
    },
    {
      date: '22/03/2026',
      typeLabel: 'Disciplinar',
      severityLabel: 'Critica',
      title: 'Conflito no intervalo',
      statusLabel: 'Resolvida',
    },
  ]);
});
