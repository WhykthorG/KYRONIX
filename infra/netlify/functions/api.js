// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createNetlifyRequest, createNetlifyResponse } from '../../../backend/src/services/netlifyApiBridge.js';
import { getApiRouteSegments, resolveApiHandlerFromRoot } from '../../../backend/src/services/apiRouteResolver.js';

function isDirectory(value) {
  if (!value) {
    return false;
  }

  try {
    return fs.existsSync(value) && fs.statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function resolveApiRoot() {
  const runtimeEntryDir = process.argv?.[1]
    ? path.dirname(process.argv[1])
    : null;

  const rootCandidates = [
    process.env.LAMBDA_TASK_ROOT,
    runtimeEntryDir,
    process.cwd(),
  ].filter(Boolean);

  const relativeCandidates = [
    'backend/src/routes',
    '../backend/src/routes',
    '../../backend/src/routes',
    'src/routes',
    '../src/routes',
  ];

  for (const rootCandidate of rootCandidates) {
    for (const relativeCandidate of relativeCandidates) {
      const candidate = path.resolve(rootCandidate, relativeCandidate);
      if (isDirectory(candidate)) {
        return candidate;
      }
    }
  }

  return path.resolve(process.cwd(), 'backend/src/routes');
}

const apiRoot = resolveApiRoot();

function buildRequestUrl(event) {
  if (event?.rawUrl) {
    return event.rawUrl;
  }

  const protocol = event?.headers?.['x-forwarded-proto'] || 'https';
  const host = event?.headers?.host || 'localhost';
  const pathname = event?.path || '/';
  const query = event?.rawQuery || '';
  return `${protocol}://${host}${pathname}${query ? `?${query}` : ''}`;
}

function resolveRequestPathname(event) {
  const requestUrl = buildRequestUrl(event);
  return new URL(requestUrl, 'http://localhost').pathname;
}

function buildQueryParams(event) {
  return {
    ...(event?.multiValueQueryStringParameters || {}),
    ...(event?.queryStringParameters || {}),
  };
}

export async function handler(event) {
  try {
    const pathname = resolveRequestPathname(event);
    const segments = getApiRouteSegments(pathname);
    const resolved = resolveApiHandlerFromRoot(apiRoot, segments);

    if (!resolved?.filePath) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Rota de API não encontrada.' }),
      };
    }

    const req = createNetlifyRequest(event, {
      pathname,
      query: buildQueryParams(event),
    });
    req.params = resolved.params;

    const res = createNetlifyResponse();

    const imported = await import(pathToFileURL(resolved.filePath).href);
    const routeHandler = imported?.default;

    if (typeof routeHandler !== 'function') {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Handler de API inválido.' }),
      };
    }

    await routeHandler(req, res);

    if (!res.writableEnded) {
      res.end('');
    }

    return res.toNetlifyResponse();
  } catch (error) {
    console.error('[netlify-api]', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: error?.message || 'Erro interno ao executar handler de API.',
      }),
    };
  }
}
