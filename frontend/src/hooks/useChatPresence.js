// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_IDLE_TIMEOUT_MS, useUserInactivity } from '@/hooks/useUserInactivity';

export const CHAT_PRESENCE_STATES = Object.freeze({
  ONLINE: 'online',
  IDLE: 'idle',
  OFFLINE: 'offline',
});

export const CHAT_PRESENCE_LABELS = Object.freeze({
  [CHAT_PRESENCE_STATES.ONLINE]: 'Online',
  [CHAT_PRESENCE_STATES.IDLE]: 'Ocioso',
  [CHAT_PRESENCE_STATES.OFFLINE]: 'Offline',
});

const DEFAULT_PRESENCE = Object.freeze({
  state: CHAT_PRESENCE_STATES.OFFLINE,
  lastActiveAt: null,
});

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toPresenceEntries(entry) {
  if (Array.isArray(entry)) {
    return entry;
  }

  if (Array.isArray(entry?.metas)) {
    return entry.metas;
  }

  return [];
}

function resolvePresenceState(entries) {
  const normalizedEntries = entries.filter(Boolean);
  if (normalizedEntries.length === 0) {
    return DEFAULT_PRESENCE;
  }

  const hasOnline = normalizedEntries.some((entry) => entry.status === CHAT_PRESENCE_STATES.ONLINE);
  const hasIdle = normalizedEntries.some((entry) => entry.status === CHAT_PRESENCE_STATES.IDLE);
  const sortedLastActiveAt = normalizedEntries
    .map((entry) => entry.lastActiveAt || null)
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

  return {
    state: hasOnline
      ? CHAT_PRESENCE_STATES.ONLINE
      : hasIdle
        ? CHAT_PRESENCE_STATES.IDLE
        : CHAT_PRESENCE_STATES.OFFLINE,
    lastActiveAt: sortedLastActiveAt[0] || null,
  };
}

function buildPresenceMap(rawState) {
  const nextMap = new Map();

  Object.values(rawState || {}).forEach((entry) => {
    const metas = toPresenceEntries(entry);
    if (metas.length === 0) return;

    const userEmail = normalizeEmail(metas[0]?.userEmail);
    if (!userEmail) return;

    nextMap.set(userEmail, resolvePresenceState(metas));
  });

  return nextMap;
}

function buildChatPresenceChannelName(tenantId = null) {
  return `chat-presence:${tenantId || 'global'}`;
}

export function formatGroupPresenceSummary(summary) {
  const onlineLabel = `${summary.onlineCount} online`;
  const idleLabel = `${summary.idleCount} ocioso${summary.idleCount === 1 ? '' : 's'}`;

  if (summary.onlineCount === 0 && summary.idleCount === 0) {
    return summary.offlineCount > 0 ? 'Todos offline' : 'Sem presenca';
  }

  if (summary.onlineCount > 0 && summary.idleCount > 0) {
    return `${onlineLabel} • ${idleLabel}`;
  }

  return summary.onlineCount > 0 ? onlineLabel : idleLabel;
}

export function useChatPresence({
  currentUser,
  currentProfileType = null,
  tenantId = null,
  disabled = false,
} = {}) {
  const normalizedCurrentUserEmail = useMemo(
    () => normalizeEmail(currentUser?.email),
    [currentUser?.email]
  );
  const [presenceByEmail, setPresenceByEmail] = useState(() => new Map());
  const [isPresenceReady, setIsPresenceReady] = useState(false);
  const channelRef = useRef(null);
  const channelNameRef = useRef(null);
  const isTrackedRef = useRef(false);
  const isIdleRef = useRef(false);
  const { isIdle } = useUserInactivity({
    timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    disabled: disabled || !normalizedCurrentUserEmail,
  });

  useEffect(() => {
    isIdleRef.current = isIdle;
  }, [isIdle]);

  const syncPresenceState = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    setPresenceByEmail(buildPresenceMap(channel.presenceState()));
  }, []);

  const trackPresenceState = useCallback(async (state) => {
    const channel = channelRef.current;
    if (!channel || !normalizedCurrentUserEmail) {
      return;
    }

    await channel.track({
      userEmail: normalizedCurrentUserEmail,
      profileType: currentProfileType || null,
      status: state,
      lastActiveAt: new Date().toISOString(),
    });
    isTrackedRef.current = true;
  }, [currentProfileType, normalizedCurrentUserEmail]);

  useEffect(() => {
    if (disabled || !normalizedCurrentUserEmail) {
      setPresenceByEmail(new Map());
      setIsPresenceReady(false);
      return undefined;
    }

    const channelName = buildChatPresenceChannelName(tenantId);
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: normalizedCurrentUserEmail,
        },
      },
    });

    channelRef.current = channel;
    channelNameRef.current = channelName;
    isTrackedRef.current = false;
    setIsPresenceReady(false);

    channel
      .on('presence', { event: 'sync' }, () => {
        syncPresenceState();
        setIsPresenceReady(true);
      })
      .on('presence', { event: 'join' }, syncPresenceState)
      .on('presence', { event: 'leave' }, syncPresenceState)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await trackPresenceState(
          isIdleRef.current ? CHAT_PRESENCE_STATES.IDLE : CHAT_PRESENCE_STATES.ONLINE
        );
        syncPresenceState();
        setIsPresenceReady(true);
      });

    return () => {
      const activeChannel = channelRef.current;
      if (activeChannel && channelNameRef.current === channelName) {
        activeChannel.untrack().catch(() => {});
        supabase.removeChannel(activeChannel);
      }
      channelRef.current = null;
      channelNameRef.current = null;
      isTrackedRef.current = false;
      setPresenceByEmail(new Map());
      setIsPresenceReady(false);
    };
  }, [disabled, normalizedCurrentUserEmail, syncPresenceState, tenantId, trackPresenceState]);

  useEffect(() => {
    if (!isTrackedRef.current) {
      return;
    }

    trackPresenceState(isIdle ? CHAT_PRESENCE_STATES.IDLE : CHAT_PRESENCE_STATES.ONLINE).catch(() => {});
  }, [isIdle, trackPresenceState]);

  const getPresenceForEmail = useCallback((email) => {
    const normalizedEmailValue = normalizeEmail(email);
    if (!normalizedEmailValue) {
      return DEFAULT_PRESENCE;
    }

    return presenceByEmail.get(normalizedEmailValue) || DEFAULT_PRESENCE;
  }, [presenceByEmail]);

  const getConversationPresenceSummary = useCallback((participantEmails = [], currentUserEmail = '') => {
    const normalizedCurrentEmail = normalizeEmail(currentUserEmail);
    const uniqueEmails = [...new Set(
      participantEmails
        .map((email) => normalizeEmail(email))
        .filter((email) => email && email !== normalizedCurrentEmail)
    )];

    return uniqueEmails.reduce((summary, email) => {
      const presence = getPresenceForEmail(email);
      if (presence.state === CHAT_PRESENCE_STATES.ONLINE) {
        summary.onlineCount += 1;
      } else if (presence.state === CHAT_PRESENCE_STATES.IDLE) {
        summary.idleCount += 1;
      } else {
        summary.offlineCount += 1;
      }
      return summary;
    }, { onlineCount: 0, idleCount: 0, offlineCount: 0 });
  }, [getPresenceForEmail]);

  return {
    isPresenceReady,
    presenceByEmail,
    getPresenceForEmail,
    getConversationPresenceSummary,
  };
}
