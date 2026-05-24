import fs from 'fs';
import path from 'path';

function normalizeApiPrefix(pathname = '') {
  const normalized = String(pathname || '').trim();

  if (normalized.startsWith('/.netlify/functions/api/')) {
    return normalized.slice('/.netlify/functions/api/'.length);
  }

  if (normalized === '/.netlify/functions/api') {
    return '';
  }

  if (normalized.startsWith('/api/')) {
    return normalized.slice('/api/'.length);
  }

  if (normalized === '/api') {
    return '';
  }

  return normalized.replace(/^\/+/, '');
}

export function getApiRouteSegments(pathname = '') {
  return normalizeApiPrefix(pathname)
    .split('/')
    .map((segment) => String(segment || '').trim())
    .filter(Boolean);
}

export function resolveApiHandlerFromRoot(apiRoot, segments, currentDir = apiRoot, index = 0, params = {}) {
  if (index >= segments.length) {
    const indexFile = path.join(currentDir, 'index.js');
    if (fs.existsSync(indexFile)) {
      return { filePath: indexFile, params };
    }
    return null;
  }

  const segment = segments[index];
  const isLast = index === segments.length - 1;

  const directFile = path.join(currentDir, `${segment}.js`);
  if (isLast && fs.existsSync(directFile)) {
    return { filePath: directFile, params };
  }

  const directDir = path.join(currentDir, segment);
  if (fs.existsSync(directDir) && fs.statSync(directDir).isDirectory()) {
    const directMatch = resolveApiHandlerFromRoot(apiRoot, segments, directDir, index + 1, params);
    if (directMatch) {
      return directMatch;
    }
  }

  const entries = fs.existsSync(currentDir) ? fs.readdirSync(currentDir, { withFileTypes: true }) : [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('[') || !entry.name.endsWith('].js') || !isLast) {
      continue;
    }

    const paramName = entry.name.slice(1, -4);
    return {
      filePath: path.join(currentDir, entry.name),
      params: { ...params, [paramName]: segment },
    };
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('[') || !entry.name.endsWith(']')) {
      continue;
    }

    const paramName = entry.name.slice(1, -1);
    const dynamicMatch = resolveApiHandlerFromRoot(
      apiRoot,
      segments,
      path.join(currentDir, entry.name),
      index + 1,
      { ...params, [paramName]: segment },
    );

    if (dynamicMatch) {
      return dynamicMatch;
    }
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('[...') || !entry.name.endsWith('].js')) {
      continue;
    }

    const paramName = entry.name.slice(4, -4);
    const remainingSegments = segments.slice(index);

    return {
      filePath: path.join(currentDir, entry.name),
      params: { ...params, [paramName]: remainingSegments },
    };
  }

  return null;
}
