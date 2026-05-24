import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoonStar, Move, Shield } from 'lucide-react';
import { useNow } from '@/hooks/useNow';

const PROFILE_LABELS = {
  administrador: 'Administrador',
  coordenador: 'Coordenador',
  secretario: 'Secretaria',
  professor: 'Professor',
  aluno: 'Aluno',
  responsavel: 'Responsavel',
};

const formatIdleDuration = (idleSince) => {
  if (!idleSince) return null;

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - idleSince) / 1000));

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s de inatividade`;
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  if (seconds === 0) {
    return `${minutes} min de inatividade`;
  }

  return `${minutes}m ${seconds}s de inatividade`;
};

export default function DesktopIdleOverlay({
  active,
  idleSince,
  profileType,
  user,
  onResume,
  reducedMotion = false,
}) {
  const overlayRef = useRef(null);
  const now = useNow({ enabled: active });

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;

    const frame = window.requestAnimationFrame(() => {
      overlayRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [active]);

  const userLabel = user?.user_metadata?.full_name || user?.email || 'Sessao ativa';
  const profileLabel = PROFILE_LABELS[profileType] || 'Ambiente escolar';
  const currentTime = useMemo(
    () => now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    [now]
  );
  const dateLabel = useMemo(
    () => now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    }),
    [now]
  );
  const idleDurationLabel = useMemo(
    () => formatIdleDuration(idleSince),
    [now, idleSince]
  );

  const handleResume = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onResume?.();
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: 'easeOut' }}
          className="fixed inset-0 z-[10020] overflow-hidden bg-slate-950/82 backdrop-blur-md"
        >
          <motion.div
            aria-hidden="true"
            className="absolute left-[10%] top-[12%] h-72 w-72 rounded-full bg-sky-400/18 blur-3xl"
            animate={reducedMotion ? { x: 0, y: 0, scale: 1 } : { x: [0, 28, -14, 0], y: [0, -18, 12, 0], scale: [1, 1.08, 0.96, 1] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 16, ease: 'easeInOut', repeat: Infinity }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute bottom-[14%] right-[8%] h-80 w-80 rounded-full bg-indigo-500/16 blur-3xl"
            animate={reducedMotion ? { x: 0, y: 0, scale: 1 } : { x: [0, -34, 16, 0], y: [0, 20, -10, 0], scale: [1, 0.94, 1.06, 1] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 18, ease: 'easeInOut', repeat: Infinity }}
          />

          <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label="Protetor de tela da area de trabalho"
            tabIndex={0}
            onPointerMove={handleResume}
            onPointerDown={handleResume}
            onTouchStart={handleResume}
            onWheel={handleResume}
            onKeyDown={handleResume}
            className="absolute inset-0 flex items-center justify-center px-6 py-10 outline-none"
          >
            <motion.div
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985 }}
              transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-3xl overflow-hidden rounded-[36px] border border-white/12 bg-slate-950/50 p-8 shadow-[0_28px_120px_rgba(2,6,23,0.7)] backdrop-blur-3xl sm:p-10"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200">
                    <MoonStar className="h-3.5 w-3.5 text-sky-300" />
                    Protetor de tela ativo
                  </div>
                  <div>
                    <p className="text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">{currentTime}</p>
                    <p className="mt-2 text-sm capitalize text-slate-300 sm:text-base">{dateLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      <Shield className="h-4 w-4 text-emerald-300" />
                      {profileLabel}
                    </div>
                    {idleDurationLabel && (
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                        {idleDurationLabel}
                      </div>
                    )}
                  </div>
                </div>

                <div className="max-w-sm space-y-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-slate-200">
                  <p className="text-sm font-medium text-white">{userLabel}</p>
                  <p className="text-sm leading-relaxed text-slate-300">
                    A area de trabalho foi colocada em espera por inatividade. Mova o mouse, toque na tela ou pressione qualquer tecla para voltar.
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-slate-300">
                    <Move className="h-3.5 w-3.5 text-sky-300" />
                    Retomar sessao
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
