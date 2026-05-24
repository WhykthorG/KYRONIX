let realtimeChannelSequence = 0;

export function createRealtimeChannelName(baseName = 'realtime-channel') {
  realtimeChannelSequence += 1;

  const normalizedBaseName = String(baseName).trim() || 'realtime-channel';
  const uniqueSuffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${realtimeChannelSequence}`;

  return `${normalizedBaseName}-${uniqueSuffix}`;
}
