import test from 'node:test';
import assert from 'node:assert/strict';

import { CHAT_CALL_RINGING_TIMEOUT_MS, CHAT_CALL_STATUSES } from '../shared/src/contracts/chat.js';
import {
  buildRtcConfiguration,
  getRtcConfigurationDiagnostics,
  hasConfiguredTurnServers,
  resolveRtcIceServers,
} from '../frontend/src/lib/webrtcConfig.js';
import { chatCallEndSchema } from '../backend/src/middlewares/requestSchemas.js';
import { shouldTimeoutRingingCall } from '../backend/src/services/chatServer.js';

test('resolveRtcIceServers prefers configured TURN servers when provided', () => {
  const iceServers = resolveRtcIceServers({
    VITE_TURN_URLS: 'turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp',
    VITE_TURN_USERNAME: 'turn-user',
    VITE_TURN_CREDENTIAL: 'turn-password',
  });

  assert.equal(iceServers.length, 1);
  assert.deepEqual(iceServers[0], {
    urls: [
      'turn:turn.example.com:3478?transport=udp',
      'turns:turn.example.com:5349?transport=tcp',
    ],
    username: 'turn-user',
    credential: 'turn-password',
  });
});

test('buildRtcConfiguration falls back to STUN when no TURN/ICE override is configured', () => {
  const configuration = buildRtcConfiguration({});

  assert.equal(Array.isArray(configuration.iceServers), true);
  assert.equal(configuration.iceServers.length, 2);
  assert.deepEqual(configuration.iceServers[0], {
    urls: 'stun:stun.relay.metered.ca:80',
  });
  assert.deepEqual(configuration.iceServers[1], {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',
    ],
    username: '3b2a44d642b81b1532d6f7e9',
    credential: 'fQA74ax484KGzd/r',
  });
});

test('hasConfiguredTurnServers detects TURN entries from embedded fallback', () => {
  assert.equal(hasConfiguredTurnServers({}), true);
});

test('hasConfiguredTurnServers detects TURN entries from VITE_TURN_URLS', () => {
  assert.equal(hasConfiguredTurnServers({
    VITE_TURN_URLS: 'turn:global.relay.metered.ca:80,turns:global.relay.metered.ca:443?transport=tcp',
    VITE_TURN_USERNAME: 'metered-user',
    VITE_TURN_CREDENTIAL: 'metered-secret',
  }), true);
});

test('getRtcConfigurationDiagnostics reports TURN mode when fallback is available', () => {
  const diagnostics = getRtcConfigurationDiagnostics({});

  assert.equal(diagnostics.turnConfigured, true);
  assert.equal(diagnostics.transportMode, 'turn');
  assert.equal(diagnostics.warning, null);
});

test('shouldTimeoutRingingCall only expires stale ringing sessions', () => {
  const now = Date.now();

  assert.equal(shouldTimeoutRingingCall({
    status: CHAT_CALL_STATUSES.RINGING,
    started_at: new Date(now - CHAT_CALL_RINGING_TIMEOUT_MS - 1_000).toISOString(),
  }, now), true);

  assert.equal(shouldTimeoutRingingCall({
    status: CHAT_CALL_STATUSES.RINGING,
    started_at: new Date(now - 5_000).toISOString(),
  }, now), false);

  assert.equal(shouldTimeoutRingingCall({
    status: CHAT_CALL_STATUSES.ACTIVE,
    started_at: new Date(now - CHAT_CALL_RINGING_TIMEOUT_MS - 1_000).toISOString(),
  }, now), false);
});

test('chatCallEndSchema accepts explicit call terminal statuses', () => {
  const declined = chatCallEndSchema.safeParse({ status: CHAT_CALL_STATUSES.DECLINED });
  const missed = chatCallEndSchema.safeParse({ status: CHAT_CALL_STATUSES.MISSED });
  const failed = chatCallEndSchema.safeParse({ status: CHAT_CALL_STATUSES.FAILED });

  assert.equal(declined.success, true);
  assert.equal(missed.success, true);
  assert.equal(failed.success, true);
});
