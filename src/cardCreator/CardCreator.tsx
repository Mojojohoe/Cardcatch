import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Image as ImageIcon, Grid3x3, Trash2, Save, Layers, SlidersHorizontal } from 'lucide-react';
import { SUITS, VALUES } from '../types';
import { useCardArt } from '../cardArt/cardArtContext';
import type { CardArtGlobalDefaults, CardArtOverride, PipSlot } from '../cardArt/types';
import { PIP_GRID_COLS, PIP_GRID_ROWS } from '../cardArt/types';
import { defaultPipCellsForRank } from '../cardArt/pipLayouts';
import { cyclePipAtCell } from '../cardArt/resolveCardArt';
import { ScaledAssembledCardFace } from '../cardArt/ScaledAssembledCardFace';
import { cardArtAssetUrl } from '../cardArt/paths';

const ALL_SUIT_CARDS: string[] = [];
for (const s of SUITS) {
  for (const v of VALUES) {
    ALL_SUIT_CARDS.push(`${s}-${v}`);
  }
}

const SHARED_RANK_OPTIONS = VALUES.filter((v) => !['J', 'Q', 'K'].includes(v));

function splitCardId(id: string): { suit: string; value: string } {
  const i = id.indexOf('-');
  return { suit: id.slice(0, i), value: id.slice(i + 1) };
}

type Scope = 'card' | 'defaults';
type CardTab = 'info' | 'upload' | 'file' | 'pips';
type DefaultsTab = 'backgrounds' | 'pipScale' | 'sharedPips';

function PipGridEditor({
  slots,
  onChange,
}: {
  slots: PipSlot[];
  onChange: (s: PipSlot[]) => void;
}) {
  const onCell = (col: number, row: number) => {
    onChange(cyclePipAtCell(slots, col, row));
  };

  const slotAt = (col: number, row: number) => slots.find((s) => s.col === col && s.row === row);

  const cellClass = (col: number, row: number) => {
    const s = slotAt(col, row);
    if (!s) return 'bg-slate-900 hover:bg-slate-700';
    const o = s.o ?? 0;
    if (o === 0) return 'bg-amber-500/75 ring-1 ring-amber-300/80';
    if (o === 1) return 'bg-sky-500/75 ring-1 ring-sky-300/80';
    if (o === 2) return 'bg-violet-500/75 ring-1 ring-violet-300/80';
    return 'bg-rose-500/75 ring-1 ring-rose-300/80';
  };

  return (
    <div>
      <p className="mb-2 text-[10px] text-slate-500">
        Clicks: 1st adds · then flip H · flip V · both · remove. Legend: amber=normal, sky=H, violet=V, rose=HV.
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
          return (
            <button
              key={i}
              type="button"
              title={`${col},${row}`}
              onClick={() => onCell(col, row)}
              className={`relative min-h-0 min-w-0 rounded-[1px] ${cellClass(col, row)}`}
            >
              <span className="sr-only">{col},{row}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-600">{slots.length} pip(s)</p>
    </div>
  );
}

export const CardCreator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    manifest,
    updateOverride,
    setMode,
    mode: displayMode,
    manifestVersion,
    defaults,
    setDefaults,
    defaultsVersion,
  } = useCardArt();

  const [scope, setScope] = useState<Scope>('card');
  const [cardTab, setCardTab] = useState<CardTab>('info');
  const [defaultsTab, setDefaultsTab] = useState<DefaultsTab>('backgrounds');

  const [selected, setSelected] = useState(ALL_SUIT_CARDS[0] ?? 'Hearts-2');
  const [fileName, setFileName] = useState('');
  const [localOverride, setLocalOverride] = useState<CardArtOverride | null>(null);
  const [draftDefaults, setDraftDefaults] = useState<CardArtGlobalDefaults>(defaults);

  const [sharedRank, setSharedRank] = useState<string>('2');

  const p = useMemo(() => splitCardId(selected), [selected]);

  useEffect(() => {
    const m = manifest[selected];
    setLocalOverride(m ? { ...m } : null);
    setFileName(m?.customImageFile ?? '');
  }, [selected, manifestVersion, manifest]);

  useEffect(() => {
    setDraftDefaults({ ...defaults });
  }, [defaults, defaultsVersion]);

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

  const pipRank =
    p.value === 'A' || p.value === 'J' || p.value === 'Q' || p.value === 'K' ? null : p.value;

  const cardGridSlots: PipSlot[] = useMemo(() => {
    if (pipRank === null) return [];
    if (draft?.pipGrid && draft.pipGrid.length > 0) return draft.pipGrid.map((s) => ({ ...s, o: s.o ?? 0 }));
    return (defaultPipCellsForRank(pipRank) ?? []).map((s) => ({ ...s, o: s.o ?? 0 }));
  }, [draft?.pipGrid, pipRank]);

  const sharedSlots: PipSlot[] = useMemo(() => {
    const cur = draftDefaults.sharedPipLayoutByRank?.[sharedRank];
    if (cur && cur.length > 0) return cur.map((s) => ({ ...s, o: s.o ?? 0 }));
    return (defaultPipCellsForRank(sharedRank) ?? []).map((s) => ({ ...s, o: s.o ?? 0 }));
  }, [draftDefaults.sharedPipLayoutByRank, sharedRank]);

  const handleSaveCard = () => {
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

  const handleClearCard = () => {
    setLocalOverride(null);
    updateOverride(selected, null);
  };

  const handleSaveDefaults = () => {
    setDefaults(draftDefaults);
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

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Card Creator</h1>
          <p className="text-[10px] text-slate-500">
            Per-card overrides vs global defaults (all Hearts background, pip scales, shared rank layouts).
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
          <div className="mb-3 flex rounded border border-slate-700 p-0.5 text-[9px] font-black uppercase">
            <button
              type="button"
              className={`flex-1 rounded px-2 py-1 ${scope === 'card' ? 'bg-emerald-800/80 text-white' : 'text-slate-500'}`}
              onClick={() => setScope('card')}
            >
              Card
            </button>
            <button
              type="button"
              className={`flex-1 rounded px-2 py-1 ${scope === 'defaults' ? 'bg-emerald-800/80 text-white' : 'text-slate-500'}`}
              onClick={() => setScope('defaults')}
            >
              Defaults
            </button>
          </div>
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
          {scope === 'card' && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCardTab('info')}
                  className={`rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                    cardTab === 'info' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
                  }`}
                >
                  Info
                </button>
                <button
                  type="button"
                  onClick={() => setCardTab('upload')}
                  className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                    cardTab === 'upload' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Upload
                </button>
                <button
                  type="button"
                  onClick={() => setCardTab('file')}
                  className={`rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                    cardTab === 'file' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
                  }`}
                >
                  File path
                </button>
                <button
                  type="button"
                  disabled={pipRank === null}
                  onClick={() => setCardTab('pips')}
                  className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase disabled:opacity-40 ${
                    cardTab === 'pips' ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200' : 'border-slate-700'
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
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  {cardTab === 'info' && (
                    <div className="text-sm text-slate-400">
                      Global defaults apply unless this card has overrides. Uses{' '}
                      <code className="text-slate-300">CardBasicLight</code> / suit backgrounds / shared layouts from Defaults.
                    </div>
                  )}
                  {cardTab === 'upload' && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Full-card image (256×374 aspect).</p>
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
                  {cardTab === 'file' && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">
                        Resolved URL:{' '}
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
                  {cardTab === 'pips' && pipRank !== null && (
                    <PipGridEditor
                      slots={cardGridSlots}
                      onChange={(slots) =>
                        setDraft((prev) => ({
                          ...(prev ?? {}),
                          pipGrid: slots,
                          customDataUrl: undefined,
                          customImageFile: undefined,
                        }))
                      }
                    />
                  )}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={handleSaveCard}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black uppercase text-emerald-950"
                >
                  <Save className="h-4 w-4" /> Save card
                </button>
                <button
                  type="button"
                  onClick={handleClearCard}
                  className="flex items-center gap-2 rounded-lg border border-rose-800 px-4 py-2 text-xs font-black uppercase text-rose-300"
                >
                  <Trash2 className="h-4 w-4" /> Clear card override
                </button>
              </div>
            </>
          )}

          {scope === 'defaults' && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDefaultsTab('backgrounds')}
                  className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                    defaultsTab === 'backgrounds'
                      ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200'
                      : 'border-slate-700'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" /> Suit backgrounds
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultsTab('pipScale')}
                  className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                    defaultsTab === 'pipScale'
                      ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200'
                      : 'border-slate-700'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Pip size ranges
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultsTab('sharedPips')}
                  className={`flex items-center gap-1 rounded border px-3 py-2 text-[11px] font-bold uppercase ${
                    defaultsTab === 'sharedPips'
                      ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200'
                      : 'border-slate-700'
                  }`}
                >
                  <Grid3x3 className="h-3.5 w-3.5" /> Shared rank pips
                </button>
              </div>

              <div className="flex flex-wrap gap-8">
                <div className="w-[200px] shrink-0">
                  <p className="mb-2 text-[10px] font-black uppercase text-slate-500">Preview ({selected})</p>
                  <div className="overflow-hidden rounded-xl border border-slate-700 bg-black shadow-xl">
                    <ScaledAssembledCardFace
                      card={selected}
                      override={manifest[selected]}
                      previewDefaults={draftDefaults}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  {defaultsTab === 'backgrounds' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        Filename in <code className="text-slate-300">public/assets/images/</code> (extensions auto-tried). Falls back to CardBasicLight.
                      </p>
                      {(['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const).map((suit) => (
                        <label key={suit} className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-300">{suit}</span>
                          <input
                            value={draftDefaults.suitBackgroundFile?.[suit] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraftDefaults((prev) => ({
                                ...prev,
                                suitBackgroundFile: {
                                  ...prev.suitBackgroundFile,
                                  [suit]: v.trim() || undefined,
                                },
                              }));
                            }}
                            placeholder="MyHeartsFace.png"
                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {defaultsTab === 'pipScale' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        Ranks use deck order (2…A). Later rows override earlier if ranges overlap.
                      </p>
                      {(draftDefaults.pipScaleRanges ?? []).map((row, idx) => (
                        <div key={idx} className="flex flex-wrap items-end gap-2">
                          <label className="text-[10px] uppercase text-slate-500">
                            From
                            <select
                              value={row.from}
                              onChange={(e) => {
                                const ranges = [...(draftDefaults.pipScaleRanges ?? [])];
                                ranges[idx] = { ...ranges[idx], from: e.target.value };
                                setDraftDefaults((p) => ({ ...p, pipScaleRanges: ranges }));
                              }}
                              className="ml-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            >
                              {VALUES.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[10px] uppercase text-slate-500">
                            To
                            <select
                              value={row.to}
                              onChange={(e) => {
                                const ranges = [...(draftDefaults.pipScaleRanges ?? [])];
                                ranges[idx] = { ...ranges[idx], to: e.target.value };
                                setDraftDefaults((p) => ({ ...p, pipScaleRanges: ranges }));
                              }}
                              className="ml-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            >
                              {VALUES.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[10px] uppercase text-slate-500">
                            Scale
                            <input
                              type="number"
                              step={0.05}
                              min={0.25}
                              max={3}
                              value={row.scale}
                              onChange={(e) => {
                                const ranges = [...(draftDefaults.pipScaleRanges ?? [])];
                                ranges[idx] = { ...ranges[idx], scale: Number(e.target.value) || 1 };
                                setDraftDefaults((p) => ({ ...p, pipScaleRanges: ranges }));
                              }}
                              className="ml-1 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            />
                          </label>
                          <button
                            type="button"
                            className="rounded border border-rose-900 px-2 py-1 text-[10px] uppercase text-rose-400"
                            onClick={() => {
                              const ranges = [...(draftDefaults.pipScaleRanges ?? [])];
                              ranges.splice(idx, 1);
                              setDraftDefaults((p) => ({ ...p, pipScaleRanges: ranges }));
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="rounded border border-slate-600 px-3 py-1.5 text-[11px] font-bold uppercase text-slate-300"
                        onClick={() =>
                          setDraftDefaults((p) => ({
                            ...p,
                            pipScaleRanges: [...(p.pipScaleRanges ?? []), { from: '2', to: '10', scale: 1 }],
                          }))
                        }
                      >
                        Add range
                      </button>
                    </div>
                  )}

                  {defaultsTab === 'sharedPips' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        Layout applies to every suit for this rank (e.g. all four 3s). Each card still uses its suit artwork.
                      </p>
                      <label className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-slate-400">Rank</span>
                        <select
                          value={sharedRank}
                          onChange={(e) => setSharedRank(e.target.value)}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                        >
                          {SHARED_RANK_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                      <PipGridEditor
                        slots={sharedSlots}
                        onChange={(slots) =>
                          setDraftDefaults((prev) => ({
                            ...prev,
                            sharedPipLayoutByRank: {
                              ...prev.sharedPipLayoutByRank,
                              [sharedRank]: slots,
                            },
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="text-[11px] text-rose-400 underline"
                        onClick={() =>
                          setDraftDefaults((prev) => {
                            const next = { ...prev.sharedPipLayoutByRank };
                            delete next[sharedRank];
                            return { ...prev, sharedPipLayoutByRank: next };
                          })
                        }
                      >
                        Clear shared layout for this rank
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={handleSaveDefaults}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black uppercase text-emerald-950"
                >
                  <Save className="h-4 w-4" /> Save defaults
                </button>
                <button
                  type="button"
                  onClick={() => setDraftDefaults({ ...defaults })}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-bold uppercase text-slate-400"
                >
                  Revert to saved
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
