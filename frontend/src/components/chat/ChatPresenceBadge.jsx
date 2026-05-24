import React from 'react';
import { cn } from '@/lib/utils';
import { CHAT_PRESENCE_LABELS, CHAT_PRESENCE_STATES } from '@/hooks/useChatPresence';

const PRESENCE_COLOR_CLASS = Object.freeze({
  [CHAT_PRESENCE_STATES.ONLINE]: 'bg-emerald-500',
  [CHAT_PRESENCE_STATES.IDLE]: 'bg-amber-400',
  [CHAT_PRESENCE_STATES.OFFLINE]: 'bg-red-500',
});

export function ChatPresenceBadge({
  state = CHAT_PRESENCE_STATES.OFFLINE,
  className = '',
  ringClassName = 'ring-[rgba(15,15,30,0.97)]',
}) {
  const label = CHAT_PRESENCE_LABELS[state] || CHAT_PRESENCE_LABELS.offline;

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-2.5 w-2.5 rounded-full ring-2',
        PRESENCE_COLOR_CLASS[state] || PRESENCE_COLOR_CLASS[CHAT_PRESENCE_STATES.OFFLINE],
        ringClassName,
        className
      )}
    />
  );
}
