import { getAccessTokenOrThrow } from '@/lib/supabase';
import { parseContentDispositionFilename } from '@shared/contracts/systemExport';
import { parseSystemJobResponseHeaders } from '@shared/contracts/systemEvents';

const DEFAULT_ADMIN_API_BASE = '/api/admin';
const ADMIN_API_BASE =
  import.meta.env.VITE_ADMIN_API_BASE_URL || DEFAULT_ADMIN_API_BASE;

/**
 * Gera senha temporaria forte de 16 caracteres.
 * Garante ao menos: 2 maiusculas, 2 minusculas, 2 numeros, 2 simbolos.
 */
export function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$!%&*';
  const all = upper + lower + digits + symbols;

  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Gerador criptografico indisponivel no navegador atual.');
  }

  const randomIndex = (max) => {
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;

    do {
      globalThis.crypto.getRandomValues(values);
    } while (values[0] >= limit);

    return values[0] % max;
  };

  const rand = (str) => str[randomIndex(str.length)];

  const required = [
    rand(upper), rand(upper),
    rand(lower), rand(lower),
    rand(digits), rand(digits),
    rand(symbols), rand(symbols),
  ];

  const rest = Array.from({ length: 8 }, () => rand(all));

  const password = [...required, ...rest];

  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }

  return password.join('');
}

async function getAccessToken() {
  return getAccessTokenOrThrow('Sessao expirada. Entre novamente para continuar.');
}

async function adminRequest(path, options = {}) {
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...options,
    headers,
  });

  const raw = await response.text();
  let payload = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      'Falha ao executar operacao administrativa.';
    const error = new Error(message);
    error.code = payload?.code || 'ADMIN_REQUEST_FAILED';
    error.traceId = payload?.traceId || null;
    error.statusCode = response.status;
    error.details = payload?.details || null;
    throw error;
  }

  const resolvedJob =
    parseSystemJobResponseHeaders(response.headers)
    || payload?.job
    || null;

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && resolvedJob) {
    return {
      ...payload,
      job: resolvedJob,
    };
  }

  return payload;
}

async function adminFileRequest(path, options = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const raw = await response.text();
    let payload = null;

    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    const message =
      payload?.error ||
      payload?.message ||
      'Falha ao executar operacao administrativa.';
    const error = new Error(message);
    error.code = payload?.code || 'ADMIN_REQUEST_FAILED';
    error.traceId = payload?.traceId || null;
    error.statusCode = response.status;
    error.details = payload?.details || null;
    throw error;
  }

  const blob = await response.blob();
  const filename = parseContentDispositionFilename(
    response.headers.get('Content-Disposition'),
  ) || 'download.bin';
  const job = parseSystemJobResponseHeaders(response.headers);

  if (typeof window !== 'undefined') {
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 0);
  }

  return { blob, filename, job };
}

export async function createAuthUser(email, password) {
  const payload = await adminRequest('/users', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return payload?.user ?? payload;
}

export async function createManagedProfile({
  email,
  password,
  full_name,
  profile_type,
  phone = null,
  birth_date = null,
  document_id = null,
  address = null,
  department = null,
  notes = null,
}) {
  const payload = await adminRequest('/profiles', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      full_name,
      profile_type,
      phone,
      birth_date,
      document_id,
      address,
      department,
      notes,
    }),
  });

  return payload;
}

export async function createEnrollmentWithAccess({ student, access }) {
  const payload = await adminRequest('/enrollments', {
    method: 'POST',
    body: JSON.stringify({ student, access }),
  });

  return payload;
}

export function formatAdminRequestErrorMessage(
  error,
  fallbackMessage = 'Falha ao executar operacao administrativa.'
) {
  const message = error?.message || fallbackMessage;
  return error?.traceId ? `${message} Ref: ${error.traceId}` : message;
}

export async function getAuthUserByEmail(email) {
  const payload = await adminRequest(`/users?email=${encodeURIComponent(email)}`, {
    method: 'GET',
  });

  return payload?.user ?? null;
}

export async function resetUserPassword(userId, newPassword, metadata = {}) {
  const payload = await adminRequest(`/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      password: newPassword,
      ...metadata,
    }),
  });

  return payload?.user ?? payload;
}

export async function deleteAuthUser(userId) {
  return adminRequest(`/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function deleteManagedUser({ email, profileId }) {
  const params = new URLSearchParams();

  if (email) {
    params.set('email', email.trim().toLowerCase());
  }

  if (profileId) {
    params.set('profileId', profileId);
  }

  if (!params.toString()) {
    throw new Error('Email ou profileId sao obrigatorios para excluir o usuario.');
  }

  return adminRequest(`/users?${params.toString()}`, {
    method: 'DELETE',
  });
}

export async function downloadSystemExport({ format = 'xlsx', dataset = null } = {}) {
  const params = new URLSearchParams();
  params.set('format', format);

  if (dataset) {
    params.set('dataset', dataset);
  }

  return adminFileRequest(`/system-export?${params.toString()}`, {
    method: 'GET',
  });
}
