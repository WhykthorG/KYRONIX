// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { toast } from 'sonner';

import { getAppById } from '@/lib/appManifest';

const CELL_W = 96;
const CELL_H = 104;
const PADDING = 16;
const FREEFORM_PADDING = 8;
const ICON_BOX_W = 88;
const ICON_BOX_H = 96;
const MAX_ROWS = 6;

const isFreeformPosition = (position) => (
  position
  && Number.isFinite(position.x)
  && Number.isFinite(position.y)
);

const isGridPosition = (position) => (
  position
  && Number.isFinite(position.col)
  && Number.isFinite(position.row)
);

export function useDesktopShortcutsLayout({ allowedAppIds }) {
  const desktopRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const [containerSize, setContainerSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight - 88 : 768,
  });
  const containerSizeRef = useRef(containerSize);
  const [desktopAppsIds, setDesktopAppsIds] = useState([]);
  const [pinnedAppsIds, setPinnedAppsIds] = useState([]);
  const [iconPositions, setIconPositions] = useState({});

  const maxCols = useMemo(() => {
    if (containerSize.width <= 0) return 8;
    return Math.max(2, Math.floor((containerSize.width - PADDING) / CELL_W));
  }, [containerSize.width]);

  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;

    const commitContainerSize = (width, height) => {
      const nextSize = {
        width: Math.round(width),
        height: Math.round(height),
      };

      const currentSize = containerSizeRef.current;
      if (currentSize.width === nextSize.width && currentSize.height === nextSize.height) {
        return;
      }

      containerSizeRef.current = nextSize;
      setContainerSize(nextSize);
    };

    const observer = new ResizeObserver((entries) => {
      const latestEntry = entries[entries.length - 1];
      if (!latestEntry) return;

      const { width, height } = latestEntry.contentRect;
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        commitContainerSize(width, height);
      });
    });

    observer.observe(el);
    commitContainerSize(el.clientWidth, el.clientHeight);

    return () => {
      observer.disconnect();
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, []);

  const clampFreePosition = useCallback((pixelPos) => ({
    x: Math.min(
      Math.max(pixelPos.x, FREEFORM_PADDING),
      Math.max(FREEFORM_PADDING, containerSize.width - ICON_BOX_W - FREEFORM_PADDING)
    ),
    y: Math.min(
      Math.max(pixelPos.y, FREEFORM_PADDING),
      Math.max(FREEFORM_PADDING, containerSize.height - ICON_BOX_H - FREEFORM_PADDING)
    ),
  }), [containerSize.height, containerSize.width]);

  const getDefaultPositions = useCallback((apps) => {
    const positions = {};
    apps.forEach((app, index) => {
      const col = Math.floor(index / MAX_ROWS);
      const row = index % MAX_ROWS;
      positions[app.id] = { col, row };
    });
    return positions;
  }, []);

  const computedPositions = useMemo(() => {
    const finalPositions = {};
    const gridManagedIds = [];

    desktopAppsIds.forEach((id) => {
      const userPos = iconPositions[id];
      if (isFreeformPosition(userPos)) {
        finalPositions[id] = clampFreePosition(userPos);
        return;
      }
      gridManagedIds.push(id);
    });

    const defaults = getDefaultPositions(
      gridManagedIds.map((id) => getAppById(id)).filter(Boolean)
    );
    const finalGridPositions = {};
    const occupied = new Set();

    gridManagedIds.forEach((id) => {
      const userPos = iconPositions[id];
      let preferred = defaults[id] || { col: 0, row: 0 };

      if (isGridPosition(userPos)) {
        preferred = {
          col: Math.max(0, Math.min(userPos.col, maxCols - 1)),
          row: Math.max(0, Math.min(userPos.row, MAX_ROWS - 1)),
        };
      }

      let { col, row } = preferred;

      if (occupied.has(`${col},${row}`)) {
        let nextRow = 0;
        let nextCol = col;
        while (occupied.has(`${nextCol},${nextRow}`)) {
          nextRow += 1;
          if (nextRow >= MAX_ROWS) {
            nextRow = 0;
            nextCol += 1;
          }
        }
        col = nextCol;
        row = nextRow;
      }

      finalGridPositions[id] = { col, row };
      occupied.add(`${col},${row}`);
    });

    Object.entries(finalGridPositions).forEach(([id, position]) => {
      finalPositions[id] = {
        x: position.col * CELL_W + PADDING,
        y: position.row * CELL_H + PADDING,
      };
    });

    return finalPositions;
  }, [clampFreePosition, desktopAppsIds, getDefaultPositions, iconPositions, maxCols]);

  const visibleDesktopAppIds = useMemo(
    () => desktopAppsIds.filter((id) => allowedAppIds.has(id)),
    [allowedAppIds, desktopAppsIds]
  );

  const handlePositionChange = useCallback((appId, pixelPos) => {
    setIconPositions((prev) => ({
      ...prev,
      [appId]: clampFreePosition(pixelPos),
    }));
  }, [clampFreePosition]);

  const removeShortcut = useCallback((id) => {
    setDesktopAppsIds((prev) => prev.filter((appId) => appId !== id));
  }, []);

  const addDesktopShortcut = useCallback((id) => {
    const app = getAppById(id);
    if (!app || !allowedAppIds.has(id)) {
      toast.error('Nao foi possivel adicionar este modulo na area de trabalho.');
      return false;
    }

    let added = false;
    setDesktopAppsIds((prev) => {
      if (prev.includes(id)) {
        return prev;
      }
      added = true;
      return [...prev, id];
    });

    if (!added) {
      toast.error('Nao foi possivel adicionar: este modulo ja esta na area de trabalho.');
      return false;
    }

    toast.success(`${app.title} adicionado na area de trabalho.`);
    return true;
  }, [allowedAppIds]);

  const togglePinTaskbar = useCallback((id) => {
    setPinnedAppsIds((prev) => (
      prev.includes(id) ? prev.filter((appId) => appId !== id) : [...prev, id]
    ));
  }, []);

  const handleRearrangeIcons = useCallback(() => {
    const orderedIds = [...visibleDesktopAppIds]
      .sort((leftId, rightId) => {
        const leftPos = computedPositions[leftId] || { x: 0, y: 0 };
        const rightPos = computedPositions[rightId] || { x: 0, y: 0 };
        return leftPos.x - rightPos.x || leftPos.y - rightPos.y || leftId.localeCompare(rightId);
      });

    const alignedPositions = {};
    orderedIds.forEach((id, index) => {
      alignedPositions[id] = {
        col: Math.floor(index / MAX_ROWS),
        row: index % MAX_ROWS,
      };
    });

    setIconPositions(alignedPositions);
  }, [computedPositions, visibleDesktopAppIds]);

  return {
    desktopRef,
    desktopAppsIds,
    pinnedAppsIds,
    iconPositions,
    computedPositions,
    visibleDesktopAppIds,
    setDesktopAppsIds,
    setPinnedAppsIds,
    setIconPositions,
    handlePositionChange,
    removeShortcut,
    addDesktopShortcut,
    togglePinTaskbar,
    handleRearrangeIcons,
  };
}
