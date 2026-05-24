import { supabase } from '@/lib/supabase';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function formatRpcError(error, fallbackMessage) {
  if (!error) return new Error(fallbackMessage);

  const parts = [
    error.message,
    error.details,
    error.hint,
    error.code ? `Código: ${error.code}` : null,
  ].filter(Boolean);

  return new Error(parts.length > 0 ? parts.join(' | ') : fallbackMessage);
}

export function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue) return null;

  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const [hours = '00', minutes = '00'] = normalizeString(timeValue).split(':');
  const next = new Date(date);
  next.setHours(Number.parseInt(hours, 10) || 0, Number.parseInt(minutes, 10) || 0, 0, 0);
  return next.toISOString();
}

export async function requestStudentPhotoChange({
  profileId,
  userEmail,
  fullName,
  currentAvatarUrl = null,
  requestedAvatarUrl,
}) {
  if (!profileId) {
    throw new Error('Perfil do aluno nao encontrado para enviar a solicitacao.');
  }

  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) {
    throw new Error('E-mail do aluno e obrigatorio para enviar a solicitacao.');
  }

  const normalizedRequestedAvatarUrl = normalizeString(requestedAvatarUrl);
  if (!normalizedRequestedAvatarUrl) {
    throw new Error('Escolha uma imagem valida antes de enviar a solicitacao.');
  }

  const { data, error } = await supabase.rpc('student_request_photo_change', {
    p_student_profile_id: profileId,
    p_student_email: normalizedEmail,
    p_student_name: normalizeString(fullName) || null,
    p_current_avatar_url: normalizeString(currentAvatarUrl) || null,
    p_requested_avatar_url: normalizedRequestedAvatarUrl,
  });

  if (error) {
    throw formatRpcError(error, 'Falha ao solicitar a foto do aluno.');
  }

  return data;
}

export async function reviewStudentPhotoRequest({
  requestId,
  action,
  denialReason = null,
  nextAllowedAt = null,
  reviewerEmail = null,
  reviewerName = null,
}) {
  if (!requestId) {
    throw new Error('Solicitacao invalida para revisao.');
  }

  const normalizedAction = normalizeString(action);
  if (!normalizedAction) {
    throw new Error('Ação de revisão invalida.');
  }

  const { data, error } = await supabase.rpc('admin_review_student_photo_request', {
    p_request_id: requestId,
    p_action: normalizedAction,
    p_denial_reason: normalizeString(denialReason) || null,
    p_next_allowed_at: nextAllowedAt || null,
    p_reviewer_email: normalizeEmail(reviewerEmail) || null,
    p_reviewer_name: normalizeString(reviewerName) || null,
  });

  if (error) {
    throw formatRpcError(error, 'Falha ao revisar a solicitação de foto.');
  }

  return data;
}
