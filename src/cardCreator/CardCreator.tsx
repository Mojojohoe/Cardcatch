import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Image as ImageIcon, Grid3x3, Trash2, Save } from 'lucide-react';
import { SUITS, VALUES } from '../types';
import { useCardArt } from '../cardArt/cardArtContext';
import type { CardArtOverride, PipGridCell } from '../cardArt/types';
import { PIP_GRID_COLS, PIP_GRID_ROWS } from '../cardArt/types';
import { defaultPipCellsForRank } from '../cardArt/pipLayouts';
import { ScaledAssembledCardFace } from '../cardArt/ScaledAssembledCardFace';
import { cardArtAssetUrl } from '../cardArt/paths';

const ALL_SUIT_CARDS: string[] = [];
for (const s of SUITS) {
  for (const v of VALUES) {
    ALL_SUIT_CARDS.push(`${s}-${v}`);
  }
}

function splitCardId(id: string): { suit: string; value: string } {
  const i = id.indexOf('-');
  return { suit: id.slice(0, i), value: id.slice(i + 1) };
}

type EditorMode = 'default' | 'upload' | 'file' | 'pips';

export const CardCreator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { manifest, updateOverride, setMode, mode: displayMode, manifestVersion } = useCardArt();
  const [selected, setSelected] = useState(ALL_SUIT_CARDS[0] ?? 'Hearts-2');
  const [tab, setTab] = useState<EditorMode>('default');
  const [fileName, setFileName] = useState('');
  const [localOverride, setLocalOverride] = useState<CardArtOverride | null>(null);

  const p = useMemo(() => splitCardId(selected), [selected]);

  useEffect(() => {
    const m = manifest[selected];
    setLocalOverride(m ? { ...m } : null);
    setFileName(m?.customImageFile ?? '');
  }, [selected, manifestVersion, manifest]);

  const draft = localOverride;

  const setDraft = useCallback(
    (
      next:
        | CardArtOverride
        | null
        | ((prev: CardArtOverride | null) => CardArtOverride | null),
    ) => {
      if (typeof next === 'function') setLocalOverride(next);
      else setLocalOverride(next);
    },
    [],
  );

  const handleSave = () => {
    const clean: CardArtOverride = {};
    if (draft?.customDataUrl) clean.customDataUrl = draft.customDataUrl;
    if (draft?.customImageFile?.trim()) clean.customImageFile = draft.customImageFile.trim();
    if (draft?.pipGrid?.length) clean.pipGrid = draft.pipGrid;
    if (!clean.customDataUrl && !clean.customImageFile && !clean.pipGrid?.length) {
      updateOverride(selected, null);
    } else {
      updateOverride(selected, clean);
    }
  };

  const handleClear = () => {
    setLocalOverride(null);
    updateOverride(selected, null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const u = typeof r.result === 'string' ? r.result : '';
      setDraft({ ...draft, customDataUrl: u, customImageFile: undefined });
    };
    r.readAsDataURL(f);
  };

  const pipRank =
    p.value === 'A' || p.value === 'J' || p.value === 'Q' || p.value === 'K' ? null : p.value;

  const gridCells: PipGridCell[] = useMemo(() => {
    if (pipRank === null) return [];
    if (draft?.pipGrid && draft.pipGrid.length > 0) return draft.pipGrid;
    return defaultPipCellsForRank(pipRank) ?? [];
  }, [draft?.pipGrid, pipRank]);

  const togglePipCell = (col: number, row: number) => {
    if (pipRank === null) return;
    const cur = draft?.pipGrid && draft.pipGrid.length > 0 ? [...draft.pipGrid] : [...(defaultPipCellsForRank(pipRank) ?? [])];
    const i = cur.findIndex((c) => c.col === col && c.row === row);
    if (i >= 0) cur.splice(i, 1);
    else cur.push({ col, row });
    setDraft({ ...draft, customDataUrl: undefined, customImageFile: undefined, pipGrid: cur });
  };

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Card Creator</h1>
          <p className="text-[10px] text-slate-500">
            Configure assembled 256×374 art. Assets live in <code className="text-slate-400">public/assets/images</code> — copied to{' '}
            <code className="text-slate-400">dist</code> on build.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="mr-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
            <span>Table art</span>
            <button
              type="button"
              onClick={() => setMode('vector')}
              className={`rounded border px-2 py-1 ${displayMode === 'vector' ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-slate-700'}`}
            >
              Vector
            </button>
            <button
              type="button"
              onClick={() => setMode('raster')}
              className={`rounded border px-2 py-1 ${displayMode === 'raster' ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-slate-700'}`}
            >
              Assembled
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold uppercase text-slate-300 hover:bg-slate-800"
          >
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-800 p-2">
          <p className="mb-2 text-[9px] font-black uppercase text-slate-500">Suit cards</p>
          <div className="flex flex-col gap-0.5">
            {ALL_SUIT_CARDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                  selected === id ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {id}
                {manifest[id] ? ' *' : ''}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('default')}
              className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                tab === 'default' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
              }`}
            >
              Default
            </button>
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                tab === 'upload' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Upload
            </button>
            <button
              type="button"
              onClick={() => setTab('file')}
              className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                tab === 'file' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
              }`}
            >
              File path
            </button>
            <button
              type="button"
              disabled={pipRank === null}
              onClick={() => setTab('pips')}
              className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase disabled:opacity-40 ${
                tab === 'pips' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
              }`}
            >
              <Grid3x3 className="h-3.5 w-3.5" /> Pip grid
            </button>
          </div>

          <div className="flex flex-wrap gap-8">
            <div className="w-[200px] shrink-0">
              <p className="mb-2 text-[10px] font-black uppercase text-slate-500">Preview</p>
              <div className="overflow-hidden rounded-xl border border-slate-700 bg-black shadow-xl">
                <ScaledAssembledCardFace card={selected} override={draft ?? undefined} />
              </div>
              <p className="mt-2 text-[9px] text-slate-500">
                Aspect locked to {256}:{374}. Ensure PNGs match if replacing full card.
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              {tab === 'default' && (
                <div className="text-sm text-slate-400">
                  Uses <code className="text-slate-300">CardBasicLight.png</code>,{' '}
                  <code className="text-slate-300">Suit{p.suit}.png</code>, and built-in pip maps (or picture slots{' '}
                  <code className="text-slate-300">{selected}.png</code> for J/Q/K/A). Place files in{' '}
                  <code className="text-slate-300">public/assets/images</code>.
                </div>
              )}

              {tab === 'upload' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Store a 256×374 (or same aspect) image in this browser. Clears when localStorage is cleared.</p>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="text-xs" />
                  {draft?.customDataUrl && (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, customDataUrl: undefined })}
                      className="text-xs text-rose-400 underline"
                    >
                      Remove uploaded image
                    </button>
                  )}
                </div>
              )}

              {tab === 'file' && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Filename only — file must exist at runtime:{' '}
                    <code className="block truncate text-slate-300">{cardArtAssetUrl(fileName || 'example.png')}</code>
                  </p>
                  <input
                    value={fileName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFileName(v);
                      setDraft((prev) => {
                        const base = prev ?? {};
                        const next: CardArtOverride = { ...base };
                        if (v.trim()) {
                          next.customImageFile = v.trim();
                          delete next.customDataUrl;
                        } else {
                          delete next.customImageFile;
                        }
                        return Object.keys(next).length ? next : null;
                      });
                    }}
                    placeholder="Hearts-5-custom.png"
                    className="w-full max-w-md rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                  />
                </div>
              )}

              {tab === 'pips' && pipRank !== null && (
                <div>
                  <p className="mb-2 text-xs text-slate-400">
                    Click a cell to toggle a pip center (ranks 2–9, and 10). Overrides default layout for this rank only.
                  </p>
                  <div
                    className="inline-grid gap-px rounded border border-slate-700 bg-slate-800 p-1"
                    style={{
                      gridTemplateColumns: `repeat(${PIP_GRID_COLS}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${PIP_GRID_ROWS}, minmax(0, 1fr))`,
                      width: 'min(100%, 420px)',
                      aspectRatio: `${PIP_GRID_COLS} / ${PIP_GRID_ROWS}`,
                    }}
                  >
                    {Array.from({ length: PIP_GRID_COLS * PIP_GRID_ROWS }).map((_, i) => {
                      const col = i % PIP_GRID_COLS;
                      const row = Math.floor(i / PIP_GRID_COLS);
                      const on = gridCells.some((c) => c.col === col && c.row === row);
                      return (
                        <button
                          key={i}
                          type="button"
                          title={`${col},${row}`}
                          onClick={() => togglePipCell(col, row)}
                          className={`relative min-h-0 min-w-0 rounded-[1px] ${on ? 'bg-amber-500/70' : 'bg-slate-900 hover:bg-slate-700'}`}
                        >
                          <span className="sr-only">
                            {col},{row}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-600">
                    {gridCells.length} pip(s). Fine-tune positions by toggling cells.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black uppercase text-emerald-950"
            >
              <Save className="h-4 w-4" /> Save card
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg border border-rose-800 px-4 py-2 text-xs font-black uppercase text-rose-300"
            >
              <Trash2 className="h-4 w-4" /> Clear override
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
