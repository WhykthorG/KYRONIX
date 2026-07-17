// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
import { getAccessTokenOrThrow } from '@/lib/supabase';

const DEFAULT_GUARDIAN_API_BASE = '/api/guardian';
const GUARDIAN_API_BASE =
  import.meta.env.VITE_GUARDIAN_API_BASE_URL || DEFAULT_GUARDIAN_API_BASE;

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
    const error = new Error(payload?.error || 'Falha ao executar operacao do portal do responsavel.');
    error.code = payload?.code || 'GUARDIAN_PORTAL_REQUEST_FAILED';
    error.traceId = payload?.traceId || null;
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export async function listGuardianPortalStudents() {
  const payload = await authenticatedJsonRequest(`${GUARDIAN_API_BASE}/students`, {
    method: 'GET',
  });

  return payload.data || [];
}

export async function getGuardianDocumentSignedUrl({ studentId, filePath }) {
  return authenticatedJsonRequest(
    `${GUARDIAN_API_BASE}/documents?studentId=${encodeURIComponent(studentId)}`,
    {
      method: 'POST',
      body: { filePath },
    }
  );
}

export async function getGuardianMonthlyReportData({ studentId, month }) {
  const params = new URLSearchParams({
    studentId,
    month,
  });

  const payload = await authenticatedJsonRequest(
    `${GUARDIAN_API_BASE}/monthly-report?${params.toString()}`,
    {
      method: 'GET',
    }
  );

  return payload.data || null;
}
