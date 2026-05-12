/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { GAME_ELEMENT_OPTIONS, GAME_UI_OPTIONS } from './constants';
import './layoutEditor.css';
import { LayoutEditorLivePreview } from './LayoutEditorLivePreview';
import { createLayoutEditorPreviewRoom } from './layoutEditorPreviewRoom';
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

function buildExport(args: {
  viewport: { width: number; height: number };
  previewCanvas: { width: number; height: number };
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
    previewCanvas: args.previewCanvas,
    schema: 'cardcatch.layoutEditor.export.v1',
    layers: {
      game: pack('game', args.gameCells),
      ui: pack('ui', args.uiCells),
    },
  };
}

const PREVIEW_PRESETS = [
  { label: '1024 × 768 (iPad-class)', w: 1024, h: 768 },
  { label: '1366 × 768', w: 1366, h: 768 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '2560 × 1024', w: 2560, h: 1024 },
] as const;

function seedDemoAssignments(): {
  game: Record<string, LayoutCellAssignment>;
  ui: Record<string, LayoutCellAssignment>;
} {
  const game: Record<string, LayoutCellAssignment> = {};
  const ui: Record<string, LayoutCellAssignment> = {};
  const markRect = (
    map: Record<string, LayoutCellAssignment>,
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    a: LayoutCellAssignment,
  ) => {
    const sc = Math.min(c0, c1);
    const ec = Math.max(c0, c1);
    const sr = Math.min(r0, r1);
    const er = Math.max(r0, r1);
    for (let c = sc; c <= ec; c++) {
      for (let r = sr; r <= er; r++) {
        map[cellKey(c, r)] = a;
      }
    }
  };
  markRect(game, 1, 0, 5, 1, { kind: 'game', element: 'opponent_cards', notes: '' });
  markRect(game, 6, 2, 9, 5, { kind: 'game', element: 'play_area', notes: 'Target wheel + trump' });
  markRect(game, 0, 3, 1, 4, { kind: 'game', element: 'curse_zone', notes: '' });
  markRect(game, 10, 3, 11, 4, { kind: 'game', element: 'deck', notes: '' });
  markRect(game, 5, 6, 7, 7, { kind: 'game', element: 'fire_bowl', notes: '' });
  markRect(game, 1, 8, 5, 9, { kind: 'game', element: 'player_cards', notes: '' });
  markRect(game, 8, 8, 10, 9, { kind: 'game', element: 'player_power_cards', notes: '' });
  markRect(game, 0, 0, 0, 1, { kind: 'game', element: 'opponent_tokens', notes: '' });
  markRect(game, 15, 8, 15, 9, { kind: 'game', element: 'player_tokens', notes: '' });
  markRect(ui, 12, 0, 15, 0, { kind: 'ui', element: 'room_code_copy', notes: '' });
  markRect(ui, 12, 1, 13, 1, { kind: 'ui', element: 'settings_button', notes: '' });
  markRect(ui, 14, 1, 15, 1, { kind: 'ui', element: 'rules_button', notes: '' });
  markRect(ui, 6, 9, 8, 9, { kind: 'ui', element: 'play_card_button', notes: '' });
  markRect(ui, 9, 9, 10, 9, { kind: 'ui', element: 'cash_chips_button', notes: '' });
  return { game, ui };
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
  const [previewW, setPreviewW] = useState(1024);
  const [previewH, setPreviewH] = useState(768);
  const previewRoom = useMemo(() => createLayoutEditorPreviewRoom(), []);
  const dragRef = useRef<{ anchorCol: number; anchorRow: number } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsBtnRef = useRef<HTMLButtonElement | null>(null);
  const toolsPanelRef = useRef<HTMLDivElement | null>(null);

  const activeMap = layer === 'game' ? gameCells : uiCells;
  const setActiveMap = layer === 'game' ? setGameCells : setUiCells;

  const dropdownOptions = useMemo(
    () => (layer === 'game' ? GAME_ELEMENT_OPTIONS : GAME_UI_OPTIONS),
    [layer],
  );

  useEffect(() => {
    setElementChoice('');
  }, [layer]);

  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false);
    };
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (toolsPanelRef.current?.contains(t)) return;
      if (toolsBtnRef.current?.contains(t)) return;
      setToolsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocDown);
    };
  }, [toolsOpen]);

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
    (e: React.PointerEvent<HTMLDivElement>) => {
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
    setToolsOpen(false);
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
    setToolsOpen(false);
  }, [notesDraft, selection, setActiveMap]);

  const clearSelectionCells = useCallback(() => {
    if (selection.size === 0) return;
    setActiveMap((prev) => {
      const next = { ...prev };
      for (const k of selection) delete next[k];
      return next;
    });
    setSelection(new Set());
    setToolsOpen(false);
  }, [selection, setActiveMap]);

  const exportJson = useCallback(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const payload = buildExport({
      viewport,
      previewCanvas: { width: previewW, height: previewH },
      gameCells,
      uiCells,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-editor-${viewport.width}x${viewport.height}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToolsOpen(false);
  }, [gameCells, uiCells, previewW, previewH]);

  const copyExport = useCallback(async () => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const payload = buildExport({
      viewport,
      previewCanvas: { width: previewW, height: previewH },
      gameCells,
      uiCells,
    });
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setToolsOpen(false);
    } catch {
      /* ignore */
    }
  }, [gameCells, uiCells, previewW, previewH]);

  const loadDemo = useCallback(() => {
    const { game, ui } = seedDemoAssignments();
    setGameCells(game);
    setUiCells(ui);
    setSelection(new Set());
    setToolsOpen(false);
  }, []);

  return (
    <div className="layout-editor-root fixed inset-0 z-[600] flex flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700/80 bg-slate-950/90 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Layout editor</h1>
          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:mt-1">
            Dev · {LAYOUT_GRID_COLS}×{LAYOUT_GRID_ROWS} · drag on preview to select ·{' '}
            <span className="text-slate-400">{selection.size} selected</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <button
              ref={toolsBtnRef}
              type="button"
              onClick={() => setToolsOpen((o) => !o)}
              aria-expanded={toolsOpen}
              aria-haspopup="dialog"
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition sm:py-2.5 ${
                toolsOpen
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-100'
                  : 'border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Menu className="h-4 w-4 shrink-0" aria-hidden />
              Tools
            </button>
            {toolsOpen ? (
              <div
                ref={toolsPanelRef}
                role="dialog"
                aria-label="Layout editor tools"
                className="absolute right-0 top-full z-[620] mt-2 max-h-[min(72dvh,32rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-slate-600/90 bg-slate-950/95 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
              >
                <p className="border-b border-slate-700/80 pb-3 text-[10px] font-semibold uppercase leading-relaxed tracking-wide text-slate-400">
                  Layer, preview size, assign elements, notes, and export. Click outside or press Escape to close.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
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

                <div className="mt-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Live preview canvas
                  </label>
                  <select
                    value={`${previewW}x${previewH}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setPreviewW(w!);
                      setPreviewH(h!);
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs font-bold text-slate-100"
                  >
                    {PREVIEW_PRESETS.map((p) => (
                      <option key={`${p.w}x${p.h}`} value={`${p.w}x${p.h}`}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-slate-500">
                    Scales to fit. Regions use overflow-auto so clipping shows scrollbars in the tool.
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-700/80 pt-4">
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

                <div className="mt-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Notes (per cell in selection)
                  </label>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
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

                <div className="mt-5 flex flex-col gap-2 border-t border-slate-700/80 pt-4">
                  <button
                    type="button"
                    onClick={loadDemo}
                    className="rounded-lg border border-sky-700/60 bg-sky-950/50 py-2 text-[10px] font-black uppercase tracking-widest text-sky-100"
                  >
                    Load demo placements
                  </button>
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

                <p className="mt-4 text-[9px] leading-relaxed text-slate-500">
                  Live preview uses real components + a fixture room (no GameService). Export includes viewport, preview
                  canvas size, grid FR templates, and cell notes.
                </p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-800"
          >
            <X className="h-4 w-4" aria-hidden />
            Close
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <LayoutEditorLivePreview
          paintMode
          gridRef={gridRef}
          selection={selection}
          onGridPointerDown={handleGridPointerDown}
          layer={layer}
          cells={activeMap}
          room={previewRoom}
          myUid={previewRoom.hostUid}
          previewWidth={previewW}
          previewHeight={previewH}
        />
      </div>
    </div>
  );
}
