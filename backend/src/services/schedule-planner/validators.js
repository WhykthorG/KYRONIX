// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import { createApiError } from '../../database/supabaseAdminServer.js';

export function requireSettingId(value, traceId) {
  const settingId = typeof value === 'string' ? value.trim() : '';
  if (!settingId) {
    throw createApiError('settingId é obrigatório.', {
      statusCode: 400,
      code: 'SCHEDULE_SETTING_ID_REQUIRED',
      traceId,
    });
  }

  return settingId;
}

export function requireId(value, name, traceId) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) {
    throw createApiError(`${name} é obrigatório.`, {
      statusCode: 400,
      code: 'SCHEDULE_IDENTIFIER_REQUIRED',
      traceId,
    });
  }

  return id;
}

export function requireArray(value, name, traceId) {
  if (!Array.isArray(value) || value.length === 0) {
    throw createApiError(`${name} é obrigatório.`, {
      statusCode: 400,
      code: 'SCHEDULE_ARRAY_REQUIRED',
      traceId,
    });
  }

  return value;
}

export function normalizeVersionAction(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
