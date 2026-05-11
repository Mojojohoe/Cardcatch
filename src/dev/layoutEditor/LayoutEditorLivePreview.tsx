/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DisplayCardArtModeOverride } from '../../cardArt/cardArtContext';
import type { RoomData } from '../../types';
import type { LayoutCellAssignment, LayoutEditorLayer } from './types';
import { LAYOUT_GRID_COLS, LAYOUT_GRID_ROWS } from './types';
import { mergeLayoutRegions, type MergedLayoutRegion } from './mergeLayoutRegions';
import { LayoutEditorModuleRenderer, LayoutEditorUiModuleRenderer } from './LayoutEditorModuleRenderer';

type Props = {
  layer: LayoutEditorLayer;
  cells: Record<string, LayoutCellAssignment>;
  room: RoomData;
  myUid: string;
  previewWidth: number;
  previewHeight: number;
};

export function LayoutEditorLivePreview({
  layer,
  cells,
  room,
  myUid,
  previewWidth,
  previewHeight,
}: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const regions = useMemo(() => mergeLayoutRegions(cells), [cells]);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const sx = w / previewWidth;
      const sy = h / previewHeight;
      setScale(Math.min(1, sx, sy));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewWidth, previewHeight]);

  return (
    <div ref={outerRef} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden p-2">
      <div
        className="relative shrink-0 rounded-lg border border-slate-600/60 bg-slate-950/50 shadow-inner"
        style={{
          width: previewWidth * scale,
          height: previewHeight * scale,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: previewWidth,
            height: previewHeight,
            transform: `scale(${scale})`,
          }}
        >
          <DisplayCardArtModeOverride highVisibilityMode={false}>
            <div
              className="layout-editor-live-grid-bg grid h-full w-full bg-slate-950/30"
              style={{
                gridTemplateColumns: `repeat(${LAYOUT_GRID_COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${LAYOUT_GRID_ROWS}, minmax(0, 1fr))`,
              }}
            >
              {regions.map((region, idx) => {
                const rk = `${region.col}-${region.row}-${idx}`;
                return (
                  <React.Fragment key={rk}>
                    <RegionHost region={region} room={room} myUid={myUid} layer={layer} />
                  </React.Fragment>
                );
              })}
            </div>
          </DisplayCardArtModeOverride>
        </div>
      </div>
    </div>
  );
}

function RegionHost({
  region,
  room,
  myUid,
  layer,
}: {
  region: MergedLayoutRegion;
  room: RoomData;
  myUid: string;
  layer: LayoutEditorLayer;
}) {
  const { col, row, w, h, assignment } = region;
  const style: React.CSSProperties = {
    gridColumn: `${col + 1} / span ${w}`,
    gridRow: `${row + 1} / span ${h}`,
    minWidth: 0,
    minHeight: 0,
  };

  const notes = assignment.notes;

  let body: React.ReactNode = null;
  if (layer === 'game' && assignment.kind === 'game') {
    body = <LayoutEditorModuleRenderer room={room} myUid={myUid} gameKey={assignment.element} />;
  } else if (layer === 'ui' && assignment.kind === 'ui') {
    body = <LayoutEditorUiModuleRenderer room={room} myUid={myUid} uiKey={assignment.element} />;
  }

  return (
    <div
      style={style}
      className="relative z-[1] flex min-h-0 min-w-0 flex-col border border-slate-500/25 bg-slate-900/20"
      title={notes || undefined}
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{body}</div>
      {notes ? (
        <div className="pointer-events-none shrink-0 border-t border-amber-900/30 bg-black/40 px-1 py-0.5 text-[7px] leading-tight text-amber-100/90">
          {notes}
        </div>
      ) : null}
    </div>
  );
}
