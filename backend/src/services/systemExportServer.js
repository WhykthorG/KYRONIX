import * as XLSX from 'xlsx';

import {
  buildSystemExportFilename,
  getSystemExportDataset,
  listSystemExportDatasets,
  SYSTEM_EXPORT_BATCH_SIZE,
  SYSTEM_EXPORT_FORMATS,
} from '../../../shared/src/contracts/systemExport.js';
import { assertSafeIdentifier } from '../../../shared/src/contracts/dbIdentifiers.js';
import {
  createSystemJobDescriptor,
  finalizeSystemJobDescriptor,
  SYSTEM_EVENT_TYPES,
  SYSTEM_JOB_STATUSES,
  SYSTEM_JOB_TYPES,
} from '../../../shared/src/contracts/systemEvents.js';


const MANIFEST_SHEET_NAME = 'manifesto_exportacao';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function sanitizeSheetName(value) {
  const normalized = String(value || 'dados')
    .replace(/[\\/*?:[\]]/g, ' ')
    .trim()
    .slice(0, 31);

  return normalized || 'dados';
}

function formatScalar(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

export function flattenExportRecord(record = {}, prefix = '', target = {}) {
  for (const [key, value] of Object.entries(record || {})) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      target[nextKey] = value.length ? JSON.stringify(value) : '[]';
      continue;
    }

    if (isPlainObject(value)) {
      const nestedEntries = Object.entries(value);
      if (!nestedEntries.length) {
        target[nextKey] = '{}';
        continue;
      }

      flattenExportRecord(value, nextKey, target);
      continue;
    }

    target[nextKey] = formatScalar(value);
  }

  return target;
}

export function normalizeRowsForExport(rows = []) {
  return rows.map((row) => flattenExportRecord(row));
}

function isMissingRelationError(error) {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '');
}

function isMissingCreatedAtError(error) {
  const message = error?.message || '';
  return (
    error?.code === '42703'
    || /column .*created_at.* does not exist/i.test(message)
    || /could not find the ['"]created_at['"] column/i.test(message)
  );
}

async function fetchDatasetBatch(serviceClient, dataset, from, to, withCreatedAtOrder = true) {
  const safeTableName = assertSafeIdentifier(dataset.tableName, 'Tabela de exportação');
  let query = serviceClient
    .from(safeTableName)
    .select('*');

  if (withCreatedAtOrder) {
    query = query.order('created_at', { ascending: false });
  }

  return query.range(from, to);
}

async function fetchDatasetRows(serviceClient, dataset, batchSize = SYSTEM_EXPORT_BATCH_SIZE) {
  const rows = [];
  let page = 0;
  let useCreatedAtOrder = true;

  while (true) {
    const from = page * batchSize;
    const to = from + batchSize - 1;

    let { data, error } = await fetchDatasetBatch(
      serviceClient,
      dataset,
      from,
      to,
      useCreatedAtOrder,
    );

    if (error && useCreatedAtOrder && isMissingCreatedAtError(error)) {
      useCreatedAtOrder = false;
      ({ data, error } = await fetchDatasetBatch(serviceClient, dataset, from, to, false));
    }

    if (error) {
      if (isMissingRelationError(error)) {
        return {
          status: 'indisponivel',
          rows: [],
          error,
        };
      }

      throw error;
    }

    const batch = data ?? [];
    rows.push(...batch);

    if (batch.length < batchSize) {
      break;
    }

    page += 1;
  }

  return {
    status: 'exportado',
    rows,
    error: null,
  };
}

async function fetchDatasetRowsSafely(serviceClient, dataset, batchSize = SYSTEM_EXPORT_BATCH_SIZE) {
  try {
    return await fetchDatasetRows(serviceClient, dataset, batchSize);
  } catch (error) {
    return {
      status: 'erro',
      rows: [],
      error,
    };
  }
}

export function buildExportManifestRows({
  exportedAt,
  requestedBy,
  format,
  batchSize = SYSTEM_EXPORT_BATCH_SIZE,
  datasets = [],
}) {
  return datasets.map((dataset) => ({
    exported_at: exportedAt,
    requested_by: requestedBy || '',
    format,
    batch_size: batchSize,
    dataset_key: dataset.key,
    dataset_label: dataset.label,
    table_name: dataset.tableName,
    status: dataset.status,
    row_count: dataset.rowCount,
    error: dataset.errorMessage || '',
  }));
}

function appendJsonSheet(workbook, sheetName, rows) {
  const normalizedRows = normalizeRowsForExport(rows);
  const sheet = XLSX.utils.json_to_sheet(normalizedRows);
  XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(sheetName));
}

function normalizeDatasetErrorMessage(error, dataset) {
  if (!error) {
    return '';
  }

  const message = error?.message || String(error);
  return dataset?.tableName ? `${dataset.tableName}: ${message}` : message;
}

export async function buildSystemExportFile({
  serviceClient,
  format = SYSTEM_EXPORT_FORMATS.XLSX,
  datasetKey = null,
  requestedBy = null,
  requestId = null,
  now = new Date(),
} = {}) {
  if (!serviceClient) {
    throw new Error('serviceClient e obrigatorio para exportar os dados.');
  }

  const safeFormat = format === SYSTEM_EXPORT_FORMATS.CSV
    ? SYSTEM_EXPORT_FORMATS.CSV
    : SYSTEM_EXPORT_FORMATS.XLSX;
  const selectedDatasets = datasetKey
    ? [getSystemExportDataset(datasetKey)].filter(Boolean)
    : listSystemExportDatasets();

  if (!selectedDatasets.length) {
    const error = new Error('Dataset de exportacao invalido.');
    error.statusCode = 400;
    throw error;
  }

  const exportedAt = now.toISOString();
  const baseJob = createSystemJobDescriptor({
    jobType: SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
    eventType: SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_REQUESTED,
    recordId: datasetKey || 'system-export',
    requestedBy,
    idempotencyParts: [
      SYSTEM_JOB_TYPES.SYSTEM_EXPORT_GENERATION,
      safeFormat,
      datasetKey || 'all',
      requestedBy || 'anonymous',
      requestId || null,
    ],
    metadata: {
      request_id: requestId || null,
      format: safeFormat,
      dataset_key: datasetKey || null,
    },
  });


  if (safeFormat === SYSTEM_EXPORT_FORMATS.CSV) {
    const dataset = selectedDatasets[0];
    const datasetExport = await fetchDatasetRows(serviceClient, dataset);

    if (datasetExport.status !== 'exportado') {
      const error = new Error(`A tabela ${dataset.tableName} nao esta disponivel para exportacao.`);
      error.statusCode = 409;
      throw error;
    }

    const normalizedRows = normalizeRowsForExport(datasetExport.rows);
    const sheet = XLSX.utils.json_to_sheet(normalizedRows);
    const csv = XLSX.utils.sheet_to_csv(sheet);

    return {
      contentType: CSV_CONTENT_TYPE,
      filename: buildSystemExportFilename({
        format: safeFormat,
        datasetKey: dataset.key,
        now,
      }),
      body: Buffer.from(`\uFEFF${csv}`, 'utf8'),
      manifestRows: buildExportManifestRows({
        exportedAt,
        requestedBy,
        format: safeFormat,
        datasets: [{
          ...dataset,
          status: datasetExport.status,
          rowCount: datasetExport.rows.length,
          errorMessage: '',
        }],
      }),
      job: finalizeSystemJobDescriptor(baseJob, {
        eventType: SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED,
        status: SYSTEM_JOB_STATUSES.COMPLETED,
        metadata: {
          dataset_count: 1,
          exported_at: exportedAt,
          manifest_row_count: 1,
        },
      }),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['manifesto_exportacao_em_processamento']]),
    MANIFEST_SHEET_NAME,
  );

  const manifestDatasets = [];

  for (const dataset of selectedDatasets) {
    const datasetExport = await fetchDatasetRowsSafely(serviceClient, dataset);
    let datasetStatus = datasetExport.status;
    let datasetErrorMessage = normalizeDatasetErrorMessage(datasetExport.error, dataset);

    if (datasetStatus !== 'exportado') {
      manifestDatasets.push({
        ...dataset,
        status: datasetStatus,
        rowCount: datasetExport.rows.length,
        errorMessage: datasetErrorMessage,
      });
      continue;
    }

    try {
      appendJsonSheet(workbook, dataset.key, datasetExport.rows);
    } catch (error) {
      datasetStatus = 'erro';
      datasetErrorMessage = normalizeDatasetErrorMessage(error, dataset);
    }

    manifestDatasets.push({
      ...dataset,
      status: datasetStatus,
      rowCount: datasetStatus === 'exportado' ? datasetExport.rows.length : 0,
      errorMessage: datasetErrorMessage,
    });
  }

  workbook.Sheets[MANIFEST_SHEET_NAME] = XLSX.utils.json_to_sheet(
    buildExportManifestRows({
      exportedAt,
      requestedBy,
      format: safeFormat,
      datasets: manifestDatasets,
    }),
  );

  return {
    contentType: XLSX_CONTENT_TYPE,
    filename: buildSystemExportFilename({
      format: safeFormat,
      datasetKey: selectedDatasets.length === 1 ? selectedDatasets[0].key : null,
      now,
    }),
    body: XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true,
    }),
    manifestRows: buildExportManifestRows({
      exportedAt,
      requestedBy,
      format: safeFormat,
      datasets: manifestDatasets,
    }),
    job: finalizeSystemJobDescriptor(baseJob, {
      eventType: SYSTEM_EVENT_TYPES.SYSTEM_EXPORT_COMPLETED,
      status: SYSTEM_JOB_STATUSES.COMPLETED,
      metadata: {
        dataset_count: manifestDatasets.filter((dataset) => dataset.status === 'exportado').length,
        dataset_error_count: manifestDatasets.filter((dataset) => dataset.status === 'erro').length,
        exported_at: exportedAt,
        manifest_row_count: manifestDatasets.length,
      },
    }),
  };
}
