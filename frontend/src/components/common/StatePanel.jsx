// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import React from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Inbox,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const VARIANT_MAP = {
  loading: {
    eyebrow: 'Carregando',
    icon: Loader2,
    iconClassName: 'animate-spin bg-[hsl(var(--feedback-info-bg))] text-[hsl(var(--feedback-info-fg))]',
    role: 'status',
  },
  error: {
    eyebrow: 'Erro',
    icon: AlertTriangle,
    iconClassName: 'bg-[hsl(var(--feedback-danger-bg))] text-[hsl(var(--feedback-danger-fg))]',
    role: 'alert',
  },
  empty: {
    eyebrow: 'Sem resultados',
    icon: Inbox,
    iconClassName: 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
    role: 'status',
  },
  success: {
    eyebrow: 'Concluido',
    icon: BadgeCheck,
    iconClassName: 'bg-[hsl(var(--feedback-success-bg))] text-[hsl(var(--feedback-success-fg))]',
    role: 'status',
  },
};

export default function StatePanel({
  variant = 'empty',
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'default',
  compact = false,
  icon: CustomIcon,
  className,
}) {
  const config = VARIANT_MAP[variant] ?? VARIANT_MAP.empty;
  const Icon = CustomIcon ?? config.icon;

  return (
    <div
      role={config.role}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'app-state-panel',
        compact && 'app-state-panel--compact',
        className
      )}
    >
      <div className={cn('app-state-panel__icon', config.iconClassName)}>
        <Icon className="h-6 w-6" />
      </div>

      <div className="space-y-2">
        <p className="app-state-panel__eyebrow">{config.eyebrow}</p>
        <h3 className="app-state-panel__title">{title}</h3>
        {description ? (
          <p className="app-state-panel__description">{description}</p>
        ) : null}
      </div>

      {actionLabel && onAction ? (
        <div className="app-state-panel__actions">
          <Button variant={actionVariant} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
