import { getAccessTokenOrThrow } from '@/lib/supabase';

const DEFAULT_ATTENDANCE_API_BASE = '/api/attendance';
const ATTENDANCE_API_BASE =
  import.meta.env.VITE_ATTENDANCE_API_BASE_URL || DEFAULT_ATTENDANCE_API_BASE;

async function getAccessToken() {
  return getAccessTokenOrThrow('Sessao expirada. Entre novamente para continuar.');
}

async function authenticatedJsonRequest(url, { method = 'GET', body = null } = {}) {
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

  if (!response.ok) {
    const error = new Error(payload?.error || 'Falha ao salvar a chamada.');
    error.code = payload?.code || 'ATTENDANCE_REQUEST_FAILED';
    error.traceId = payload?.traceId || null;
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export async function saveLessonAttendance(payload) {
  return authenticatedJsonRequest(`${ATTENDANCE_API_BASE}/lesson`, {
    method: 'POST',
    body: payload,
  });
}
