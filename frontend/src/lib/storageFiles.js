// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/auditClient';
import { AUDIT_EVENT_TYPES } from '@shared/auditLog';
import {
  DEFAULT_STORAGE_BUCKET as FALLBACK_STORAGE_BUCKET,
  createStorageFileReference as createStorageFileReferenceContract,
  diffRemovedStorageFileReferences as diffRemovedStorageFileReferencesContract,
  extractStoragePath as extractStoragePathContract,
  getStoredFileName as getStoredFileNameContract,
  getStorageFileKey as getStorageFileKeyContract,
  normalizeStorageBucket,
  normalizeStorageFileReference as normalizeStorageFileReferenceContract,
  normalizeStorageFileReferences as normalizeStorageFileReferencesContract,
} from '@shared/contracts/storage';
import { optimizeImageForUpload, shouldOptimizeImageBeforeUpload } from '@/lib/imageUploadOptimizer';

export const DEFAULT_STORAGE_BUCKET = FALLBACK_STORAGE_BUCKET;

function normalizeBucket(bucket) {
  return normalizeStorageBucket(bucket, DEFAULT_STORAGE_BUCKET);
}

function sanitizePathSegment(value, fallback = 'arquivo') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return normalized || fallback;
}

function normalizeFolder(folder) {
  const normalized = String(folder || 'uploads')
    .split('/')
    .map((segment) => sanitizePathSegment(segment, 'uploads'))
    .filter(Boolean)
    .join('/');

  return normalized || 'uploads';
}

function buildStorageObjectId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

export function buildStorageObjectPath({ file, folder = 'uploads' } = {}) {
  if (!file) {
    throw new Error('Arquivo obrigatorio para upload.');
  }

  const normalizedFolder = normalizeFolder(folder);
  const originalName = typeof file?.name === 'string' ? file.name : 'arquivo';
  const extension = originalName.includes('.')
    ? originalName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || ''
    : '';
  const baseName = sanitizePathSegment(
    extension ? originalName.slice(0, -(extension.length + 1)) : originalName
  );
  const suffix = extension ? `.${extension}` : '';

  return `${normalizedFolder}/${Date.now()}-${buildStorageObjectId()}-${baseName}${suffix}`;
}

function getExplicitExternalUrl(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  }

  if (!value || typeof value !== 'object') return null;

  for (const candidate of [value.signedUrl, value.url, value.publicUrl]) {
    if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())) {
      return candidate.trim();
    }
  }

  return null;
}

export function extractStoragePath(value, bucket = DEFAULT_STORAGE_BUCKET) {
  return extractStoragePathContract(value, normalizeBucket(bucket));
}

export function getStoredFileName(value, bucket = DEFAULT_STORAGE_BUCKET) {
  return getStoredFileNameContract(value, normalizeBucket(bucket));
}

export function createStorageFileReference(input) {
  return createStorageFileReferenceContract({
    ...input,
    bucket: normalizeBucket(input?.bucket),
  });
}

export function normalizeStorageFileReference(value, bucket = DEFAULT_STORAGE_BUCKET) {
  return normalizeStorageFileReferenceContract(value, normalizeBucket(bucket));
}

export function normalizeStorageFileReferences(values, bucket = DEFAULT_STORAGE_BUCKET) {
  return normalizeStorageFileReferencesContract(values, normalizeBucket(bucket));
}

export function getStorageFileKey(value, bucket = DEFAULT_STORAGE_BUCKET) {
  return getStorageFileKeyContract(value, normalizeBucket(bucket));
}

export function diffRemovedStorageFileReferences(previousValues, nextValues, bucket = DEFAULT_STORAGE_BUCKET) {
  return diffRemovedStorageFileReferencesContract(previousValues, nextValues, normalizeBucket(bucket));
}

export async function uploadStorageFile({ file, folder, bucket = DEFAULT_STORAGE_BUCKET }) {
  const normalizedBucket = normalizeBucket(bucket);
  let optimizationResult = { file, optimized: false, reason: 'skipped' };

  if (shouldOptimizeImageBeforeUpload(file)) {
    try {
      optimizationResult = await optimizeImageForUpload(file);
    } catch (error) {
      console.warn('[storage] Falha ao otimizar imagem antes do upload; usando arquivo original.', error);
      optimizationResult = {
        file,
        optimized: false,
        reason: 'optimization_failed',
      };
    }
  }

  const uploadFile = optimizationResult.file || file;
  const filePath = buildStorageObjectPath({ file: uploadFile, folder });

  const { error } = await supabase.storage.from(normalizedBucket).upload(filePath, uploadFile, {
    upsert: false,
    contentType: uploadFile?.type || file?.type || undefined,
    cacheControl: '3600',
  });

  if (error) {
    throw new Error(error.message || 'Falha ao enviar arquivo para o storage.');
  }

  logAuditEvent({
    eventType: AUDIT_EVENT_TYPES.STORAGE_UPLOAD,
    recordId: filePath,
    metadata: {
      bucket: normalizedBucket,
      folder,
      path: filePath,
      file_name: file?.name || null,
      stored_file_name: uploadFile?.name || file?.name || null,
      content_type: uploadFile?.type || file?.type || null,
      original_content_type: file?.type || null,
      size_bytes: uploadFile?.size ?? file?.size ?? null,
      original_size_bytes: file?.size ?? null,
      optimized_image: Boolean(optimizationResult.optimized),
      optimized_size_bytes: optimizationResult.optimized ? optimizationResult.optimizedSize ?? uploadFile?.size ?? null : null,
      optimized_savings_bytes: optimizationResult.optimized ? optimizationResult.savingsBytes ?? null : null,
      source: 'storageFiles.uploadStorageFile',
    },
  }).catch((auditError) => {
    console.warn('[audit] Falha ao registrar upload no storage.', auditError);
  });

  return filePath;
}

export async function resolveStorageFileUrl(value, { bucket = DEFAULT_STORAGE_BUCKET, expiresIn = 3600 } = {}) {
  if (!value) return null;

  const normalizedBucket = normalizeBucket(bucket);
  const filePath = extractStoragePath(value, normalizedBucket);

  if (!filePath) {
    return getExplicitExternalUrl(value);
  }

  const { data, error } = await supabase.storage
    .from(normalizedBucket)
    .createSignedUrl(filePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Falha ao gerar URL temporaria do arquivo.');
  }

  return data.signedUrl;
}

export async function deleteStorageFile(value, { bucket = DEFAULT_STORAGE_BUCKET } = {}) {
  return deleteStorageFiles([value], { bucket });
}

export async function deleteStorageFiles(values, { bucket = DEFAULT_STORAGE_BUCKET } = {}) {
  const normalizedBucket = normalizeBucket(bucket);
  const normalizedPaths = [...new Set(
    (Array.isArray(values) ? values : [values])
      .map((value) => extractStoragePath(value, normalizedBucket))
      .filter(Boolean)
  )];

  if (normalizedPaths.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const { error } = await supabase.storage.from(normalizedBucket).remove(normalizedPaths);

  if (error) {
    throw new Error(error.message || 'Falha ao remover arquivo(s) do storage.');
  }

  return {
    success: true,
    deletedCount: normalizedPaths.length,
  };
}
