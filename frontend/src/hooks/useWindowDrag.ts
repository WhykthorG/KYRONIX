// ┌ñÏ▒┘êÏ»┘ê┘é Ïº┘è┘å Ï»┌ñÏ▒Ï¿┘êÏºÏ¬ Ï│┌ñ┘å┘ê┘ç┌¢ Ïº┘ê┘ä┘è┘ç Whyktor GSV.
import { useCallback, useEffect, useRef, useState } from 'react';

type WindowPosition = {
  x: number;
  y: number;
};

type WindowSize = {
  width: number;
  height: number;
};

type WindowRect = WindowPosition & WindowSize;

type SnapMode = 'left' | 'right' | 'maximized' | null;
type SnapFeedbackKind = Exclude<SnapMode, null>;

type BoundsRect = {
  left: number;
  top: number;
  right: number;
  width: number;
  height: number;
};

type DragStopEventLike = {
  clientX?: number;
  clientY?: number;
  touches?: ArrayLike<{ clientX: number; clientY: number }>;
  changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
};

type DragStopData = {
  x: number;
  y: number;
};

type ResizeTargetLike = {
  offsetWidth: number;
  offsetHeight: number;
};

type ResizePositionLike = {
  x: number;
  y: number;
};

type UseWindowDragOptions = {
  initialPosition: WindowPosition;
  initialSize: WindowSize;
  defaultMaximized?: boolean;
  minWidth?: number;
  minHeight?: number;
  getBoundsRect?: () => BoundsRect | null;
  persistState?: (position: WindowPosition, size: WindowSize) => void;
};

type SnapFeedback = {
  key: number;
  kind: SnapFeedbackKind;
} | null;

type SnapPreview = {
  kind: SnapFeedbackKind;
  rect: WindowRect;
} | null;

const SIDE_SNAP_THRESHOLD = 56;
const TOP_SNAP_THRESHOLD = 32;
const FEEDBACK_DURATION_MS = 420;

const getPointerClientPosition = (event?: DragStopEventLike | null) => {
  if (!event) return null;

  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }

  const touch = event.changedTouches?.[0] ?? event.touches?.[0];
  if (!touch) return null;

  return { x: touch.clientX, y: touch.clientY };
};

const resolveSnapMode = (
  event: DragStopEventLike | null | undefined,
  bounds: BoundsRect
): SnapMode => {
  const pointer = getPointerClientPosition(event);
  if (!pointer) return null;

  const nearLeft = pointer.x <= bounds.left + SIDE_SNAP_THRESHOLD;
  const nearRight = pointer.x >= bounds.right - SIDE_SNAP_THRESHOLD;
  const nearTop = pointer.y <= bounds.top + TOP_SNAP_THRESHOLD;

  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  if (nearTop) return 'maximized';
  return null;
};

const getSnapRect = (
  snapMode: SnapFeedbackKind,
  bounds: BoundsRect,
  minWidth: number,
  minHeight: number
): WindowRect => {
  const snappedHeight = Math.max(minHeight, bounds.height);

  if (snapMode === 'left') {
    const snappedWidth = Math.max(minWidth, Math.floor(bounds.width / 2));
    return { x: 0, y: 0, width: snappedWidth, height: snappedHeight };
  }

  if (snapMode === 'right') {
    const snappedWidth = Math.max(minWidth, Math.floor(bounds.width / 2));
    return {
      x: Math.max(0, bounds.width - snappedWidth),
      y: 0,
      width: snappedWidth,
      height: snappedHeight,
    };
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(minWidth, bounds.width),
    height: Math.max(minHeight, bounds.height),
  };
};

export function useWindowDrag({
  initialPosition,
  initialSize,
  defaultMaximized = false,
  minWidth = 420,
  minHeight = 300,
  getBoundsRect,
  persistState,
}: UseWindowDragOptions) {
  const [pos, setPos] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [isMaximized, setIsMaximized] = useState(defaultMaximized);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [snapMode, setSnapMode] = useState<SnapMode>(defaultMaximized ? 'maximized' : null);
  const [snapFeedback, setSnapFeedback] = useState<SnapFeedback>(null);
  const [snapPreview, setSnapPreview] = useState<SnapPreview>(null);
  const restoreRectRef = useRef<WindowRect | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const feedbackKeyRef = useRef(0);
  const hasAppliedDefaultMaximizeRef = useRef(false);

  const persistWindowState = useCallback(
    (nextPosition: WindowPosition, nextSize: WindowSize) => {
      persistState?.(nextPosition, nextSize);
    },
    [persistState]
  );

  const clearFeedbackTimer = useCallback(() => {
    if (typeof window === 'undefined' || feedbackTimeoutRef.current === null) return;

    window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = null;
  }, []);

  const triggerSnapFeedback = useCallback(
    (kind: SnapFeedbackKind) => {
      clearFeedbackTimer();
      feedbackKeyRef.current += 1;
      setSnapFeedback({ kind, key: feedbackKeyRef.current });

      if (typeof window !== 'undefined') {
        feedbackTimeoutRef.current = window.setTimeout(() => {
          setSnapFeedback((current) => (current?.key === feedbackKeyRef.current ? null : current));
          feedbackTimeoutRef.current = null;
        }, FEEDBACK_DURATION_MS);
      }
    },
    [clearFeedbackTimer]
  );

  useEffect(() => () => {
    clearFeedbackTimer();
  }, [clearFeedbackTimer]);

  const clearSnapPreview = useCallback(() => {
    setSnapPreview(null);
  }, []);

  useEffect(() => {
    if (!defaultMaximized || hasAppliedDefaultMaximizeRef.current) return;

    const bounds = getBoundsRect?.();
    if (!bounds) return;

    restoreRectRef.current = {
      x: initialPosition.x,
      y: initialPosition.y,
      width: initialSize.width,
      height: initialSize.height,
    };

    const targetRect = getSnapRect('maximized', bounds, minWidth, minHeight);
    setPos({ x: targetRect.x, y: targetRect.y });
    setSize({ width: targetRect.width, height: targetRect.height });
    setIsMaximized(true);
    setSnapMode('maximized');
    clearSnapPreview();
    hasAppliedDefaultMaximizeRef.current = true;
  }, [
    clearSnapPreview,
    defaultMaximized,
    getBoundsRect,
    initialPosition.x,
    initialPosition.y,
    initialSize.height,
    initialSize.width,
    minHeight,
    minWidth,
  ]);

  const updateSnapPreview = useCallback(
    (event: DragStopEventLike | null | undefined): SnapMode => {
      const bounds = getBoundsRect?.() ?? null;
      if (!bounds) {
        clearSnapPreview();
        return null;
      }

      const nextSnapMode = resolveSnapMode(event, bounds);
      if (!nextSnapMode) {
        clearSnapPreview();
        return null;
      }

      const nextRect = getSnapRect(nextSnapMode, bounds, minWidth, minHeight);
      setSnapPreview((current) => {
        if (
          current?.kind === nextSnapMode
          && current.rect.x === nextRect.x
          && current.rect.y === nextRect.y
          && current.rect.width === nextRect.width
          && current.rect.height === nextRect.height
        ) {
          return current;
        }

        return {
          kind: nextSnapMode,
          rect: nextRect,
        };
      });

      return nextSnapMode;
    },
    [clearSnapPreview, getBoundsRect, minHeight, minWidth]
  );

  const restoreWindow = useCallback(() => {
    const restoreRect = restoreRectRef.current;
    if (!restoreRect) return;

    const nextPosition = { x: restoreRect.x, y: restoreRect.y };
    const nextSize = { width: restoreRect.width, height: restoreRect.height };

    setPos(nextPosition);
    setSize(nextSize);
    setIsMaximized(false);
    setSnapMode(null);
    setIsDragging(false);
    clearSnapPreview();
    restoreRectRef.current = null;
    persistWindowState(nextPosition, nextSize);
  }, [clearSnapPreview, persistWindowState]);

  const applySnapMode = useCallback(
    (nextSnapMode: SnapFeedbackKind) => {
      const bounds = getBoundsRect?.();
      if (!bounds) return;

      const targetRect = getSnapRect(nextSnapMode, bounds, minWidth, minHeight);
      const nextPosition = { x: targetRect.x, y: targetRect.y };
      const nextSize = { width: targetRect.width, height: targetRect.height };

      setPos(nextPosition);
      setSize(nextSize);
      setIsMaximized(nextSnapMode === 'maximized');
      setSnapMode(nextSnapMode);
      setIsDragging(false);
      clearSnapPreview();
      persistWindowState(nextPosition, nextSize);
      triggerSnapFeedback(nextSnapMode);
    },
    [clearSnapPreview, getBoundsRect, minHeight, minWidth, persistWindowState, triggerSnapFeedback]
  );

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      restoreWindow();
      return;
    }

    if (!restoreRectRef.current) {
      restoreRectRef.current = {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
      };
    }

    applySnapMode('maximized');
  }, [applySnapMode, isMaximized, pos.x, pos.y, restoreWindow, size.height, size.width]);

  const snapWindow = useCallback((nextSnapMode: SnapFeedbackKind) => {
    if (!restoreRectRef.current) {
      restoreRectRef.current = {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
      };
    }

    applySnapMode(nextSnapMode);
  }, [applySnapMode, pos.x, pos.y, size.height, size.width]);

  const handleDragStop = useCallback(
    (event: DragStopEventLike | null | undefined, data: DragStopData) => {
      const droppedPosition = { x: data.x, y: data.y };
      const nextSnapMode = snapPreview?.kind ?? updateSnapPreview(event);

      setIsDragging(false);
      clearSnapPreview();

      if (nextSnapMode) {
        if (!restoreRectRef.current) {
          restoreRectRef.current = {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
          };
        }

        applySnapMode(nextSnapMode);
        return;
      }

      if (snapMode && restoreRectRef.current) {
        const restoredSize = {
          width: restoreRectRef.current.width,
          height: restoreRectRef.current.height,
        };

        setPos(droppedPosition);
        setSize(restoredSize);
        setIsMaximized(false);
        setSnapMode(null);
        restoreRectRef.current = null;
        persistWindowState(droppedPosition, restoredSize);
        return;
      }

      setPos(droppedPosition);
      setIsMaximized(false);
      setSnapMode(null);
      restoreRectRef.current = null;
      persistWindowState(droppedPosition, size);
    },
    [applySnapMode, clearSnapPreview, persistWindowState, pos.x, pos.y, size, snapPreview?.kind, snapMode, updateSnapPreview]
  );

  const handleResizeStop = useCallback(
    (
      _event: unknown,
      _direction: unknown,
      ref: ResizeTargetLike,
      _delta: unknown,
      position: ResizePositionLike
    ) => {
      const nextSize = { width: ref.offsetWidth, height: ref.offsetHeight };
      const nextPosition = { x: position.x, y: position.y };

      setIsResizing(false);
      setSize(nextSize);
      setPos(nextPosition);
      setIsMaximized(false);
      setSnapMode(null);
      setIsDragging(false);
      clearSnapPreview();
      restoreRectRef.current = null;
      persistWindowState(nextPosition, nextSize);
    },
    [clearSnapPreview, persistWindowState]
  );

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
    setIsDragging(false);
    clearSnapPreview();
  }, [clearSnapPreview]);

  const handleResize = useCallback(
    (
      _event: unknown,
      _direction: unknown,
      ref: ResizeTargetLike,
      _delta: unknown,
      position: ResizePositionLike
    ) => {
      const nextSize = { width: ref.offsetWidth, height: ref.offsetHeight };
      const nextPosition = { x: position.x, y: position.y };

      setSize(nextSize);
      setPos(nextPosition);
      setIsMaximized(false);
      setSnapMode(null);
      setIsDragging(false);
      clearSnapPreview();
      restoreRectRef.current = null;
    },
    [clearSnapPreview]
  );

  const handleDragStart = useCallback((event: DragStopEventLike | null | undefined) => {
    setIsDragging(true);
    updateSnapPreview(event);
  }, [updateSnapPreview]);

  const handleDrag = useCallback((event: DragStopEventLike | null | undefined) => {
    updateSnapPreview(event);
  }, [updateSnapPreview]);

  return {
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
  };
}
