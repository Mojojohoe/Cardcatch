/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { GAME_ELEMENT_OPTIONS, GAME_UI_OPTIONS } from './constants';
import './layoutEditor.css';
import {
  LAYOUT_GRID_COLS,
  LAYOUT_GRID_ROWS,
  cellKey,
  type GameElementKey,
  type GameUiElementKey,
  type LayoutCellAssignment,
  type LayoutEditorLayer,
  type LayoutExportV1,
} from './types';

function cellsInRectangle(
  c0: number,
  r0: number,
  c1: number,
  r1: number,
): Set<string> {
  const sc = Math.min(c0, c1);
  const ec = Math.max(c0, c1);
  const sr = Math.min(r0, r1);
  const er = Math.max(r0, r1);
  const out = new Set<string>();
  for (let c = sc; c <= ec; c++) {
    for (let r = sr; r <= er; r++) {
      out.add(cellKey(c, r));
    }
  }
  return out;
}

function labelForAssignment(a: LayoutCellAssignment): string {
  if (a.kind === 'empty') return '';
  if (a.kind === 'game') {
    return GAME_ELEMENT_OPTIONS.find((o) => o.value === a.element)?.label ?? a.element;
  }
  return GAME_UI_OPTIONS.find((o) => o.value === a.element)?.label ?? a.element;
}

function buildExport(args: {
  viewport: { width: number; height: number };
  gameCells: Record<string, LayoutCellAssignment>;
  uiCells: Record<string, LayoutCellAssignment>;
}): object {
  const colT = `repeat(${LAYOUT_GRID_COLS}, minmax(0, 1fr))`;
  const rowT = `repeat(${LAYOUT_GRID_ROWS}, minmax(0, 1fr))`;

  const pack = (layer: LayoutEditorLayer, map: Record<string, LayoutCellAssignment>) => {
    const cells: LayoutExportV1['cells'] = [];
    for (let row = 0; row < LAYOUT_GRID_ROWS; row++) {
      for (let col = 0; col < LAYOUT_GRID_COLS; col++) {
        const a = map[cellKey(col, row)] ?? { kind: 'empty' as const };
        if (a.kind === 'empty') continue;
        cells.push({ col, row, assignment: a });
      }
    }
    const base: LayoutExportV1 = {
      version: 1,
      exportedAt: new Date().toISOString(),
      viewport: args.viewport,
      layer,
      grid: {
        columns: LAYOUT_GRID_COLS,
        rows: LAYOUT_GRID_ROWS,
        columnTemplateFr: colT,
        rowTemplateFr: rowT,
      },
      cells,
    };
    return base;
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    viewport: args.viewport,
    schema: 'cardcatch.layoutEditor.export.v1',
    layers: {
      game: pack('game', args.gameCells),
      ui: pack('ui', args.uiCells),
    },
  };
}

export type LayoutEditorProps = {
  onClose: () => void;
};

export function LayoutEditor({ onClose }: LayoutEditorProps) {
  const [layer, setLayer] = useState<LayoutEditorLayer>('game');
  const [gameCells, setGameCells] = useState<Record<string, LayoutCellAssignment>>({});
  const [uiCells, setUiCells] = useState<Record<string, LayoutCellAssignment>>({});
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [elementChoice, setElementChoice] = useState<string>('');
  const [notesDraft, setNotesDraft] = useState('');
  const dragRef = useRef<{ anchorCol: number; anchorRow: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const activeMap = layer === 'game' ? gameCells : uiCells;
  const setActiveMap = layer === 'game' ? setGameCells : setUiCells;

  const dropdownOptions = useMemo(
    () => (layer === 'game' ? GAME_ELEMENT_OPTIONS : GAME_UI_OPTIONS),
    [layer],
  );

  useEffect(() => {
    setElementChoice('');
  }, [layer]);

  const hitCell = useCallback((clientX: number, clientY: number): { col: number; row: number } | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.min(LAYOUT_GRID_COLS - 1, Math.max(0, Math.floor((x / rect.width) * LAYOUT_GRID_COLS)));
    const row = Math.min(LAYOUT_GRID_ROWS - 1, Math.max(0, Math.floor((y / rect.height) * LAYOUT_GRID_ROWS)));
    return { col, row };
  }, []);

  useEffect(() => {
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const hit = hitCell(e.clientX, e.clientY);
      if (!hit) return;
      const d = dragRef.current;
      setSelection(cellsInRectangle(d.anchorCol, d.anchorRow, hit.col, hit.row));
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [hitCell]);

  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const hit = hitCell(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault();
      dragRef.current = { anchorCol: hit.col, anchorRow: hit.row };
      setSelection(cellsInRectangle(hit.col, hit.row, hit.col, hit.row));
      try {
        gridRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [hitCell],
  );

  const applyElementToSelection = useCallback(() => {
    if (!elementChoice || selection.size === 0) return;
    setActiveMap((prev) => {
      const next = { ...prev };
      for (const k of selection) {
        if (layer === 'game') {
          next[k] = { kind: 'game', element: elementChoice as GameElementKey, notes: next[k]?.kind === 'game' ? next[k].notes : '' };
        } else {
          next[k] = { kind: 'ui', element: elementChoice as GameUiElementKey, notes: next[k]?.kind === 'ui' ? next[k].notes : '' };
        }
      }
      return next;
    });
  }, [elementChoice, layer, selection, setActiveMap]);

  const applyNotesToSelection = useCallback(() => {
    if (selection.size === 0) return;
    setActiveMap((prev) => {
      const next = { ...prev };
      for (const k of selection) {
        const cur = next[k];
        if (!cur || cur.kind === 'empty') continue;
        if (cur.kind === 'game') next[k] = { ...cur, notes: notesDraft };
        else next[k] = { ...cur, notes: notesDraft };
      }
      return next;
    });
  }, [notesDraft, selection, setActiveMap]);

  const clearSelectionCells = useCallback(() => {
    if (selection.size === 0) return;
    setActiveMap((prev) => {
      const next = { ...prev };
      for (const k of selection) delete next[k];
      return next;
    });
    setSelection(new Set());
  }, [selection, setActiveMap]);

  const exportJson = useCallback(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const payload = buildExport({ viewport, gameCells, uiCells });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-editor-${viewport.width}x${viewport.height}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [gameCells, uiCells]);

  const copyExport = useCallback(async () => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const payload = buildExport({ viewport, gameCells, uiCells });
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {
      /* ignore */
    }
  }, [gameCells, uiCells]);

  return (
    <div className="layout-editor-root fixed inset-0 z-[600] flex flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700/80 bg-slate-950/90 px-4 py-3 backdrop-blur-sm">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Layout editor</h1>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Dev only · {LAYOUT_GRID_COLS}×{LAYOUT_GRID_ROWS} grid · drag to select · export JSON
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-800"
        >
          <X className="h-4 w-4" aria-hidden />
          Close
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row lg:gap-6">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Layer</span>
            <div className="flex rounded-lg border border-slate-600 bg-slate-900/80 p-0.5">
              <button
                type="button"
                onClick={() => setLayer('game')}
                className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                  layer === 'game' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Game elements
              </button>
              <button
                type="button"
                onClick={() => setLayer('ui')}
                className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                  layer === 'ui' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Game UI
              </button>
            </div>
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-colcount={LAYOUT_GRID_COLS}
            aria-rowcount={LAYOUT_GRID_ROWS}
            className="layout-editor-grid-wrap min-h-0 flex-1 touch-none"
            onPointerDown={handleGridPointerDown}
          >
            {Array.from({ length: LAYOUT_GRID_ROWS }, (_, row) =>
              Array.from({ length: LAYOUT_GRID_COLS }, (_, col) => {
                const k = cellKey(col, row);
                const cell = activeMap[k] ?? { kind: 'empty' as const };
                const selected = selection.has(k);
                const filled = cell.kind !== 'empty';
                return (
                  <div
                    key={k}
                    role="gridcell"
                    aria-selected={selected}
                    tabIndex={-1}
                    className={`layout-editor-cell pointer-events-none ${selected ? 'layout-editor-cell--selected' : ''} ${
                      filled ? 'layout-editor-cell--filled' : ''
                    }`}
                  >
                    {filled ? (
                      <div className="layout-editor-cell-label" title={labelForAssignment(cell)}>
                        {labelForAssignment(cell)}
                      </div>
                    ) : null}
                  </div>
                );
              }),
            ).flat()}
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto rounded-xl border border-slate-700/80 bg-slate-950/75 p-4 lg:w-[22rem]">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Assign to selection ({selection.size} cells)
            </label>
            <select
              value={elementChoice}
              onChange={(e) => setElementChoice(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs text-slate-100"
            >
              <option value="">— Choose element —</option>
              {dropdownOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyElementToSelection}
              disabled={!elementChoice || selection.size === 0}
              className="mt-2 w-full rounded-lg border border-emerald-700 bg-emerald-900/60 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-100 disabled:opacity-40"
            >
              Apply element
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
              Notes (per cell in selection)
            </label>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={5}
              placeholder='e.g. "At 1024×768 collapse to icon + context menu"'
              className="mt-2 w-full resize-y rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs text-slate-100 placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={applyNotesToSelection}
              disabled={selection.size === 0}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800/80 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 disabled:opacity-40"
            >
              Apply notes
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-700/80 pt-4">
            <button
              type="button"
              onClick={clearSelectionCells}
              disabled={selection.size === 0}
              className="rounded-lg border border-red-900/60 bg-red-950/40 py-2 text-[10px] font-black uppercase tracking-widest text-red-200 disabled:opacity-40"
            >
              Clear assignments in selection
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="rounded-lg border border-amber-600/70 bg-amber-500/15 py-2 text-[10px] font-black uppercase tracking-widest text-amber-100"
            >
              Download JSON export
            </button>
            <button
              type="button"
              onClick={() => void copyExport()}
              className="rounded-lg border border-slate-600 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200"
            >
              Copy JSON to clipboard
            </button>
          </div>

          <p className="text-[9px] leading-relaxed text-slate-500">
            Extra slots: curse zone, room chat, tyrant crown (game). Local multiplayer + dev menu are Game UI for now.
            Export: viewport CSS px, per-layer repeat(16|10, minmax(0,1fr)) templates, sparse cells with notes.
          </p>
        </aside>
      </div>
    </div>
  );
}
