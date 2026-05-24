// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import { getAccessTokenOrThrow, supabase } from '@/lib/supabase';

async function getAccessToken() {
  return getAccessTokenOrThrow('Sessao autenticada nao encontrada.');
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'x-supabase-access-token': accessToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || 'Falha na API de chat.');
    error.statusCode = response.status;
    error.code = payload?.code || null;
    throw error;
  }

  return payload;
}

export async function createChatUploadUrl(payload) {
  return apiFetch('/api/chat/media-url', {
    method: 'POST',
    body: {
      ...payload,
      action: 'upload',
    },
  });
}

export async function listChatConversations() {
  return apiFetch('/api/chat/conversations', {
    method: 'GET',
  });
}

export async function createChatConversation(payload) {
  return apiFetch('/api/chat/conversations', {
    method: 'POST',
    body: payload,
  });
}

export async function createChatDownloadUrl(payload) {
  return apiFetch('/api/chat/media-url', {
    method: 'POST',
    body: {
      ...payload,
      action: 'download',
    },
  });
}

export async function uploadChatMedia({ file, bucket, conversationId }) {
  const uploadData = await createChatUploadUrl({
    bucket,
    conversationId,
    fileName: file?.name || 'audio.webm',
    contentType: file?.type || 'application/octet-stream',
  });

  const { data, error } = await supabase.storage
    .from(uploadData.bucket)
    .uploadToSignedUrl(uploadData.path, uploadData.token, file, {
      contentType: file?.type || undefined,
    });

  if (error || !data?.path) {
    throw new Error(error?.message || 'Falha ao enviar a midia do chat.');
  }

  return {
    bucket: uploadData.bucket,
    path: uploadData.path,
  };
}

export async function startChatCall(payload) {
  return apiFetch('/api/chat/calls/start', {
    method: 'POST',
    body: payload,
  });
}

export async function joinChatCall(callId) {
  return apiFetch(`/api/chat/calls/${encodeURIComponent(callId)}/join`, {
    method: 'POST',
  });
}

export async function endChatCall(callId, payload = {}) {
  return apiFetch(`/api/chat/calls/${encodeURIComponent(callId)}/end`, {
    method: 'POST',
    body: payload,
  });
}

export async function sendChatSignal(callId, payload) {
  return apiFetch(`/api/chat/calls/${encodeURIComponent(callId)}/signals`, {
    method: 'POST',
    body: payload,
  });
}

export async function listChatRecordings(callId) {
  return apiFetch(`/api/chat/calls/${encodeURIComponent(callId)}/recordings`, {
    method: 'GET',
  });
}

export async function registerChatRecording(callId, payload) {
  return apiFetch(`/api/chat/calls/${encodeURIComponent(callId)}/recordings`, {
    method: 'POST',
    body: payload,
  });
}
