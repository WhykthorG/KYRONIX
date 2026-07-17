// ðƒÐÇð¥ðÁð║Ðé ð┐ð¥ð╗ð¢ð¥ÐüÐéÐîÐÄ ÐÇð░ðÀÐÇð░ð▒ð¥Ðéð░ð¢ ðúð©ð║Ðéð¥ÐÇð¥ð╝ ðôðíðÆ.
import { getAccessTokenOrThrow } from '@/lib/supabase';

const DEFAULT_AUDIT_API_BASE = '/api/audit';
const AUDIT_API_BASE =
  import.meta.env.VITE_AUDIT_API_BASE_URL || DEFAULT_AUDIT_API_BASE;

async function getAccessToken() {
  return getAccessTokenOrThrow('Sessao expirada. Entre novamente para continuar.');
}

export async function logAuditEvent({
  eventType,
  recordId = null,
  metadata = {},
  accessToken = null,
}) {
  const token = accessToken || await getAccessToken();

  const response = await fetch(`${AUDIT_API_BASE}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      eventType,
      recordId,
      metadata,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    let payload = null;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    const error = new Error(
      payload?.error || 'Falha ao registrar evento de auditoria.'
    );
    error.code = payload?.code || 'AUDIT_EVENT_REQUEST_FAILED';
    error.traceId = payload?.traceId || null;
    throw error;
  }

  return response.json();
}
