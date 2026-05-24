// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Inbox,
  Loader2,
  RefreshCw,
  Sparkles,
  WifiOff,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const toneClasses = {
  success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  info: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
  neutral: 'border-white/10 bg-white/6 text-white/85',
};

function SectionCard({ className, children, ...props }) {
  return (
    <section
      {...props}
      className={cn(
        'rounded-[30px] border border-white/10 bg-white/7 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.22)] backdrop-blur-2xl',
        className
      )}
    >
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <SectionCard
      role="status"
      aria-live="polite"
      className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-white/8 text-white/90">
        <Icon className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-sm leading-6 text-white/70">{description}</p>
      </div>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/14"
        >
          {actionLabel}
        </button>
      ) : null}
    </SectionCard>
  );
}

function LoadingState() {
  return (
    <SectionCard role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <div className="flex items-center gap-3 text-white/80">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm font-medium">Sincronizando a visão simulada do módulo</p>
      </div>

      <div className="grid gap-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="animate-pulse rounded-[24px] border border-white/10 bg-white/6 p-4"
          >
            <div className="h-3 w-24 rounded-full bg-white/10" />
            <div className="mt-4 h-8 w-2/3 rounded-full bg-white/12" />
            <div className="mt-3 h-3 w-full rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-5/6 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default function MobileModuleView({
  module,
  viewer,
  visualState = 'content',
  isOffline = false,
  onCycleState,
  onSetState,
}) {
  const Icon = module.icon;

  if (visualState === 'loading') {
    return <LoadingState />;
  }

  if (visualState === 'empty') {
    return (
      <EmptyState
        icon={Inbox}
        title="Nenhum conteúdo disponível no momento"
        description="Este módulo está pronto para integração real. Enquanto isso, o shell exibe o estado vazio para validar hierarquia, espaçamento e ações touch-first."
        actionLabel="Popular cenário"
        onAction={() => onSetState('content')}
      />
    );
  }

  if (visualState === 'error') {
    return (
      <SectionCard role="alert" aria-live="assertive" className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-rose-300/20 bg-rose-500/12 text-rose-100">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">Falha simulada de carregamento</h3>
          <p className="text-sm leading-6 text-white/70">
            A interface já está preparada para estados de erro, recuperação e retomada elegante sem depender do backend final nesta etapa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSetState('content')}
          className="inline-flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/14"
        >
          Tentar novamente
        </button>
      </SectionCard>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="space-y-4"
    >
      <SectionCard className="overflow-hidden">
        <div className="relative">
          <div className="absolute inset-x-0 -top-10 h-36 rounded-full bg-[var(--mobile-accent-soft)]/18 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[24px] border border-white/12 shadow-[var(--mobile-accent-glow)]"
              style={{ backgroundColor: module.bgColor }}
            >
              {Icon ? <Icon className="h-7 w-7" style={{ color: module.iconColor }} /> : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                {module.eyebrow}
              </p>
              <h2 className="mt-2 text-[1.45rem] font-semibold leading-tight text-white">
                {module.heroTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/72">{module.heroCopy}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {module.integrationStatus === 'manifest-connected' ? 'Manifest conectado' : 'Mock visual'}
            </span>
            <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Viewer: {viewer.role}
            </span>
            {isOffline ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/15 bg-amber-500/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                <WifiOff className="h-3.5 w-3.5" />
                Offline simulado
              </span>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-3 gap-3">
        {module.metrics.map((metric) => (
          <SectionCard key={metric.label} className={cn('p-3.5', toneClasses[metric.tone] || toneClasses.neutral)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-current/70">
              {metric.label}
            </p>
            <p className="mt-3 text-2xl font-semibold text-current">{metric.value}</p>
            <p className="mt-2 text-xs leading-5 text-current/75">{metric.detail}</p>
          </SectionCard>
        ))}
      </div>

      <SectionCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              Estado visual
            </p>
            <h3 className="mt-2 text-base font-semibold text-white">Feedbacks simulados do módulo</h3>
          </div>
          <button
            type="button"
            onClick={onCycleState}
            className="inline-flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80 transition-colors hover:bg-white/12"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Alternar estado
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {['content', 'loading', 'empty', 'error'].map((stateKey) => (
            <button
              key={stateKey}
              type="button"
              onClick={() => onSetState(stateKey)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
                visualState === stateKey
                  ? 'border-white/20 bg-white/15 text-white'
                  : 'border-white/10 bg-white/6 text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              {stateKey}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
        <SectionCard>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
            Leituras rápidas
          </p>
          <div className="mt-4 space-y-3">
            {module.feed.map((item) => (
              <div
                key={`${module.id}-${item.title}`}
                className="rounded-[22px] border border-white/10 bg-white/6 p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  {item.eyebrow}
                </p>
                <h4 className="mt-2 text-sm font-semibold text-white">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-white/72">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
            Próximas ações
          </p>
          <div className="mt-4 space-y-3">
            {module.actions.map((action) => (
              <button
                key={`${module.id}-${action.label}`}
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-[22px] border border-white/10 bg-white/6 p-4 text-left transition-colors hover:bg-white/10"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{action.label}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{action.detail}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-white/50" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/10 bg-white/8 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Pronto para integração real</h3>
          <p className="mt-2 text-sm leading-6 text-white/70">
            O shell mantém `appId`, `page` e `integrationStatus` para trocar esta visão mock pela tela real do ERP no momento certo, sem reescrever a navegação mobile.
          </p>
        </div>
      </SectionCard>
    </motion.div>
  );
}
