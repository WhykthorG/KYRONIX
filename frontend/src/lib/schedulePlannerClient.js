import { getAccessTokenOrThrow } from '@/lib/supabase';
import { parseSystemJobResponseHeaders } from '@shared/contracts/systemEvents';
import {
  isApiBaseUnavailable,
  isApiRouteMissing,
  markApiBaseUnavailable,
} from '@/lib/apiAvailability';

const DEFAULT_SCHEDULE_PLANNER_API_BASE = '/api/admin/schedule-planner';
const DEFAULT_ADMIN_API_BASE = '/api/admin';

const SCHEDULE_PLANNER_API_BASE =
  import.meta.env.VITE_SCHEDULE_PLANNER_API_BASE_URL
  || `${import.meta.env.VITE_ADMIN_API_BASE_URL || DEFAULT_ADMIN_API_BASE}/schedule-planner`
  || DEFAULT_SCHEDULE_PLANNER_API_BASE;

async function getAccessToken() {
  return getAccessTokenOrThrow('Sessão expirada. Entre novamente para continuar.');
}

async function authenticatedJsonRequest(path, { method = 'GET', body = null } = {}) {
  if (isApiBaseUnavailable(SCHEDULE_PLANNER_API_BASE)) {
    const unavailableError = new Error('A API administrativa do planejador de horários não está disponível neste deploy.');
    unavailableError.code = 'SCHEDULE_PLANNER_API_UNAVAILABLE';
    unavailableError.statusCode = 404;
    throw unavailableError;
  }

  const token = await getAccessToken();
  const response = await fetch(`${SCHEDULE_PLANNER_API_BASE}${path}`, {
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
    markApiBaseUnavailable(SCHEDULE_PLANNER_API_BASE);
    const unavailableError = new Error('A API administrativa do planejador de horários não está disponível neste deploy.');
    unavailableError.code = 'SCHEDULE_PLANNER_API_UNAVAILABLE';
    unavailableError.statusCode = 404;
    throw unavailableError;
  }

  if (!response.ok) {
    const error = new Error(payload?.error || 'Falha ao executar operação de horário.');
    error.code = payload?.code || 'SCHEDULE_PLANNER_REQUEST_FAILED';
    error.traceId = payload?.traceId || null;
    error.statusCode = response.status;
    throw error;
  }

  const job = parseSystemJobResponseHeaders(response.headers) || payload?.job || null;
  return job && payload && typeof payload === 'object'
    ? { ...payload, job }
    : payload;
}

export function sendTeacherAvailabilityQuestionnaires(payload) {
  return authenticatedJsonRequest('/questionnaires', {
    method: 'POST',
    body: payload,
  });
}

export async function createScheduleSetting(payload) {
  const response = await authenticatedJsonRequest('/settings', {
    method: 'POST',
    body: payload,
  });

  return response?.data || null;
}

export function generateSchedulePlan(payload) {
  return authenticatedJsonRequest('/generate', {
    method: 'POST',
    body: payload,
  });
}

export function getScheduleStructures(settingId) {
  return authenticatedJsonRequest(`/structures?settingId=${encodeURIComponent(settingId)}`)
    .then((response) => response?.data || null);
}

export function saveScheduleStructures(payload) {
  return authenticatedJsonRequest('/structures', {
    method: 'POST',
    body: payload,
  }).then((response) => response?.data || null);
}

export function getOptimizationSettings(settingId) {
  return authenticatedJsonRequest(`/optimization?settingId=${encodeURIComponent(settingId)}`)
    .then((response) => response?.data || null);
}

export function saveOptimizationSettings(payload) {
  return authenticatedJsonRequest('/optimization', {
    method: 'POST',
    body: payload,
  }).then((response) => response?.data || null);
}
