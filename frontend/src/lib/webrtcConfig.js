import { CHAT_CALL_TYPES } from '../../../shared/src/contracts/chat.js';

const DEFAULT_ICE_SERVERS = Object.freeze([
  Object.freeze({
    urls: 'stun:stun.relay.metered.ca:80',
  }),
  Object.freeze({
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',
    ],
    username: '3b2a44d642b81b1532d6f7e9',
    credential: 'fQA74ax484KGzd/r',
  }),
]);

function normalizeIceServerUrls(urls) {
  const normalizedUrls = Array.isArray(urls) ? urls : [urls];
  return normalizedUrls
    .map(normalizeIceServerUrl)
    .filter(Boolean);
}

function normalizeIceServerUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeIceServer(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const normalizedUrls = normalizeIceServerUrls(entry.urls);

  if (normalizedUrls.length === 0) {
    return null;
  }

  const server = {
    urls: normalizedUrls.length === 1 ? normalizedUrls[0] : normalizedUrls,
  };

  if (typeof entry.username === 'string' && entry.username.trim()) {
    server.username = entry.username.trim();
  }

  if (typeof entry.credential === 'string' && entry.credential.trim()) {
    server.credential = entry.credential.trim();
  }

  return server;
}

function parseJsonIceServers(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map(normalizeIceServer).filter(Boolean);
  } catch {
    return [];
  }
}

function parseTurnIceServers({ turnUrls, turnUsername, turnCredential }) {
  const normalizedUrls = normalizeIceServerUrls(String(turnUrls || '').split(','));

  if (normalizedUrls.length === 0) {
    return [];
  }

  return [{
    urls: normalizedUrls.length === 1 ? normalizedUrls[0] : normalizedUrls,
    username: String(turnUsername || '').trim() || undefined,
    credential: String(turnCredential || '').trim() || undefined,
  }];
}

export function resolveRtcIceServers(env = import.meta.env) {
  const configuredIceServers = parseJsonIceServers(env.VITE_WEBRTC_ICE_SERVERS);
  const turnIceServers = parseTurnIceServers({
    turnUrls: env.VITE_TURN_URLS,
    turnUsername: env.VITE_TURN_USERNAME,
    turnCredential: env.VITE_TURN_CREDENTIAL,
  });

  const servers = [...configuredIceServers, ...turnIceServers];
  if (servers.length > 0) {
    return servers;
  }

  return DEFAULT_ICE_SERVERS;
}

export function hasConfiguredTurnServers(env = import.meta.env) {
  return resolveRtcIceServers(env).some((server) => {
    const urls = normalizeIceServerUrls(server?.urls);
    return urls.some((url) => /^turns?:/i.test(url));
  });
}

export function getRtcConfigurationDiagnostics(env = import.meta.env) {
  const turnConfigured = hasConfiguredTurnServers(env);

  return {
    turnConfigured,
    transportMode: turnConfigured ? 'turn' : 'stun-fallback',
    warning: turnConfigured
      ? null
      : 'TURN nao configurado nem no ambiente nem no fallback. Chamadas 1:1 fora da rede local podem falhar.',
  };
}

export function buildRtcConfiguration(env = import.meta.env) {
  return {
    iceServers: resolveRtcIceServers(env),
  };
}

export function shouldRequestVideoForCallType(callType) {
  return callType === CHAT_CALL_TYPES.VIDEO;
}
