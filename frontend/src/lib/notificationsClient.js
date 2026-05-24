// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import { getAccessTokenOrThrow } from '@/lib/supabase';
import { parseSystemJobResponseHeaders } from '@shared/contracts/systemEvents';
import {
  isApiBaseUnavailable,
  isApiRouteMissing,
  markApiBaseUnavailable,
} from '@/lib/apiAvailability';

const DEFAULT_MESSAGES_API_BASE = '/api/messages';
const DEFAULT_NOTIFICATIONS_API_BASE = '/api/notifications';

const MESSAGES_API_BASE =
  import.meta.env.VITE_MESSAGES_API_BASE_URL || DEFAULT_MESSAGES_API_BASE;
const NOTIFICATIONS_API_BASE =
  import.meta.env.VITE_NOTIFICATIONS_API_BASE_URL || DEFAULT_NOTIFICATIONS_API_BASE;

async function getAccessToken() {
  return getAccessTokenOrThrow('Sessao expirada. Entre novamente para continuar.');
}

async function authenticatedJsonRequest(url, { method = 'GET', body = null } = {}) {
  if (isApiBaseUnavailable(NOTIFICATIONS_API_BASE)) {
    return null;
  }

  const token = await getAccessToken();
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const raw = await response.text();
  let payload = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (isApiRouteMissing(response)) {
    markApiBaseUnavailable(NOTIFICATIONS_API_BASE);
    return null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.error || 'Falha ao executar operacao de notificacao.'
    );
    error.code = payload?.code || 'NOTIFICATION_REQUEST_FAILED';
    error.traceId = payload?.traceId || null;
    error.statusCode = response.status;
    throw error;
  }

  const resolvedJob =
    parseSystemJobResponseHeaders(response.headers)
    || payload?.job
    || payload?.notificationDispatch?.job
    || null;

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && resolvedJob) {
    return {
      ...payload,
      job: resolvedJob,
    };
  }

  return payload;
}

export async function createManagedMessage(payload) {
  return authenticatedJsonRequest(MESSAGES_API_BASE, {
    method: 'POST',
    body: payload,
  });
}

export async function listInboxNotifications({ limit = 30, includeDismissed = false } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (!includeDismissed) params.set('dismissed', 'false');

  const payload = await authenticatedJsonRequest(`${NOTIFICATIONS_API_BASE}?${params.toString()}`, {
    method: 'GET',
  });

  return payload?.data || [];
}

export async function markNotificationRead(notificationId) {
  const payload = await authenticatedJsonRequest(
    `${NOTIFICATIONS_API_BASE}/${encodeURIComponent(notificationId)}`,
    {
      method: 'PATCH',
      body: { action: 'mark_read' },
    }
  );

  return payload || { skipped: true, reason: 'API_UNAVAILABLE' };
}

export async function dismissNotificationById(notificationId) {
  const payload = await authenticatedJsonRequest(
    `${NOTIFICATIONS_API_BASE}/${encodeURIComponent(notificationId)}`,
    {
      method: 'PATCH',
      body: { action: 'dismiss' },
    }
  );

  return payload || { skipped: true, reason: 'API_UNAVAILABLE' };
}

export async function markAllNotificationsRead() {
  const payload = await authenticatedJsonRequest(NOTIFICATIONS_API_BASE, {
    method: 'PATCH',
    body: { action: 'mark_all_read' },
  });

  return payload || { skipped: true, reason: 'API_UNAVAILABLE' };
}
