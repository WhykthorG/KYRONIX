import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

import {
  buildSystemExportFilename,
  getSystemExportDataset,
  parseContentDispositionFilename,
} from '../shared/src/contracts/systemExport.js';
import {
  buildExportManifestRows,
  buildSystemExportFile,
  flattenExportRecord,
} from '../backend/src/services/systemExportServer.js';
import {
  SYSTEM_EVENT_TYPES,
  SYSTEM_JOB_TYPES,
} from '../shared/src/contracts/systemEvents.js';

function createLocalDate() {
  return new Date(2026, 2, 31, 10, 0, 0);
}

function createServiceClient(fixtures = {}) {
  return {
    from(tableName) {
      let orderedByCreatedAt = false;
      return {
        select() {
          return this;
        },
        order(columnName) {
          orderedByCreatedAt = columnName === 'created_at';
          return this;
        },
        async range(from, to) {
          if (!(tableName in fixtures)) {
            return {
              data: null,
              error: {
                code: '42P01',
                message: `relation "${tableName}" does not exist`,
              },
            };
          }

          const fixtureConfig = Array.isArray(fixtures[tableName])
            ? { rows: fixtures[tableName], missingCreatedAt: false }
            : {
                rows: fixtures[tableName]?.rows || [],
                missingCreatedAt: Boolean(fixtures[tableName]?.missingCreatedAt),
              };

          if (orderedByCreatedAt && fixtureConfig.missingCreatedAt) {
            return {
              data: null,
              error: {
                code: '42703',
                message: `column "${tableName}".created_at does not exist`,
              },
            };
          }

          return {
            data: fixtureConfig.rows.slice(from, to + 1),
            error: null,
          };
        },
      };
    },
  };
}

test('flattenExportRecord flattens objects and serializes arrays for export', () => {
  const flattened = flattenExportRecord({
    id: 'student-1',
    address: {
      city: 'Sao Paulo',
      zip: '01000-000',
    },
    subject_ids: ['math', 'science'],
    metadata: {},
  });

  assert.equal(flattened.id, 'student-1');
  assert.equal(flattened['address.city'], 'Sao Paulo');
  assert.equal(flattened['address.zip'], '01000-000');
  assert.equal(flattened.subject_ids, '["math","science"]');
  assert.equal(flattened.metadata, '{}');
});

test('buildExportManifestRows reports dataset counts and statuses', () => {
  const rows = buildExportManifestRows({
    exportedAt: '2026-03-31T10:00:00.000Z',
    requestedBy: 'admin@example.com',
    format: 'xlsx',
    batchSize: 250,
    datasets: [
      {
        key: 'students',
        label: 'Alunos',
        tableName: 'students',
        status: 'exportado',
        rowCount: 2,
        errorMessage: '',
      },
      {
        key: 'teachers',
        label: 'Professores',
        tableName: 'teachers',
        status: 'indisponivel',
        rowCount: 0,
        errorMessage: 'relation "teachers" does not exist',
      },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].dataset_key, 'students');
  assert.equal(rows[0].row_count, 2);
  assert.equal(rows[1].status, 'indisponivel');
  assert.match(rows[1].error, /teachers/);
});

test('buildSystemExportFile creates a CSV export for a single dataset', async () => {
  const serviceClient = createServiceClient({
    students: [
      {
        id: 'student-1',
        full_name: 'Ana',
        address: { city: 'Sao Paulo' },
        created_at: '2026-03-31T10:00:00.000Z',
      },
    ],
  });

  const exportFile = await buildSystemExportFile({
    serviceClient,
    format: 'csv',
    datasetKey: 'students',
    requestedBy: 'admin@example.com',
    requestId: 'export-req-1',
    now: createLocalDate(),
  });

  const csvContent = exportFile.body.toString('utf8');

  assert.equal(exportFile.contentType, 'text/csv; charset=utf-8');
  assert.match(exportFile.filename, /^backup-students-20260331-100000\.csv$/);
  assert.equal(exportFile.job.jobType, SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION);
  assert.equal(exportFile.job.eventType, SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED);
  assert.equal(exportFile.job.status, 'completed');
  assert.equal(exportFile.job.metadata.request_id, 'export-req-1');
  assert.equal(
    exportFile.job.idempotencyKey,
    'system.export.generation:csv:students:admin@example.com:export-req-1'
  );
  assert.match(csvContent, /full_name/);
  assert.match(csvContent, /address\.city/);
  assert.match(csvContent, /Ana/);
});

test('buildSystemExportFile creates workbook sheets and manifest rows without failing on missing datasets', async () => {
  const serviceClient = createServiceClient({
    app_settings: [
      {
        id: 'system',
        school_name: 'Escola Exemplo',
        created_at: '2026-03-31T10:00:00.000Z',
      },
    ],
    students: [
      {
        id: 'student-1',
        full_name: 'Ana',
        created_at: '2026-03-31T10:00:00.000Z',
      },
      {
        id: 'student-2',
        full_name: 'Bruno',
        created_at: '2026-03-31T10:01:00.000Z',
      },
    ],
  });

  const exportFile = await buildSystemExportFile({
    serviceClient,
    format: 'xlsx',
    requestedBy: 'admin@example.com',
    requestId: 'export-req-2',
    now: createLocalDate(),
  });

  const workbook = XLSX.read(exportFile.body, { type: 'buffer' });
  const manifestRows = XLSX.utils.sheet_to_json(workbook.Sheets.manifesto_exportacao);

  assert.equal(
    exportFile.contentType,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  assert.match(exportFile.filename, /^backup-sistema-completo-20260331-100000\.xlsx$/);
  assert.ok(workbook.SheetNames.includes('manifesto_exportacao'));
  assert.ok(workbook.SheetNames.includes('app_settings'));
  assert.ok(workbook.SheetNames.includes('students'));
  assert.equal(exportFile.job.jobType, SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION);
  assert.equal(exportFile.job.eventType, SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED);
  assert.equal(exportFile.job.metadata.dataset_count, 2);
  assert.equal(exportFile.job.metadata.request_id, 'export-req-2');

  const studentsManifest = manifestRows.find((row) => row.dataset_key === 'students');
  const teachersManifest = manifestRows.find((row) => row.dataset_key === 'teachers');

  assert.equal(studentsManifest.row_count, 2);
  assert.equal(studentsManifest.status, 'exportado');
  assert.equal(teachersManifest.status, 'indisponivel');
});

test('buildSystemExportFile falls back when dataset does not expose created_at ordering', async () => {
  const serviceClient = createServiceClient({
    app_settings: {
      missingCreatedAt: true,
      rows: [
        {
          id: 'system',
          school_name: 'Escola Exemplo',
        },
      ],
    },
  });

  const exportFile = await buildSystemExportFile({
    serviceClient,
    format: 'xlsx',
    datasetKey: 'app_settings',
    requestedBy: 'admin@example.com',
    now: createLocalDate(),
  });

  const workbook = XLSX.read(exportFile.body, { type: 'buffer' });
  const dataRows = XLSX.utils.sheet_to_json(workbook.Sheets.app_settings);

  assert.equal(dataRows.length, 1);
  assert.equal(dataRows[0].school_name, 'Escola Exemplo');
});

test('parseContentDispositionFilename extracts plain and UTF-8 filenames', () => {
  assert.equal(
    parseContentDispositionFilename('attachment; filename="backup.xlsx"'),
    'backup.xlsx',
  );
  assert.equal(
    parseContentDispositionFilename("attachment; filename*=UTF-8''backup-sistema.csv"),
    'backup-sistema.csv',
  );
});

test('buildSystemExportFilename uses dataset-specific names for CSV exports', () => {
  const filename = buildSystemExportFilename({
    format: 'csv',
    datasetKey: 'messages',
    now: createLocalDate(),
  });

  assert.equal(filename, 'backup-messages-20260331-100000.csv');
});

test('system export datasets include assignment views for delivery auditing', () => {
  const dataset = getSystemExportDataset('assignment_views');

  assert.ok(dataset);
  assert.equal(dataset.tableName, 'assignment_views');
});
