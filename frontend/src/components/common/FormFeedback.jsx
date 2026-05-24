// ðæÐïð╗ ËÖð╣ð▒ðÁÐÇÊÖðÁ ÐéÐâð╗ÐïÊ╗Ðïð¢Ðüð░ Whyktor GSV ð║ð¥ð╝ð┐ð░ð¢ð©ÐÅÊ╗Ðï ðÁÐéðÁÐêÐéðÁÐÇËÖ.
/**
 * src/components/common/FormFeedback.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componentes de feedback visual para formulários com estado de loading/success/error.
 *
 * Uso:
 *   <FormFeedback
 *     isLoading={isLoading}
 *     error={error}
 *     success={success}
 *     successMessage="Salvo com sucesso!"
 *   />
 */

import React from 'react';
import { AlertCircle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Exibe estado de loading/success/error em um box compacto
 */
export function FormFeedback({
  isLoading = false,
  error = null,
  success = false,
  successMessage = 'Operação realizada com sucesso!',
  className = '',
}) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border px-4 py-3 text-sm bg-[hsl(var(--feedback-info-bg))] text-[hsl(var(--feedback-info-fg))] border-[hsl(var(--feedback-info-fg)/0.14)]', className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Processando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-start gap-2 rounded-[calc(var(--radius)-4px)] border px-4 py-3 text-sm bg-[hsl(var(--feedback-danger-bg))] text-[hsl(var(--feedback-danger-fg))] border-[hsl(var(--feedback-danger-fg)/0.14)]', className)}>
        <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Erro!</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={cn('flex items-center gap-2 rounded-[calc(var(--radius)-4px)] border px-4 py-3 text-sm bg-[hsl(var(--feedback-success-bg))] text-[hsl(var(--feedback-success-fg))] border-[hsl(var(--feedback-success-fg)/0.14)]', className)}>
        <CheckCircle className="w-4 h-4" />
        <span>{successMessage}</span>
      </div>
    );
  }

  return null;
}

/**
 * Botão com feedback de loading
 */
export function SubmitButton({
  isLoading = false,
  error = null,
  success = false,
  children = 'Salvar',
  successText = 'Salvo!',
  loadingText = 'Salvando...',
  className = '',
  variant = 'default',
  ...props
}) {
  return (
    <Button
      type="submit"
      disabled={isLoading || success}
      variant={variant === 'outline' ? 'outline' : 'default'}
      className={cn(
        success && '!bg-[hsl(var(--feedback-success-fg))] !text-white',
        error && '!border-[hsl(var(--feedback-danger-fg)/0.16)] !bg-[hsl(var(--feedback-danger-bg))] !text-[hsl(var(--feedback-danger-fg))]',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText}
        </>
      ) : success ? (
        <>
          <CheckCircle className="w-4 h-4" />
          {successText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/**
 * Alert widget para feedback inline
 */
export function FormAlert({
  type = 'error',
  title = '',
  message = '',
  onDismiss = null,
  className = '',
}) {
  const variants = {
    error: {
      bg: 'bg-[hsl(var(--feedback-danger-bg))]',
      border: 'border-[hsl(var(--feedback-danger-fg)/0.14)]',
      text: 'text-[hsl(var(--feedback-danger-fg))]',
      icon: XCircle,
      iconColor: 'text-[hsl(var(--feedback-danger-fg))]',
    },
    success: {
      bg: 'bg-[hsl(var(--feedback-success-bg))]',
      border: 'border-[hsl(var(--feedback-success-fg)/0.14)]',
      text: 'text-[hsl(var(--feedback-success-fg))]',
      icon: CheckCircle,
      iconColor: 'text-[hsl(var(--feedback-success-fg))]',
    },
    warning: {
      bg: 'bg-[hsl(var(--feedback-warning-bg))]',
      border: 'border-[hsl(var(--feedback-warning-fg)/0.14)]',
      text: 'text-[hsl(var(--feedback-warning-fg))]',
      icon: AlertCircle,
      iconColor: 'text-[hsl(var(--feedback-warning-fg))]',
    },
    info: {
      bg: 'bg-[hsl(var(--feedback-info-bg))]',
      border: 'border-[hsl(var(--feedback-info-fg)/0.14)]',
      text: 'text-[hsl(var(--feedback-info-fg))]',
      icon: AlertCircle,
      iconColor: 'text-[hsl(var(--feedback-info-fg))]',
    },
  };

  const variant = variants[type] || variants.error;
  const Icon = variant.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[calc(var(--radius)-4px)] border px-4 py-3',
        variant.bg,
        variant.border,
        variant.text,
        className
      )}
    >
      <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', variant.iconColor)} />
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {message && <p className={title ? 'mt-1 text-xs' : ''}>{message}</p>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-lg hover:opacity-70"
          aria-label="Fechar alerta"
          data-tooltip="Fechar alerta"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton loader para placeholder enquanto carrega
 */
export function FormSkeleton({ fields = 3, className = '' }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded-[calc(var(--radius)-4px)] bg-accent" />
        </div>
      ))}
    </div>
  );
}
