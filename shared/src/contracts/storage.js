// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
export const DEFAULT_STORAGE_BUCKET = 'project-wg-files';

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function stripUrlSuffix(value) {
  return value.split(/[?#]/, 1)[0];
}

function resolveStorageBucket(candidate, fallback = DEFAULT_STORAGE_BUCKET) {
  const normalizedFallback = normalizeStorageBucket(fallback, null);
  const normalizedCandidate = normalizeStorageBucket(candidate, null);

  if (!normalizedFallback) {
    return normalizedCandidate;
  }

  if (!normalizedCandidate || normalizedCandidate !== normalizedFallback) {
    return normalizedFallback;
  }

  return normalizedCandidate;
}

function extractPathFromStorageUrl(url, bucket) {
  const normalizedUrl = normalizeString(url);
  const normalizedBucket = normalizeStorageBucket(bucket);
  if (!normalizedUrl || !normalizedBucket) return null;

  const markers = [
    `/storage/v1/object/sign/${normalizedBucket}/`,
    `/storage/v1/object/public/${normalizedBucket}/`,
    `/storage/v1/object/authenticated/${normalizedBucket}/`,
    `/storage/v1/object/${normalizedBucket}/`,
  ];

  for (const marker of markers) {
    const markerIndex = normalizedUrl.indexOf(marker);
    if (markerIndex >= 0) {
      const encodedPath = stripUrlSuffix(normalizedUrl.slice(markerIndex + marker.length));
      return normalizeString(decodeURIComponent(encodedPath));
    }
  }

  return null;
}

export function normalizeStorageBucket(bucket, fallback = DEFAULT_STORAGE_BUCKET) {
  return normalizeString(bucket) || normalizeString(fallback) || null;
}

export function extractStoragePath(value, bucket = DEFAULT_STORAGE_BUCKET) {
  if (!value) return null;

  if (typeof value === 'object') {
    if (typeof value.file_path === 'string' && value.file_path.trim()) {
      return value.file_path.trim();
    }
    if (typeof value.path === 'string' && value.path.trim()) {
      return value.path.trim();
    }
    if (typeof value.filePath === 'string' && value.filePath.trim()) {
      return value.filePath.trim();
    }

    const sourceUrl = normalizeString(value.signedUrl)
      || normalizeString(value.publicUrl)
      || normalizeString(value.url);

    if (!sourceUrl) return null;
    return extractStoragePath(sourceUrl, resolveStorageBucket(value.bucket, bucket));
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isHttpUrl(trimmed)) return trimmed;

  return extractPathFromStorageUrl(trimmed, bucket);
}

export function getStoredFileName(value, bucket = DEFAULT_STORAGE_BUCKET) {
  if (value && typeof value === 'object') {
    const explicitName = normalizeString(value.file_name) || normalizeString(value.name);
    if (explicitName) return explicitName;
  }

  const path = extractStoragePath(value, bucket);
  if (!path) return 'arquivo';

  const parts = path.split('/');
  return parts[parts.length - 1] || 'arquivo';
}

export function createStorageFileReference({
  path,
  filePath,
  fileName,
  bucket = DEFAULT_STORAGE_BUCKET,
  ...metadata
} = {}) {
  const normalizedPath = normalizeString(filePath) || normalizeString(path);
  if (!normalizedPath) return null;

  const normalizedBucket = resolveStorageBucket(bucket, null);
  const normalizedFileName = normalizeString(fileName) || getStoredFileName(normalizedPath, normalizedBucket);

  return {
    ...metadata,
    file_path: normalizedPath,
    file_name: normalizedFileName,
    ...(normalizedBucket ? { bucket: normalizedBucket } : {}),
  };
}

export function normalizeStorageFileReference(value, bucket = DEFAULT_STORAGE_BUCKET) {
  if (!value) return null;

  if (typeof value === 'string') {
    const normalizedValue = normalizeString(value);
    if (!normalizedValue) return null;

    if (isHttpUrl(normalizedValue)) {
      const normalizedPath = extractStoragePath(normalizedValue, bucket);
      if (!normalizedPath) {
        return {
          url: normalizedValue,
          file_name: getStoredFileName(normalizedValue, bucket),
        };
      }

      return createStorageFileReference({
        filePath: normalizedPath,
        fileName: getStoredFileName(normalizedPath, bucket),
        bucket,
      });
    }

    return createStorageFileReference({
      filePath: normalizedValue,
      fileName: getStoredFileName(normalizedValue, bucket),
      bucket,
    });
  }

  if (typeof value !== 'object') return null;

  const {
    path,
    file_path,
    filePath,
    url,
    publicUrl,
    signedUrl,
    file_name,
    name,
    bucket: objectBucket,
    ...metadata
  } = value;

  const resolvedBucket = resolveStorageBucket(objectBucket, bucket);
  const normalizedPath = extractStoragePath(
    { file_path, path, filePath, signedUrl, publicUrl, url, bucket: resolvedBucket },
    resolvedBucket
  );

  if (!normalizedPath) {
    const normalizedUrl = normalizeString(signedUrl)
      || normalizeString(url)
      || normalizeString(publicUrl);

    if (!normalizedUrl) return null;

    return {
      ...metadata,
      file_name: normalizeString(file_name) || normalizeString(name) || getStoredFileName(normalizedUrl, resolvedBucket),
      url: normalizedUrl,
    };
  }

  return createStorageFileReference({
    filePath: normalizedPath,
    fileName: normalizeString(file_name) || normalizeString(name) || getStoredFileName(normalizedPath, resolvedBucket),
    bucket: resolvedBucket,
    ...metadata,
  });
}

export function normalizeStorageFileReferences(values, bucket = DEFAULT_STORAGE_BUCKET) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeStorageFileReference(value, bucket))
    .filter(Boolean);
}

export function getStorageFileKey(value, bucket = DEFAULT_STORAGE_BUCKET) {
  if (!value) return null;

  if (typeof value === 'object') {
    const normalizedUrl = normalizeString(value.url);
    if (normalizedUrl) return normalizedUrl;
  }

  if (typeof value === 'string') {
    const normalizedValue = normalizeString(value);
    if (!normalizedValue) return null;

    if (isHttpUrl(normalizedValue)) {
      const normalizedPath = extractStoragePath(normalizedValue, bucket);
      return normalizedPath ? `${normalizeStorageBucket(bucket)}:${normalizedPath}` : normalizedValue;
    }

    return `${normalizeStorageBucket(bucket)}:${normalizedValue}`;
  }

  const normalizedBucket = resolveStorageBucket(value.bucket, bucket);
  const normalizedPath = extractStoragePath(value, normalizedBucket);
  if (normalizedPath) {
    return `${normalizedBucket}:${normalizedPath}`;
  }

  return null;
}

export function diffRemovedStorageFileReferences(previousValues, nextValues, bucket = DEFAULT_STORAGE_BUCKET) {
  const nextKeys = new Set(normalizeStorageFileReferences(nextValues, bucket).map((value) => getStorageFileKey(value, bucket)));

  return normalizeStorageFileReferences(previousValues, bucket)
    .filter((value) => !nextKeys.has(getStorageFileKey(value, bucket)));
}
