import { createNetlifyRequest, createNetlifyResponse } from '../../../backend/src/services/netlifyApiBridge.js';
import { getApiRouteSegments } from '../../../backend/src/services/apiRouteResolver.js';
import { resolveApiHandlerFromManifest } from './apiRouteManifest.js';

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
    const resolved = resolveApiHandlerFromManifest(segments);

    if (!resolved?.loadHandler) {
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

    const routeHandler = await resolved.loadHandler();

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
    console.error('[netlify-api]', {
      message: error?.message,
      stack: error?.stack,
    });

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
