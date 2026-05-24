import { getAccessTokenOrThrow } from '@/lib/supabase';

const API_BASE = import.meta.env.VITE_SCHEDULE_PLANNER_API_BASE_URL || `${import.meta.env.VITE_ADMIN_API_BASE_URL || '/api/admin'}/schedule-planner`;

async function getToken() {
  return getAccessTokenOrThrow('Sessão expirada. Entre novamente para continuar.');
}

async function request(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  const response = await fetch(`${API_BASE}${path}`, {
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
    const error = new Error(payload?.error || 'Falha na operação do planner.');
    error.statusCode = response.status;
    error.code = payload?.code || 'SCHEDULE_PLANNER_API_ERROR';
    error.traceId = payload?.traceId || null;
    throw error;
  }

  return payload;
}

export const schedulePlannerAdminApi = {
  listGenerationDetails: (generationId) => request(`/generations/${generationId}`),
  listVersions: (settingId) => request(`/versions${settingId ? `?settingId=${encodeURIComponent(settingId)}` : ''}`),
  listConflicts: (generationId) => request(`/conflicts${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ''}`),
  listSuggestions: (generationId) => request(`/suggestions${generationId ? `?generationId=${encodeURIComponent(generationId)}` : ''}`),
  listAuditLog: (settingId) => request(`/audit-log${settingId ? `?settingId=${encodeURIComponent(settingId)}` : ''}`),
  createStructureBatch: (payload) => request('/structures', { method: 'POST', body: payload }),
  manualEdit: (payload) => request('/manual-edits', { method: 'POST', body: payload }),
  applySuggestion: (id, payload = {}) => request(`/suggestions/${id}`, { method: 'POST', body: { action: 'apply', ...payload } }),
  rejectSuggestion: (id, payload = {}) => request(`/suggestions/${id}`, { method: 'POST', body: { action: 'reject', ...payload } }),
  restoreVersion: (id, payload = {}) => request(`/versions/${id}`, { method: 'POST', body: { action: 'restore', ...payload } }),
  publishVersion: (id, payload = {}) => request('/publish', { method: 'POST', body: { versionId: id, ...payload } }),
};
