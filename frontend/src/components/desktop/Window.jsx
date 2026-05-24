import React, { useCallback, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { useWindowDrag } from '@/hooks/useWindowDrag';

const PREVIEW_CAPTURE_DEBOUNCE_MS = 260;
const PREVIEW_CAPTURE_MIN_INTERVAL_MS = 1400;
const PREVIEW_CAPTURE_MAX_WIDTH = 300;
const PREVIEW_CAPTURE_MAX_HEIGHT = 180;
const MIN_WINDOW_WIDTH = 420;
const MIN_WINDOW_HEIGHT = 300;
const WINDOW_FEEDBACK_IDLE = {
  x: 0,
  y: 0,
  scale: 1,
  filter: 'brightness(1)',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
};
const WINDOW_RESIZE_HANDLES = {
  top: true,
  right: true,
  bottom: true,
  left: true,
  topRight: true,
  bottomRight: true,
  bottomLeft: true,
  topLeft: true,
};

const WINDOW_RESIZE_HANDLE_STYLES = {
  top: { top: -5, left: 14, right: 14, height: 10, cursor: 'ns-resize' },
  right: { top: 14, right: -5, bottom: 14, width: 10, cursor: 'ew-resize' },
  bottom: { bottom: -5, left: 14, right: 14, height: 10, cursor: 'ns-resize' },
  left: { top: 14, left: -5, bottom: 14, width: 10, cursor: 'ew-resize' },
  topRight: { top: -6, right: -6, width: 16, height: 16, cursor: 'nesw-resize' },
  bottomRight: { bottom: -6, right: -6, width: 16, height: 16, cursor: 'nwse-resize' },
  bottomLeft: { bottom: -6, left: -6, width: 16, height: 16, cursor: 'nesw-resize' },
  topLeft: { top: -6, left: -6, width: 16, height: 16, cursor: 'nwse-resize' },
};

const WINDOW_RESIZE_HANDLE_CLASSES = {
  top: 'after:absolute after:left-8 after:right-8 after:top-1/2 after:h-px after:-translate-y-1/2 after:rounded-full after:bg-white/0 group-hover/window:after:bg-white/25',
  right: 'after:absolute after:bottom-8 after:right-1/2 after:top-8 after:w-px after:translate-x-1/2 after:rounded-full after:bg-white/0 group-hover/window:after:bg-white/25',
  bottom: 'after:absolute after:bottom-1/2 after:left-8 after:right-8 after:h-px after:translate-y-1/2 after:rounded-full after:bg-white/0 group-hover/window:after:bg-white/25',
  left: 'after:absolute after:bottom-8 after:left-1/2 after:top-8 after:w-px after:-translate-x-1/2 after:rounded-full after:bg-white/0 group-hover/window:after:bg-white/25',
  topRight: 'after:absolute after:right-1 after:top-1 after:h-2.5 after:w-2.5 after:rounded-sm after:border-r after:border-t after:border-white/0 group-hover/window:after:border-white/35',
  bottomRight: 'after:absolute after:bottom-1 after:right-1 after:h-2.5 after:w-2.5 after:rounded-sm after:border-b after:border-r after:border-white/0 group-hover/window:after:border-white/35',
  bottomLeft: 'after:absolute after:bottom-1 after:left-1 after:h-2.5 after:w-2.5 after:rounded-sm after:border-b after:border-l after:border-white/0 group-hover/window:after:border-white/35',
  topLeft: 'after:absolute after:left-1 after:top-1 after:h-2.5 after:w-2.5 after:rounded-sm after:border-l after:border-t after:border-white/0 group-hover/window:after:border-white/35',
};

const WINDOW_SNAP_FEEDBACK_ANIMATIONS = {
  left: {
    x: [-10, 0],
    scale: [1, 0.992, 1],
    filter: ['brightness(1)', 'brightness(1.055)', 'brightness(1)'],
    boxShadow: [
      '0 24px 60px rgba(15, 23, 42, 0.24)',
      '0 0 0 1px rgba(125, 211, 252, 0.24), 0 26px 68px rgba(14, 165, 233, 0.20)',
      '0 24px 60px rgba(15, 23, 42, 0.24)',
    ],
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1], times: [0, 0.42, 1] },
  },
  right: {
    x: [10, 0],
    scale: [1, 0.992, 1],
    filter: ['brightness(1)', 'brightness(1.055)', 'brightness(1)'],
    boxShadow: [
      '0 24px 60px rgba(15, 23, 42, 0.24)',
      '0 0 0 1px rgba(129, 140, 248, 0.22), 0 26px 68px rgba(99, 102, 241, 0.20)',
      '0 24px 60px rgba(15, 23, 42, 0.24)',
    ],
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1], times: [0, 0.42, 1] },
  },
  maximized: {
    y: [-8, 0],
    scale: [1, 0.997, 1],
    filter: ['brightness(1)', 'brightness(1.045)', 'brightness(1)'],
    boxShadow: [
      '0 24px 60px rgba(15, 23, 42, 0.24)',
      '0 0 0 1px rgba(191, 219, 254, 0.22), 0 28px 76px rgba(59, 130, 246, 0.18)',
      '0 24px 60px rgba(15, 23, 42, 0.24)',
    ],
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1], times: [0, 0.46, 1] },
  },
};

const WINDOW_SNAP_FEEDBACK_OVERLAYS = {
  left: 'bg-gradient-to-r from-sky-400/18 via-sky-200/10 to-transparent',
  right: 'bg-gradient-to-l from-indigo-400/18 via-indigo-200/10 to-transparent',
  maximized: 'bg-gradient-to-b from-white/25 via-sky-100/8 to-transparent',
};

const WINDOW_SNAP_FEEDBACK_ACCENTS = {
  left: 'left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-sky-300/90 shadow-[0_0_18px_rgba(56,189,248,0.45)]',
  right: 'right-0 top-4 bottom-4 w-[3px] rounded-l-full bg-indigo-300/90 shadow-[0_0_18px_rgba(129,140,248,0.42)]',
  maximized: 'left-10 right-10 top-0 h-[3px] rounded-b-full bg-sky-200/90 shadow-[0_0_18px_rgba(147,197,253,0.45)]',
};

const WINDOW_SNAP_FEEDBACK_TITLEBAR_GLOWS = {
  left: 'bg-gradient-to-r from-sky-300/18 via-sky-100/10 to-transparent',
  right: 'bg-gradient-to-l from-indigo-300/18 via-indigo-100/10 to-transparent',
  maximized: 'bg-gradient-to-b from-white/16 via-sky-200/6 to-transparent',
};

const WINDOW_SNAP_PREVIEW_SURFACES = {
  left: 'border-sky-200/28 bg-sky-300/[0.08] shadow-[inset_0_0_0_1px_rgba(186,230,253,0.12),0_24px_60px_rgba(14,165,233,0.10)]',
  right: 'border-indigo-200/28 bg-indigo-300/[0.08] shadow-[inset_0_0_0_1px_rgba(199,210,254,0.12),0_24px_60px_rgba(99,102,241,0.10)]',
  maximized: 'border-sky-100/30 bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.14),0_26px_70px_rgba(59,130,246,0.10)]',
};

const WINDOW_SNAP_PREVIEW_INNERS = {
  left: 'bg-gradient-to-br from-sky-200/10 via-sky-100/5 to-transparent',
  right: 'bg-gradient-to-bl from-indigo-200/10 via-indigo-100/5 to-transparent',
  maximized: 'bg-gradient-to-b from-white/14 via-sky-100/5 to-transparent',
};

const WINDOW_SNAP_PREVIEW_ACCENTS = {
  left: 'left-0 top-6 bottom-6 w-[3px] rounded-r-full bg-sky-200/85',
  right: 'right-0 top-6 bottom-6 w-[3px] rounded-l-full bg-indigo-200/85',
  maximized: 'left-14 right-14 top-0 h-[3px] rounded-b-full bg-sky-100/85',
};

const windowPreviewSnapshotStore = new Map();
const windowPreviewCaptureRequestStore = new Map();
let html2canvasLoader = null;
const WINDOW_PREVIEW_UPDATED_EVENT = 'window-preview-updated';

const getStoredState = (id) => {
  try { return JSON.parse(localStorage.getItem(`win_${id}`)) || {}; }
  catch { return {}; }
};

const saveState = (id, state) => {
  try { localStorage.setItem(`win_${id}`, JSON.stringify(state)); } catch {}
};

const loadHtml2canvas = async () => {
  if (!html2canvasLoader) {
    html2canvasLoader = import('html2canvas').then((module) => module.default);
  }

  return html2canvasLoader;
};

const warmHtml2canvasLoader = () => {
  void loadHtml2canvas().catch(() => {});
};

const getEscapedSelectorValue = (value) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(String(value));
  }

  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const getPreviewOptOutMeta = (root) => {
  if (!root) return null;

  const optOutElement = (
    root.matches?.('[data-window-preview-optout="true"]')
      ? root
      : root.querySelector?.('[data-window-preview-optout="true"]')
  ) || null;

  if (!optOutElement) return null;

  return {
    reason:
      optOutElement.getAttribute('data-window-preview-optout-reason')
      || 'Miniatura indisponivel para conteudo interativo em tempo real.',
  };
};

export function getWindowPreviewSnapshot(windowId) {
  return windowPreviewSnapshotStore.get(windowId) || null;
}

export function requestWindowPreviewCapture(windowId, delay = PREVIEW_CAPTURE_DEBOUNCE_MS) {
  const scheduleCapture = windowPreviewCaptureRequestStore.get(windowId);
  if (!scheduleCapture) return false;

  scheduleCapture(delay);
  return true;
}

const emitWindowPreviewUpdated = (windowId) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(WINDOW_PREVIEW_UPDATED_EVENT, {
    detail: { windowId },
  }));
};

const setWindowPreviewSnapshot = (windowId, snapshot) => {
  windowPreviewSnapshotStore.set(windowId, snapshot);
  emitWindowPreviewUpdated(windowId);
};

const clearWindowPreviewSnapshot = (windowId) => {
  windowPreviewSnapshotStore.delete(windowId);
  emitWindowPreviewUpdated(windowId);
};

export default function Window({
  id,
  title,
  icon: Icon,
  iconColor,
  children,
  onClose,
  onMinimize,
  onFocus,
  zIndex,
  isFocused = false,
  minimized,
  boundsRef,
  keyboardSnapRequest,
  onKeyboardSnapHandled,
  reducedMotion = false,
  disableWindowPreviews = false,
}) {
  const stored = getStoredState(id);
  const windowRef = useRef(null);
  const windowBodyRef = useRef(null);
  const captureTimeoutRef = useRef(null);
  const captureInFlightRef = useRef(false);
  const lastCaptureAtRef = useRef(0);
  const minimizedRef = useRef(minimized);
  const snapAnimationControls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = Boolean(prefersReducedMotion || reducedMotion);
  const {
    pos,
    size,
    isMaximized,
    isResizing,
    isDragging,
    snapMode,
    snapFeedback,
    snapPreview,
    handleDrag,
    handleDragStart,
    handleResize,
    handleResizeStart,
    handleDragStop,
    handleResizeStop,
    snapWindow,
    toggleMaximize,
  } = useWindowDrag({
    initialPosition: stored.pos || { x: 60 + (zIndex % 10) * 30, y: 40 + (zIndex % 8) * 25 },
    initialSize: stored.size || { width: 900, height: 580 },
    defaultMaximized: true,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    getBoundsRect: () => boundsRef?.current?.getBoundingClientRect() ?? null,
    persistState: (nextPos, nextSize) => saveState(id, { pos: nextPos, size: nextSize }),
  });

  useEffect(() => {
    if (!keyboardSnapRequest || keyboardSnapRequest.windowId !== id || minimized) {
      return;
    }

    onFocus?.();
    snapWindow(keyboardSnapRequest.mode);
    onKeyboardSnapHandled?.();
  }, [id, keyboardSnapRequest, minimized, onFocus, onKeyboardSnapHandled, snapWindow]);

  useEffect(() => {
    if (disableWindowPreviews) return undefined;
    if (typeof window === 'undefined') return undefined;

    const scheduleWarmup = () => warmHtml2canvasLoader();

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(scheduleWarmup, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(scheduleWarmup, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [disableWindowPreviews]);

  const capturePreview = useCallback(async () => {
    if (disableWindowPreviews) return;
    if (typeof window === 'undefined' || minimizedRef.current || document.hidden || captureInFlightRef.current) {
      return;
    }

    const previewSource = windowRef.current;
    if (!previewSource) return;

    const bounds = previewSource.getBoundingClientRect();
    if (bounds.width < 120 || bounds.height < 90) return;

    const previewOptOut = getPreviewOptOutMeta(previewSource);
    if (previewOptOut) {
      const capturedAt = Date.now();
      lastCaptureAtRef.current = capturedAt;
      setWindowPreviewSnapshot(id, {
        src: null,
        capturedAt,
        title,
        width: bounds.width,
        height: bounds.height,
        error: previewOptOut.reason,
      });
      return;
    }

    captureInFlightRef.current = true;

    try {
      const html2canvas = await loadHtml2canvas();
      const snapshotScale = Math.max(
        0.18,
        Math.min(
          0.52,
          PREVIEW_CAPTURE_MAX_WIDTH / Math.max(bounds.width, 1),
          PREVIEW_CAPTURE_MAX_HEIGHT / Math.max(bounds.height, 1)
        )
      );
      const selector = `[data-window-id="${getEscapedSelectorValue(id)}"]`;

      const canvas = await html2canvas(previewSource, {
        backgroundColor: '#0f172a',
        scale: snapshotScale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        removeContainer: true,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight,
        onclone: (clonedDocument) => {
          const clonedWindow = clonedDocument.querySelector(selector);
          if (!clonedWindow) return;

          clonedWindow.querySelectorAll('[data-window-preview-ignore="true"]').forEach((element) => {
            element.remove();
          });
        },
      });

      const capturedAt = Date.now();
      lastCaptureAtRef.current = capturedAt;
      setWindowPreviewSnapshot(id, {
        src: canvas.toDataURL('image/jpeg', 0.76),
        capturedAt,
        title,
        width: bounds.width,
        height: bounds.height,
      });
    } catch (error) {
      console.warn('[Window] Falha ao gerar snapshot reduzido da janela.', error);
    } finally {
      captureInFlightRef.current = false;
    }
  }, [disableWindowPreviews, id, minimized, title]);

  const schedulePreviewCapture = useCallback((delay = PREVIEW_CAPTURE_DEBOUNCE_MS) => {
    if (disableWindowPreviews) return;
    if (typeof window === 'undefined' || minimized) return;

    if (captureTimeoutRef.current) {
      window.clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }

    const remainingCooldown = Math.max(
      0,
      PREVIEW_CAPTURE_MIN_INTERVAL_MS - (Date.now() - lastCaptureAtRef.current)
    );

    captureTimeoutRef.current = window.setTimeout(() => {
      captureTimeoutRef.current = null;
      void capturePreview();
    }, Math.max(delay, remainingCooldown));
  }, [capturePreview, disableWindowPreviews, minimized]);

  useEffect(() => {
    windowPreviewCaptureRequestStore.set(id, schedulePreviewCapture);

    return () => {
      windowPreviewCaptureRequestStore.delete(id);
    };
  }, [id, schedulePreviewCapture]);

  useEffect(() => {
    minimizedRef.current = minimized;

    if (typeof window !== 'undefined' && minimized && captureTimeoutRef.current) {
      window.clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
  }, [minimized]);

  useEffect(() => {
    if (disableWindowPreviews) return undefined;
    if (minimized || !isFocused) return undefined;

    const observedWindow = windowRef.current;
    const observedBody = windowBodyRef.current;
    if (!observedWindow || !observedBody) return undefined;

    const previewOptOut = getPreviewOptOutMeta(observedBody);
    if (previewOptOut) {
      const capturedAt = Date.now();
      lastCaptureAtRef.current = capturedAt;
      setWindowPreviewSnapshot(id, {
        src: null,
        capturedAt,
        title,
        width: observedWindow.clientWidth,
        height: observedWindow.clientHeight,
        error: previewOptOut.reason,
      });
      return undefined;
    }

    const mutationObserver = new MutationObserver(() => {
      schedulePreviewCapture(420);
    });

    mutationObserver.observe(observedBody, {
      childList: true,
      subtree: false,
      characterData: false,
      attributes: true,
      attributeFilter: ['class', 'style', 'src', 'value', 'data-state', 'aria-selected', 'aria-checked'],
    });

    const resizeObserver = new ResizeObserver(() => {
      schedulePreviewCapture(320);
    });

    resizeObserver.observe(observedWindow);
    resizeObserver.observe(observedBody);
    schedulePreviewCapture(360);

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [disableWindowPreviews, id, isFocused, minimized, schedulePreviewCapture, title]);

  useEffect(() => {
    if (disableWindowPreviews) return;
    if (isResizing || isDragging) return;
    schedulePreviewCapture(260);
  }, [disableWindowPreviews, isDragging, isMaximized, isResizing, pos.x, pos.y, schedulePreviewCapture, size.height, size.width, title, zIndex]);

  useEffect(() => {
    if (!snapFeedback || shouldReduceMotion) return;

    void snapAnimationControls.start(WINDOW_SNAP_FEEDBACK_ANIMATIONS[snapFeedback.kind]);
  }, [shouldReduceMotion, snapAnimationControls, snapFeedback]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && captureTimeoutRef.current) {
      window.clearTimeout(captureTimeoutRef.current);
    }

    clearWindowPreviewSnapshot(id);
  }, [id]);

  const titleBar = (
    <div
      className="window-titlebar relative flex items-center justify-between px-3 h-9 bg-slate-900 text-white select-none flex-shrink-0 cursor-move overflow-hidden"
      onDoubleClick={toggleMaximize}
    >
      <AnimatePresence>
        {snapFeedback && (
          <motion.div
            key={`titlebar-${snapFeedback.kind}-${snapFeedback.key}`}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ${WINDOW_SNAP_FEEDBACK_TITLEBAR_GLOWS[snapFeedback.kind]}`}
            initial={{ opacity: 0, x: snapFeedback.kind === 'left' ? -14 : snapFeedback.kind === 'right' ? 14 : 0, y: snapFeedback.kind === 'maximized' ? -8 : 0 }}
            animate={{ opacity: [0, 0.8, 0], x: 0, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut', times: [0, 0.4, 1] }}
          />
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4" style={{ color: iconColor }} />}
        <span className="text-sm font-medium truncate">{title}</span>
      </div>
      <div className="flex items-center gap-0.5">
        <button onClick={onMinimize} className="w-8 h-7 flex items-center justify-center hover:bg-white/20 rounded transition-colors" title="Minimizar">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button onClick={toggleMaximize} className="w-8 h-7 flex items-center justify-center hover:bg-white/20 rounded transition-colors" title="Maximizar">
          {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onClose} className="w-8 h-7 flex items-center justify-center hover:bg-red-500 rounded transition-colors" title="Fechar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const content = (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.88, opacity: 0, y: 16 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.88, opacity: 0, y: 16 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
      className="w-full h-full"
      onMouseDown={onFocus}
    >
      <motion.div
        ref={windowRef}
        data-window-id={id}
        data-window-preview-source="true"
        data-window-title={title}
        data-window-snap-mode={snapMode ?? 'free'}
        data-window-resizing={isResizing ? 'true' : 'false'}
        initial={shouldReduceMotion ? false : WINDOW_FEEDBACK_IDLE}
        animate={shouldReduceMotion ? WINDOW_FEEDBACK_IDLE : snapAnimationControls}
        className={`relative flex min-h-0 min-w-0 flex-col h-full w-full overflow-hidden rounded-xl bg-white shadow-2xl transition-shadow ${
          isResizing ? 'ring-2 ring-sky-300/55 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_28px_70px_rgba(15,23,42,0.34)]' : ''
        }`}
        style={{
          border: '1px solid rgba(255,255,255,0.15)',
          zIndex,
          transformOrigin:
            snapMode === 'left'
              ? 'left top'
              : snapMode === 'right'
                ? 'right top'
                : 'center top',
        }}
      >
        <AnimatePresence>
          {snapFeedback && !shouldReduceMotion && (
            <>
              <motion.div
                key={`${snapFeedback.kind}-${snapFeedback.key}`}
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 z-10 ${WINDOW_SNAP_FEEDBACK_OVERLAYS[snapFeedback.kind]}`}
                initial={{ opacity: 0, scaleX: 0.985, scaleY: 0.985 }}
                animate={{
                  opacity: [0, 0.72, 0],
                  scaleX: [0.985, 1, 1.01],
                  scaleY: [0.985, 1, 1.005],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: 'easeOut', times: [0, 0.42, 1] }}
              />
              <motion.div
                key={`accent-${snapFeedback.kind}-${snapFeedback.key}`}
                aria-hidden="true"
                className={`pointer-events-none absolute z-[11] ${WINDOW_SNAP_FEEDBACK_ACCENTS[snapFeedback.kind]}`}
                initial={{
                  opacity: 0,
                  scaleX: snapFeedback.kind === 'maximized' ? 0.6 : 1,
                  scaleY: snapFeedback.kind === 'maximized' ? 1 : 0.68,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scaleX: snapFeedback.kind === 'maximized' ? [0.6, 1, 1.06] : 1,
                  scaleY: snapFeedback.kind === 'maximized' ? 1 : [0.68, 1, 1.06],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1], times: [0, 0.42, 1] }}
              />
            </>
          )}
        </AnimatePresence>
        {titleBar}
        <div ref={windowBodyRef} className="relative z-0 flex min-h-0 min-w-0 flex-1 overflow-auto bg-slate-50">
          <div className="window-shell-page">
            <div className="window-page-content">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  const snapPreviewOverlay = (
    <AnimatePresence>
      {snapPreview && !minimized && (
        <motion.div
          key={`snap-preview-${id}-${snapPreview.kind}`}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: snapPreview.rect.x,
            top: snapPreview.rect.y,
            width: snapPreview.rect.width,
            height: snapPreview.rect.height,
            zIndex: Math.max(1, zIndex - 1),
          }}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.992 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className={`relative h-full w-full overflow-hidden rounded-[24px] border backdrop-blur-md ${WINDOW_SNAP_PREVIEW_SURFACES[snapPreview.kind]}`}
          >
            <div className={`absolute inset-0 ${WINDOW_SNAP_PREVIEW_INNERS[snapPreview.kind]}`} />
            <div className="absolute inset-[10px] rounded-[18px] border border-white/12 bg-slate-950/14" />
            <motion.div
              className={`absolute ${WINDOW_SNAP_PREVIEW_ACCENTS[snapPreview.kind]}`}
              initial={shouldReduceMotion ? { opacity: 0 } : {
                opacity: 0,
                scaleX: snapPreview.kind === 'maximized' ? 0.64 : 1,
                scaleY: snapPreview.kind === 'maximized' ? 1 : 0.72,
              }}
              animate={shouldReduceMotion ? { opacity: 1 } : {
                opacity: 1,
                scaleX: 1,
                scaleY: 1,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {snapPreviewOverlay}
      <Rnd
        position={pos}
        size={size}
        enableResizing={WINDOW_RESIZE_HANDLES}
        resizeHandleStyles={WINDOW_RESIZE_HANDLE_STYLES}
        resizeHandleClasses={WINDOW_RESIZE_HANDLE_CLASSES}
        disableDragging={isMaximized}
        onResizeStart={() => {
          onFocus?.();
          handleResizeStart();
        }}
        onResize={handleResize}
        onDragStart={(event) => {
          onFocus?.();
          handleDragStart(event);
        }}
        onDrag={handleDrag}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        dragHandleClassName="window-titlebar"
        cancel="button"
        minWidth={MIN_WINDOW_WIDTH}
        minHeight={MIN_WINDOW_HEIGHT}
        bounds="parent"
        data-window-resizing={isResizing ? 'true' : 'false'}
        data-window-dragging={isDragging ? 'true' : 'false'}
        style={{ zIndex, display: minimized ? 'none' : 'block' }}
        className={`pointer-events-auto group/window ${isMaximized ? 'absolute inset-0' : ''}`}
      >
        {content}
      </Rnd>
    </>
  );
}
