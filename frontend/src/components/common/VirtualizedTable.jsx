import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';

const DEFAULT_OVERSCAN = 6;
const DEFAULT_MAX_HEIGHT = 560;
const DEFAULT_THRESHOLD = 24;

export default function VirtualizedTable({
  rows,
  rowHeight,
  rowKey,
  renderRow,
  header,
  colSpan,
  overscan = DEFAULT_OVERSCAN,
  maxHeight = DEFAULT_MAX_HEIGHT,
  virtualizationThreshold = DEFAULT_THRESHOLD,
  containerClassName,
  tableClassName,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const shouldVirtualize = rows.length > virtualizationThreshold;

  useEffect(() => {
    setScrollTop(0);
  }, [rows, shouldVirtualize]);

  const handleScroll = useCallback((event) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const {
    visibleRows,
    startIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    viewportHeight,
  } = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        visibleRows: rows,
        startIndex: 0,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        viewportHeight: undefined,
      };
    }

    const totalHeight = rows.length * rowHeight;
    const nextViewportHeight = Math.min(maxHeight, totalHeight);
    const visibleCount = Math.max(1, Math.ceil(nextViewportHeight / rowHeight));
    const nextStartIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endIndex = Math.min(
      rows.length,
      nextStartIndex + visibleCount + overscan * 2,
    );

    return {
      visibleRows: rows.slice(nextStartIndex, endIndex),
      startIndex: nextStartIndex,
      topSpacerHeight: nextStartIndex * rowHeight,
      bottomSpacerHeight: Math.max(0, totalHeight - endIndex * rowHeight),
      viewportHeight: nextViewportHeight,
    };
  }, [maxHeight, overscan, rowHeight, rows, scrollTop, shouldVirtualize]);

  return (
    <div
      className={cn(
        shouldVirtualize ? 'overflow-auto' : 'overflow-x-auto',
        containerClassName,
      )}
      style={shouldVirtualize ? { maxHeight: viewportHeight, height: viewportHeight } : undefined}
      onScroll={shouldVirtualize ? handleScroll : undefined}
    >
      <Table className={tableClassName}>
        {header}
        <TableBody>
          {shouldVirtualize && topSpacerHeight > 0 ? (
            <TableRow aria-hidden="true">
              <TableCell
                colSpan={colSpan}
                className="border-0 p-0"
                style={{ height: topSpacerHeight }}
              />
            </TableRow>
          ) : null}

          {visibleRows.map((row, visibleIndex) => renderRow(row, startIndex + visibleIndex))}

          {shouldVirtualize && bottomSpacerHeight > 0 ? (
            <TableRow aria-hidden="true">
              <TableCell
                colSpan={colSpan}
                className="border-0 p-0"
                style={{ height: bottomSpacerHeight }}
              />
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
