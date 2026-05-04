import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Image as ImageIcon, Grid3x3, Trash2, Save, Layers, SlidersHorizontal, Download, Upload } from 'lucide-react';
import { SUITS, VALUES } from '../types';
import { useCardArt } from '../cardArt/cardArtContext';
import type { BackgroundCaptionConfig, CardArtGlobalDefaults, CardArtOverride, PipSlot } from '../cardArt/types';
import { PIP_GRID_COLS, PIP_GRID_ROWS } from '../cardArt/types';
import { defaultPipCellsForRank } from '../cardArt/pipLayouts';
import { cyclePipAtCell } from '../cardArt/resolveCardArt';
import { ScaledAssembledCardFace } from '../cardArt/ScaledAssembledCardFace';
import { cardArtAssetUrl } from '../cardArt/paths';
import { isAssembledRasterCardId } from '../cardArt/assembledRaster';
import { buildCardArtPackExport, parseCardArtPackImport } from '../cardArt/packExport';
import { PUBLIC_CARD_ART_PACK_FILENAME, publicCardArtPackFetchUrl } from '../cardArt/publicPack';
import { PowerCardVisual } from '../components/GameVisuals';
import { WRATH_MINION_BY_ROUND } from '../services/gameService';
import { CURSE_IDS, CURSES } from '../curses';

const ALL_SUIT_CARDS: string[] = [];
for (const s of SUITS) {
  for (const v of VALUES) {
    ALL_SUIT_CARDS.push(`${s}-${v}`);
  }
}

const EXTENDED_SUIT_CARDS: string[] = [];
for (const s of ['Stars', 'Moons', 'Frogs', 'Coins', 'Bones'] as const) {
  for (const v of VALUES) {
    EXTENDED_SUIT_CARDS.push(`${s}-${v}`);
  }
}

const SPECIAL_PLAYING = ['Hearts-G', 'Crowns-E', 'Grovels-1', ...WRATH_MINION_BY_ROUND.map((r) => r.id)];

const JOKER_CARDS = ['Joker-1', 'Joker-2'] as const;

const POWER_MANIFEST_KEYS = Array.from({ length: 22 }, (_, i) => `power-${i}` as const);
const CURSE_MANIFEST_KEYS = CURSE_IDS.map((id) => `curse-${id}` as const);
/** Face-down majors in the opponent row (`staticBackdrop`) — maps to raster mode custom art */
const BACK_POWER_MAJOR = 'back-power' as const;
const BACK_ROLE_KEYS = ['back-prey', 'back-predator', 'back-preydator', 'back-deck'] as const;

/** Ranks 2…A and God of Hearts (G) for shared layouts + scale ranges. */
const SHARED_RANK_OPTIONS = [...VALUES, 'G'].filter((v) => !['J', 'Q', 'K'].includes(v));

const RANK_RANGE_OPTIONS = [...VALUES, 'G'];

function pruneBackgroundCaption(bc?: BackgroundCaptionConfig): BackgroundCaptionConfig | undefined {
  if (!bc) return undefined;
  const next: BackgroundCaptionConfig = {};
  if (bc.text?.trim()) next.text = bc.text.trim();
  if (bc.scale != null) next.scale = bc.scale;
  if (bc.anchorXPct != null) next.anchorXPct = bc.anchorXPct;
  if (bc.anchorYPct != null) next.anchorYPct = bc.anchorYPct;
  if (bc.maxWidthPct != null) next.maxWidthPct = bc.maxWidthPct;
  if (bc.mirrorDual === true) next.mirrorDual = true;
  if (bc.color?.trim()) next.color = bc.color.trim();
  return Object.keys(next).length > 0 ? next : undefined;
}

/** Same shape as persisted overrides (matches "Save card"). */
function buildCleanCardOverrideForPack(draft: CardArtOverride | null): CardArtOverride | null {
  if (!draft) return null;
  const clean: CardArtOverride = {};
  if (draft.customDataUrl) clean.customDataUrl = draft.customDataUrl;
  if (draft.customImageFile?.trim()) clean.customImageFile = draft.customImageFile.trim();
  if (draft.pipGrid?.length) clean.pipGrid = draft.pipGrid;
  if (draft.backgroundOnly) clean.backgroundOnly = true;
  const capSaved = pruneBackgroundCaption(draft.backgroundCaption);
  if (capSaved) clean.backgroundCaption = capSaved;
  const opDraft = draft.faceTextOpacity;
  if (typeof opDraft === 'number' && Number.isFinite(opDraft)) {
    const c = Math.min(1, Math.max(0, opDraft));
    if (c !== 1) clean.faceTextOpacity = c;
  }
  const centre = draft.centrePictureFile?.trim();
  if (centre) clean.centrePictureFile = centre;
  const cps = draft.centrePictureScale;
  if (typeof cps === 'number' && Number.isFinite(cps)) {
    clean.centrePictureScale = Math.min(3, Math.max(0.25, cps));
  }
  return Object.keys(clean).length === 0 ? null : clean;
}

function trySplitPlaying(id: string): { suit: string; value: string } | null {
  if (id.startsWith('power-') || id.startsWith('curse-') || id.startsWith('back-')) return null;
  const i = id.indexOf('-');
  if (i <= 0) return null;
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
    setManifest,
    updateOverride,
    setMode,
    mode: displayMode,
    manifestVersion,
    defaults,
    setDefaults,
    defaultsVersion,
  } = useCardArt();

  const packImportInputRef = useRef<HTMLInputElement>(null);
  const [packIoBanner, setPackIoBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [scope, setScope] = useState<Scope>('card');
  const [cardTab, setCardTab] = useState<CardTab>('info');
  const [defaultsTab, setDefaultsTab] = useState<DefaultsTab>('backgrounds');

  const [selected, setSelected] = useState(ALL_SUIT_CARDS[0] ?? 'Hearts-2');
  const [fileName, setFileName] = useState('');
  const [localOverride, setLocalOverride] = useState<CardArtOverride | null>(null);
  const [draftDefaults, setDraftDefaults] = useState<CardArtGlobalDefaults>(defaults);

  const [sharedRank, setSharedRank] = useState<string>('2');

  const playingParts = useMemo(() => trySplitPlaying(selected), [selected]);
  const showCentrePictureField = Boolean(
    selected.startsWith('Joker') ||
      (playingParts && ['A', 'J', 'Q', 'K', 'G'].includes(playingParts.value)),
  );

  useEffect(() => {
    const m = manifest[selected];
    setLocalOverride(m ? { ...m } : null);
    setFileName(m?.customImageFile ?? '');
  }, [selected, manifestVersion, manifest]);

  useEffect(() => {
    setDraftDefaults({ ...defaults });
  }, [defaults, defaultsVersion]);

  const draft = localOverride;

  const handleExportCardArtPack = useCallback(() => {
    // Defaults tab edits live in `draftDefaults` until "Save defaults"; export must include that or the JSON is empty.
    const mergedManifest = { ...manifest };
    const cleanCard = buildCleanCardOverrideForPack(localOverride);
    if (cleanCard) mergedManifest[selected] = cleanCard;

    const pack = buildCardArtPackExport(displayMode, mergedManifest, draftDefaults);
    setDefaults(draftDefaults);
    if (cleanCard) updateOverride(selected, cleanCard);

    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = PUBLIC_CARD_ART_PACK_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
    setPackIoBanner({
      type: 'ok',
      text: `Downloaded ${PUBLIC_CARD_ART_PACK_FILENAME} (includes current Defaults tab + this card if edited). Put it in public/ and reload.`,
    });
  }, [displayMode, manifest, draftDefaults, selected, localOverride, setDefaults, updateOverride]);

  const handleImportCardArtPackFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const parsed = parseCardArtPackImport(raw);
          if (parsed.ok === false) {
            setPackIoBanner({ type: 'err', text: parsed.error });
            return;
          }
          if (
            !window.confirm(
              'Replace all table art in this browser from this file? Unsaved changes and current localStorage pack will be overwritten.',
            )
          ) {
            return;
          }
          setMode(parsed.pack.mode);
          setManifest(parsed.pack.manifest);
          setDefaults(parsed.pack.defaults);
          setPackIoBanner({
            type: 'ok',
            text: "Imported. Your pack is saved to this browser's local storage again.",
          });
        } catch (e) {
          setPackIoBanner({
            type: 'err',
            text: e instanceof Error ? e.message : 'Could not read JSON.',
          });
        }
      };
      reader.onerror = () => setPackIoBanner({ type: 'err', text: 'Could not read file.' });
      reader.readAsText(file, 'utf-8');
    },
    [setMode, setManifest, setDefaults],
  );

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
    playingParts && !['J', 'Q', 'K'].includes(playingParts.value) ? playingParts.value : null;

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

  const showPipGridTab = isAssembledRasterCardId(selected) && pipRank !== null;

  const previewPowerId = selected.startsWith('power-') ? Number(selected.slice(6)) : NaN;
  const previewCurseId = selected.startsWith('curse-') ? Number(selected.slice(6)) : NaN;
  const previewIsBack = selected.startsWith('back-');

  const handleSaveCard = () => {
    const clean = buildCleanCardOverrideForPack(draft);
    if (clean === null) {
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
    <div className="fixed inset-0 z-[6000] flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Card Creator</h1>
            <p className="text-[10px] text-slate-500">
              Per-card overrides vs global defaults. Export JSON uses your current Defaults tab and the selected card as shown — you do not need to click Save defaults / Save card first (export also persists them here).
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={packImportInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) handleImportCardArtPackFile(f);
              }}
            />
            <button
              type="button"
              onClick={handleExportCardArtPack}
              className="flex items-center gap-1 rounded-lg border border-sky-700/80 bg-sky-950/50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-sky-200 hover:bg-sky-900/60"
              title={`Save as ${PUBLIC_CARD_ART_PACK_FILENAME} in public/ — runtime URL ${publicCardArtPackFetchUrl()}`}
            >
              <Download className="h-3.5 w-3.5" /> Export JSON
            </button>
            <button
              type="button"
              onClick={() => packImportInputRef.current?.click()}
              className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-300 hover:bg-slate-800"
              title="Load a previously exported pack into this browser"
            >
              <Upload className="h-3.5 w-3.5" /> Import…
            </button>
            <div className="mr-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
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
                Artwork
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
        </div>
        {packIoBanner && (
          <p
            className={`mt-2 text-[10px] font-bold uppercase tracking-wide ${
              packIoBanner.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {packIoBanner.text}
          </p>
        )}
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
          <p className="mb-2 text-[9px] font-black uppercase text-slate-500">Standard suits</p>
          <div className="mb-3 flex flex-col gap-0.5">
            {ALL_SUIT_CARDS.map((rowId) => (
              <button
                key={rowId}
                type="button"
                onClick={() => setSelected(rowId)}
                className={`rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                  selected === rowId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {rowId}
                {manifest[rowId] ? ' *' : ''}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[9px] font-black uppercase text-slate-500">Special & extended</p>
          <div className="mb-3 flex max-h-36 flex-col gap-0.5 overflow-y-auto">
            {SPECIAL_PLAYING.map((rowId) => (
              <button
                key={rowId}
                type="button"
                onClick={() => setSelected(rowId)}
                className={`rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                  selected === rowId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {rowId}
                {manifest[rowId] ? ' *' : ''}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[9px] font-black uppercase text-slate-500">Stars · Moons · Frogs · Coins · Bones</p>
          <div className="mb-3 flex max-h-36 flex-col gap-0.5 overflow-y-auto">
            {EXTENDED_SUIT_CARDS.map((rowId) => (
              <button
                key={rowId}
                type="button"
                onClick={() => setSelected(rowId)}
                className={`rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                  selected === rowId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {rowId}
                {manifest[rowId] ? ' *' : ''}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[9px] font-black uppercase text-slate-500">Jokers</p>
          <div className="mb-3 flex flex-col gap-0.5">
            {JOKER_CARDS.map((rowId) => (
              <button
                key={rowId}
                type="button"
                onClick={() => setSelected(rowId)}
                className={`rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                  selected === rowId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {rowId}
                {manifest[rowId] ? ' *' : ''}
              </button>
            ))}
          </div>
          <p className="mb-1 text-[9px] font-black uppercase text-slate-500">Power faces</p>
          <p className="mb-2 text-[8px] leading-snug text-slate-600">Manifest keys · power-0 … power-21 (Major Arcana)</p>
          <div className="mb-3 flex max-h-28 flex-col gap-0.5 overflow-y-auto">
            {POWER_MANIFEST_KEYS.map((rowId) => (
              <button
                key={rowId}
                type="button"
                onClick={() => setSelected(rowId)}
                className={`rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                  selected === rowId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {rowId}
                {manifest[rowId] ? ' *' : ''}
              </button>
            ))}
          </div>

          <p className="mb-1 text-[9px] font-black uppercase text-slate-500">Curses</p>
          <p className="mb-2 text-[8px] leading-snug text-slate-600">
            curse IDs 105 = Envy, 107 = Green-Eyed Monster (same table rules; distinct card art/title).
          </p>
          <div className="mb-3 flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {CURSE_MANIFEST_KEYS.map((rowId) => {
              const num = Number(rowId.slice('curse-'.length));
              const def = CURSES[num];
              return (
                <button
                  key={rowId}
                  type="button"
                  onClick={() => setSelected(rowId)}
                  className={`rounded px-2 py-1 text-left ${
                    selected === rowId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className="block font-mono text-[10px]">
                    {rowId}
                    {manifest[rowId] ? ' *' : ''}
                  </span>
                  {def ? (
                    <span className="block truncate text-[8px] opacity-75">
                      {def.sin} · {def.name}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <p className="mb-1 text-[9px] font-black uppercase text-slate-500">Opponent pile (majors)</p>
          <p className="mb-2 text-[8px] leading-snug text-slate-600">
            Face-down anonymous power cards (staticBackdrop) use key <span className="font-mono">back-power</span>.
          </p>
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setSelected(BACK_POWER_MAJOR)}
              className={`w-full rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                selected === BACK_POWER_MAJOR ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {BACK_POWER_MAJOR}
              {manifest[BACK_POWER_MAJOR] ? ' *' : ''}
            </button>
          </div>

          <p className="mb-1 text-[9px] font-black uppercase text-slate-500">Deck &amp; role backs</p>
          <div className="flex max-h-24 flex-col gap-0.5 overflow-y-auto">
            {BACK_ROLE_KEYS.map((rowId) => (
              <button
                key={rowId}
                type="button"
                onClick={() => setSelected(rowId)}
                className={`rounded px-2 py-1.5 text-left text-[10px] font-mono ${
                  selected === rowId ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {rowId}
                {manifest[rowId] ? ' *' : ''}
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
                  disabled={!showPipGridTab}
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
                    {Number.isFinite(previewPowerId) && selected.startsWith('power-') ? (
                      <PowerCardVisual cardId={previewPowerId} small matchHandCard revealed curseRackPeek />
                    ) : Number.isFinite(previewCurseId) && selected.startsWith('curse-') ? (
                      <PowerCardVisual cardId={previewCurseId} small matchHandCard revealed curseRackPeek />
                    ) : previewIsBack ? (
                      <div
                        className="flex w-full items-center justify-center bg-zinc-900 text-[10px] text-slate-500"
                        style={{ aspectRatio: '24 / 37' }}
                      >
                        {draft?.customDataUrl ? (
                          <img src={draft.customDataUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                        ) : draft?.customImageFile?.trim() ? (
                          <img
                            src={cardArtAssetUrl(draft.customImageFile.trim())}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <span className="p-4 text-center">Upload or file path — keys like back-prey</span>
                        )}
                      </div>
                    ) : (
                      <ScaledAssembledCardFace card={selected} override={draft ?? undefined} />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  {cardTab === 'info' && (
                    <div className="space-y-4 text-sm text-slate-400">
                      <p>
                        Global defaults apply unless this card has overrides. Uses{' '}
                        <code className="text-slate-300">CardBasicLight</code> / suit backgrounds / shared layouts from Defaults.
                      </p>
                      <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                        <input
                          type="checkbox"
                          checked={Boolean(draft?.backgroundOnly)}
                          onChange={(e) =>
                            setDraft((prev) => {
                              const base = { ...(prev ?? {}) };
                              if (e.target.checked) base.backgroundOnly = true;
                              else delete base.backgroundOnly;
                              return Object.keys(base).length ? base : null;
                            })
                          }
                          className="mt-1"
                        />
                        <span>
                          <span className="font-bold text-slate-300">Background only</span> — hide corner index and centre pips
                          / art; show only the face background (and optional solid underlay from Defaults). Use when your
                          background image already includes the full design.
                        </span>
                      </label>
                      <label className="block text-[11px] text-slate-400">
                        Face text opacity for this card (0–1, blank = use defaults)
                        <input
                          type="number"
                          step={0.05}
                          min={0}
                          max={1}
                          value={
                            draft?.faceTextOpacity !== undefined && draft?.faceTextOpacity !== null ? draft.faceTextOpacity : ''
                          }
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            setDraft((prev) => {
                              const base = { ...(prev ?? {}) };
                              if (!raw.length) {
                                delete base.faceTextOpacity;
                              } else {
                                const n = Number(raw);
                                if (!Number.isFinite(n)) return prev;
                                base.faceTextOpacity = Math.min(1, Math.max(0, n));
                              }
                              return Object.keys(base).length ? base : null;
                            });
                          }}
                          placeholder="inherit"
                          className="mt-1 w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                        />
                      </label>
                      <div className="rounded border border-slate-800 p-3 text-[11px] text-slate-400">
                        <p className="mb-2 font-bold text-slate-300">Overlay caption (shows when Background only is on)</p>
                        <p className="mb-2 text-[10px] text-slate-500">
                          Per-card text merges over <strong className="text-slate-400">Defaults → Background-only caption defaults</strong>.
                          Leave blank here to use defaults only (still movable there). Anchor 50/50 is card centre.
                        </p>
                        <textarea
                          value={draft?.backgroundCaption?.text ?? ''}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...(prev ?? {}),
                              backgroundCaption: { ...prev?.backgroundCaption, text: e.target.value },
                            }))
                          }
                          rows={3}
                          placeholder="Optional printed text on this card…"
                          className="mb-2 w-full max-w-md rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-sans text-xs text-slate-200"
                        />
                        <label className="mb-2 block max-w-md text-[11px] text-slate-400">
                          Caption colour (CSS, optional — else suit preset)
                          <input
                            value={draft?.backgroundCaption?.color ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setDraft((prev) => {
                                const base = { ...(prev ?? {}) };
                                const bc = { ...base.backgroundCaption };
                                if (v) bc.color = v;
                                else delete bc.color;
                                base.backgroundCaption = Object.keys(bc).length ? bc : undefined;
                                return Object.keys(base).length ? base : null;
                              });
                            }}
                            placeholder="#hex or coral"
                            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
                          />
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <label className="text-slate-400">
                            Scale
                            <input
                              type="number"
                              step={0.05}
                              min={0.25}
                              max={4}
                              value={draft?.backgroundCaption?.scale ?? 1}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...(prev ?? {}),
                                  backgroundCaption: {
                                    ...prev?.backgroundCaption,
                                    scale: Number(e.target.value) || 1,
                                  },
                                }))
                              }
                              className="ml-2 w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-xs"
                            />
                          </label>
                          <label className="text-slate-400">
                            Anchor X %
                            <input
                              type="number"
                              step={0.5}
                              value={draft?.backgroundCaption?.anchorXPct ?? 50}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...(prev ?? {}),
                                  backgroundCaption: {
                                    ...prev?.backgroundCaption,
                                    anchorXPct: Number(e.target.value) ?? 50,
                                  },
                                }))
                              }
                              className="ml-2 w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-xs"
                            />
                          </label>
                          <label className="text-slate-400">
                            Anchor Y %
                            <input
                              type="number"
                              step={0.5}
                              value={draft?.backgroundCaption?.anchorYPct ?? 50}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...(prev ?? {}),
                                  backgroundCaption: {
                                    ...prev?.backgroundCaption,
                                    anchorYPct: Number(e.target.value) ?? 50,
                                  },
                                }))
                              }
                              className="ml-2 w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-xs"
                            />
                          </label>
                          <label className="text-slate-400">
                            Max width %
                            <input
                              type="number"
                              step={1}
                              min={10}
                              max={100}
                              value={draft?.backgroundCaption?.maxWidthPct ?? 88}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...(prev ?? {}),
                                  backgroundCaption: {
                                    ...prev?.backgroundCaption,
                                    maxWidthPct: Number(e.target.value) || 88,
                                  },
                                }))
                              }
                              className="ml-2 w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-xs"
                            />
                          </label>
                        </div>
                        <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={Boolean(draft?.backgroundCaption?.mirrorDual)}
                            onChange={(e) =>
                              setDraft((prev) => {
                                const base = { ...(prev ?? {}) };
                                const bc = { ...(base.backgroundCaption ?? {}) };
                                if (e.target.checked) bc.mirrorDual = true;
                                else delete bc.mirrorDual;
                                base.backgroundCaption = Object.keys(bc).length ? bc : undefined;
                                return Object.keys(base).length ? base : null;
                              })
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <strong className="text-slate-300">Dual / mirrored caption</strong> — second copy through the
                            card centre (rotate 180°), like opposite corner indices.
                          </span>
                        </label>
                      </div>
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
                      {showCentrePictureField && (
                        <div className="mt-3 space-y-1 rounded border border-slate-800 bg-slate-950/50 p-3">
                          <p className="text-[11px] font-bold text-slate-300">Centre court image (artwork mode)</p>
                          <p className="text-[10px] leading-snug text-slate-500">
                            Optional filename in <code className="text-slate-400">public/assets/images/</code> for the large
                            centre graphic (tried <em>before</em> <code className="text-slate-400">{selected}</code>
                            .png). Use for custom Ace / royalty / God / Joker art without replacing the whole card.
                          </p>
                          <input
                            value={draft?.centrePictureFile ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setDraft((prev) => {
                                const base = { ...(prev ?? {}) };
                                if (v) base.centrePictureFile = v;
                                else delete base.centrePictureFile;
                                return Object.keys(base).length ? base : null;
                              });
                            }}
                            placeholder={`e.g. ${selected}-ace-art (no extension)`}
                            className="w-full max-w-md rounded border border-slate-700 bg-slate-900 px-2 py-2 font-mono text-xs"
                          />
                          <label className="mt-2 block text-[11px] text-slate-400">
                            Centre image scale (0.25–3, blank = use defaults)
                            <input
                              type="number"
                              step={0.05}
                              min={0.25}
                              max={3}
                              value={
                                draft?.centrePictureScale !== undefined && draft?.centrePictureScale !== null
                                  ? draft.centrePictureScale
                                  : ''
                              }
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                setDraft((prev) => {
                                  const base = { ...(prev ?? {}) };
                                  if (!raw.length) {
                                    delete base.centrePictureScale;
                                    return Object.keys(base).length ? base : null;
                                  }
                                  const n = Number(raw);
                                  if (!Number.isFinite(n)) return prev;
                                  base.centrePictureScale = Math.min(3, Math.max(0.25, n));
                                  return base;
                                });
                              }}
                              placeholder="from Defaults (1)"
                              className="mt-1 w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                            />
                          </label>
                        </div>
                      )}
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
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Scales & corners
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
                    {isAssembledRasterCardId(selected) ? (
                      <ScaledAssembledCardFace
                        card={selected}
                        override={manifest[selected]}
                        previewDefaults={draftDefaults}
                      />
                    ) : Number.isFinite(previewPowerId) && selected.startsWith('power-') ? (
                      <PowerCardVisual cardId={previewPowerId} small matchHandCard revealed curseRackPeek />
                    ) : Number.isFinite(previewCurseId) && selected.startsWith('curse-') ? (
                      <PowerCardVisual cardId={previewCurseId} small matchHandCard revealed curseRackPeek />
                    ) : previewIsBack ? (
                      <div
                        className="flex w-full items-center justify-center bg-zinc-900 text-[9px] text-slate-500"
                        style={{ aspectRatio: '24 / 37' }}
                      >
                        Deck / role back art
                      </div>
                    ) : (
                      <div className="flex aspect-[24/37] items-center justify-center p-2 text-center text-[10px] text-slate-500">
                        Select a playing card, joker, or power id for preview.
                      </div>
                    )}
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
                      <p className="pt-2 text-[10px] font-black uppercase text-slate-500">Extra suits &amp; joker</p>
                      {(['Stars', 'Moons', 'Frogs', 'Coins', 'Bones', 'Crowns', 'Grovels', 'Swords', 'Joker'] as const).map(
                        (suit) => (
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
                              placeholder={`${suit} face stem`}
                              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs"
                            />
                          </label>
                        ),
                      )}
                      <label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] text-slate-400">
                        <input
                          type="checkbox"
                          checked={Boolean(draftDefaults.backgroundOnly)}
                          onChange={(e) =>
                            setDraftDefaults((prev) => {
                              const next = { ...prev };
                              if (e.target.checked) next.backgroundOnly = true;
                              else delete next.backgroundOnly;
                              return next;
                            })
                          }
                          className="mt-0.5"
                        />
                        <span>
                          Default to <strong className="text-slate-300">background-only</strong> faces (no corners / centre
                          art).
                        </span>
                      </label>
                      <label className="flex flex-col gap-1 text-[11px]">
                        <span className="font-bold text-slate-300">Solid underlay (behind transparent PNG)</span>
                        <input
                          value={draftDefaults.faceUnderlayColor ?? '#000000'}
                          onChange={(e) =>
                            setDraftDefaults((prev) => ({ ...prev, faceUnderlayColor: e.target.value || '#000000' }))
                          }
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs"
                        />
                      </label>

                      <p className="mt-4 text-[11px] font-bold text-slate-300">Corner rank & caption text colour (per suit)</p>
                      <p className="mb-2 text-[10px] text-slate-500">
                        CSS colours (#hex or name). Blank uses the built‑in preset for each suit on artwork faces (corners,
                        royalty rank fallback, background-only captions).
                      </p>
                      {(['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const).map((suit) => (
                        <label key={`tc-${suit}`} className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-slate-300">{suit} text</span>
                          <input
                            value={draftDefaults.suitFaceTextColor?.[suit] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setDraftDefaults((prev) => {
                                const nextMap = { ...prev.suitFaceTextColor };
                                if (v) nextMap[suit] = v;
                                else delete nextMap[suit];
                                return {
                                  ...prev,
                                  suitFaceTextColor: Object.keys(nextMap).length ? nextMap : undefined,
                                };
                              });
                            }}
                            placeholder={`e.g. ${suit === 'Diamonds' ? '#ffffff' : '#…'}`}
                            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs"
                          />
                        </label>
                      ))}
                      {(['Stars', 'Moons', 'Frogs', 'Coins', 'Bones', 'Crowns', 'Grovels', 'Swords', 'Joker'] as const).map(
                        (suit) => (
                          <label key={`tc-${suit}`} className="flex flex-col gap-1 text-[11px]">
                            <span className="font-bold text-slate-300">{suit} text</span>
                            <input
                              value={draftDefaults.suitFaceTextColor?.[suit] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                setDraftDefaults((prev) => {
                                  const nextMap = { ...prev.suitFaceTextColor };
                                  if (v) nextMap[suit] = v;
                                  else delete nextMap[suit];
                                  return {
                                    ...prev,
                                    suitFaceTextColor: Object.keys(nextMap).length ? nextMap : undefined,
                                  };
                                });
                              }}
                              placeholder="blank = preset"
                              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs"
                            />
                          </label>
                        ),
                      )}

                      <p className="mt-4 text-[11px] font-bold text-slate-300">Background-only caption defaults</p>
                      <p className="mb-2 text-[10px] text-slate-500">
                        Shown on any background-only card when the card does not override caption text. Anchors and dual
                        mirror apply; you can mirror here and override only the string on a card.
                      </p>
                      <textarea
                        value={draftDefaults.backgroundCaptionDefaults?.text ?? ''}
                        onChange={(e) =>
                          setDraftDefaults((prev) => ({
                            ...prev,
                            backgroundCaptionDefaults: {
                              ...prev.backgroundCaptionDefaults,
                              text: e.target.value,
                            },
                          }))
                        }
                        rows={2}
                        className="mb-2 w-full max-w-md rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
                        placeholder="Default overlay text…"
                      />
                      <label className="mb-2 block max-w-md text-[11px] text-slate-400">
                        Default caption colour (optional — overrides suit preset for captions)
                        <input
                          value={draftDefaults.backgroundCaptionDefaults?.color ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            setDraftDefaults((prev) => {
                              const bc = { ...prev.backgroundCaptionDefaults };
                              if (v) bc.color = v;
                              else delete bc.color;
                              return {
                                ...prev,
                                backgroundCaptionDefaults: Object.keys(bc).length ? bc : undefined,
                              };
                            });
                          }}
                          placeholder="blank = per suit colours above"
                          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-200"
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <label className="text-[11px] text-slate-400">
                          Scale
                          <input
                            type="number"
                            step={0.05}
                            min={0.25}
                            max={4}
                            value={draftDefaults.backgroundCaptionDefaults?.scale ?? 1}
                            onChange={(e) =>
                              setDraftDefaults((prev) => ({
                                ...prev,
                                backgroundCaptionDefaults: {
                                  ...prev.backgroundCaptionDefaults,
                                  scale: Number(e.target.value) || 1,
                                },
                              }))
                            }
                            className="ml-2 w-16 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-xs"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Anchors X/Y
                          <input
                            type="number"
                            step={0.5}
                            value={draftDefaults.backgroundCaptionDefaults?.anchorXPct ?? 50}
                            onChange={(e) =>
                              setDraftDefaults((prev) => ({
                                ...prev,
                                backgroundCaptionDefaults: {
                                  ...prev.backgroundCaptionDefaults,
                                  anchorXPct: Number(e.target.value) ?? 50,
                                },
                              }))
                            }
                            className="ml-2 w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-xs"
                          />
                          <input
                            type="number"
                            step={0.5}
                            value={draftDefaults.backgroundCaptionDefaults?.anchorYPct ?? 50}
                            onChange={(e) =>
                              setDraftDefaults((prev) => ({
                                ...prev,
                                backgroundCaptionDefaults: {
                                  ...prev.backgroundCaptionDefaults,
                                  anchorYPct: Number(e.target.value) ?? 50,
                                },
                              }))
                            }
                            className="ml-1 w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 font-mono text-xs"
                          />
                        </label>
                      </div>
                      <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] text-slate-400">
                        <input
                          type="checkbox"
                          checked={Boolean(draftDefaults.backgroundCaptionDefaults?.mirrorDual)}
                          onChange={(e) =>
                            setDraftDefaults((prev) => {
                              const d = { ...(prev.backgroundCaptionDefaults ?? {}) };
                              if (e.target.checked) d.mirrorDual = true;
                              else delete d.mirrorDual;
                              return {
                                ...prev,
                                backgroundCaptionDefaults: Object.keys(d).length ? d : undefined,
                              };
                            })
                          }
                          className="mt-0.5"
                        />
                        <span>
                          <strong className="text-slate-300">Default dual / mirrored caption</strong> — applies unless a
                          card turns this off via its own caption block.
                        </span>
                      </label>
                    </div>
                  )}

                  {defaultsTab === 'pipScale' && (
                    <div className="space-y-6">
                      <div>
                        <p className="mb-2 text-[11px] font-bold text-slate-300">Centre pip scale</p>
                        <p className="mb-2 text-xs text-slate-400">
                          Large suit symbols in the court. Ranks 2…A and G. Later rows win on overlap.
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
                              {RANK_RANGE_OPTIONS.map((v) => (
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
                              {RANK_RANGE_OPTIONS.map((v) => (
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
                        Add pip range
                      </button>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-bold text-slate-300">Corner notifier scale</p>
                        <p className="mb-2 text-xs text-slate-400">
                          Rank numeral + small suit next to it — independent from centre pips.
                        </p>
                        {(draftDefaults.notifierScaleRanges ?? []).map((row, idx) => (
                          <div key={idx} className="mb-2 flex flex-wrap items-end gap-2">
                            <label className="text-[10px] uppercase text-slate-500">
                              From
                              <select
                                value={row.from}
                                onChange={(e) => {
                                  const ranges = [...(draftDefaults.notifierScaleRanges ?? [])];
                                  ranges[idx] = { ...ranges[idx], from: e.target.value };
                                  setDraftDefaults((p) => ({ ...p, notifierScaleRanges: ranges }));
                                }}
                                className="ml-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                              >
                                {RANK_RANGE_OPTIONS.map((v) => (
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
                                  const ranges = [...(draftDefaults.notifierScaleRanges ?? [])];
                                  ranges[idx] = { ...ranges[idx], to: e.target.value };
                                  setDraftDefaults((p) => ({ ...p, notifierScaleRanges: ranges }));
                                }}
                                className="ml-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                              >
                                {RANK_RANGE_OPTIONS.map((v) => (
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
                                  const ranges = [...(draftDefaults.notifierScaleRanges ?? [])];
                                  ranges[idx] = { ...ranges[idx], scale: Number(e.target.value) || 1 };
                                  setDraftDefaults((p) => ({ ...p, notifierScaleRanges: ranges }));
                                }}
                                className="ml-1 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                              />
                            </label>
                            <button
                              type="button"
                              className="rounded border border-rose-900 px-2 py-1 text-[10px] uppercase text-rose-400"
                              onClick={() => {
                                const ranges = [...(draftDefaults.notifierScaleRanges ?? [])];
                                ranges.splice(idx, 1);
                                setDraftDefaults((p) => ({ ...p, notifierScaleRanges: ranges }));
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
                              notifierScaleRanges: [...(p.notifierScaleRanges ?? []), { from: '2', to: '10', scale: 1 }],
                            }))
                          }
                        >
                          Add notifier range
                        </button>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-bold text-slate-300">Rank &amp; notifier corner offsets</p>
                        <p className="mb-2 text-xs text-slate-400">
                          Rank offsets are % toward the interior from each corner anchor. Applied on both diagonal corners;
                          symmetric mode uses the same sign on bottom-right toward the centre.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <label className="text-[11px] text-slate-400">
                            Text scale
                            <input
                              type="number"
                              step={0.05}
                              min={0.25}
                              max={3}
                              value={draftDefaults.cornerText?.scale ?? 1}
                              onChange={(e) =>
                                setDraftDefaults((prev) => ({
                                  ...prev,
                                  cornerText: {
                                    ...prev.cornerText,
                                    scale: Number(e.target.value) || 1,
                                  },
                                }))
                              }
                              className="ml-2 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="text-[11px] text-slate-400">
                            Rank offset X %
                            <input
                              type="number"
                              step={0.5}
                              value={draftDefaults.cornerText?.offsetLeftXPct ?? 0}
                              onChange={(e) =>
                                setDraftDefaults((prev) => ({
                                  ...prev,
                                  cornerText: {
                                    ...prev.cornerText,
                                    offsetLeftXPct: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="ml-2 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="text-[11px] text-slate-400">
                            Rank offset Y %
                            <input
                              type="number"
                              step={0.5}
                              value={draftDefaults.cornerText?.offsetTopYPct ?? 0}
                              onChange={(e) =>
                                setDraftDefaults((prev) => ({
                                  ...prev,
                                  cornerText: {
                                    ...prev.cornerText,
                                    offsetTopYPct: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="ml-2 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            />
                          </label>
                        </div>
                        <p className="mt-3 text-[11px] font-semibold text-slate-400">Notifier suit (small pip)</p>
                        <p className="mb-2 text-[10px] leading-snug text-slate-500">
                          Blank X ⇒ same inward shift as rank. Blank Y ⇒ auto stack beneath the rank glyph. Same symmetric
                          bottom-corner rule as rank when enabled below.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <label className="text-[11px] text-slate-400">
                            Notifier offset X %
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="blank→rank X"
                              value={
                                draftDefaults.cornerText?.notifierOffsetLeftXPct !== undefined &&
                                draftDefaults.cornerText?.notifierOffsetLeftXPct !== null
                                  ? String(draftDefaults.cornerText.notifierOffsetLeftXPct)
                                  : ''
                              }
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                setDraftDefaults((prev) => {
                                  const ct = { ...prev.cornerText };
                                  if (!raw.length) delete ct.notifierOffsetLeftXPct;
                                  else {
                                    const n = Number(raw);
                                    if (!Number.isFinite(n)) return prev;
                                    ct.notifierOffsetLeftXPct = n;
                                  }
                                  return { ...prev, cornerText: ct };
                                });
                              }}
                              className="ml-2 w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                            />
                          </label>
                          <label className="text-[11px] text-slate-400">
                            Notifier offset Y %
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="blank→auto stack"
                              value={
                                draftDefaults.cornerText?.notifierOffsetTopYPct !== undefined &&
                                draftDefaults.cornerText?.notifierOffsetTopYPct !== null
                                  ? String(draftDefaults.cornerText.notifierOffsetTopYPct)
                                  : ''
                              }
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                setDraftDefaults((prev) => {
                                  const ct = { ...prev.cornerText };
                                  if (!raw.length) delete ct.notifierOffsetTopYPct;
                                  else {
                                    const n = Number(raw);
                                    if (!Number.isFinite(n)) return prev;
                                    ct.notifierOffsetTopYPct = n;
                                  }
                                  return { ...prev, cornerText: ct };
                                });
                              }}
                              className="ml-2 w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                            />
                          </label>
                        </div>
                        <label className="mt-2 flex cursor-pointer items-start gap-2 text-[11px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={draftDefaults.cornerText?.symmetricCorners !== false}
                            onChange={(e) =>
                              setDraftDefaults((prev) => {
                                const ct = { ...prev.cornerText };
                                if (e.target.checked) delete ct.symmetricCorners;
                                else ct.symmetricCorners = false;
                                return { ...prev, cornerText: ct };
                              })
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <strong className="text-slate-300">Symmetric offsets</strong> — bottom-right mirrors top-left toward
                            the card centre (same offset sign).
                          </span>
                        </label>
                        <label className="mt-2 block text-[11px] text-slate-400">
                          Face text opacity (0–1, blank = 1)
                          <input
                            type="number"
                            step={0.05}
                            min={0}
                            max={1}
                            value={
                              draftDefaults.faceTextOpacity !== undefined && draftDefaults.faceTextOpacity !== null
                                ? draftDefaults.faceTextOpacity
                                : ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              setDraftDefaults((prev) => {
                                const next = { ...prev };
                                if (!raw.length) {
                                  delete next.faceTextOpacity;
                                  return next;
                                }
                                const n = Number(raw);
                                if (!Number.isFinite(n)) return prev;
                                next.faceTextOpacity = Math.min(1, Math.max(0, n));
                                return next;
                              });
                            }}
                            placeholder="1"
                            className="mt-1 w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                          />
                        </label>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-bold text-slate-300">Centre court shift</p>
                        <p className="mb-2 text-[10px] text-slate-500">
                          Moves royalty / pip / joker centre art as % of card size (+X → right, +Y → down).
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <label className="text-[11px] text-slate-400">
                            X %
                            <input
                              type="number"
                              step={0.25}
                              value={draftDefaults.courtCentreOffsetPct?.x ?? 0}
                              onChange={(e) =>
                                setDraftDefaults((prev) => ({
                                  ...prev,
                                  courtCentreOffsetPct: {
                                    ...prev.courtCentreOffsetPct,
                                    x: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="ml-2 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="text-[11px] text-slate-400">
                            Y %
                            <input
                              type="number"
                              step={0.25}
                              value={draftDefaults.courtCentreOffsetPct?.y ?? 0}
                              onChange={(e) =>
                                setDraftDefaults((prev) => ({
                                  ...prev,
                                  courtCentreOffsetPct: {
                                    ...prev.courtCentreOffsetPct,
                                    y: Number(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="ml-2 w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                            />
                          </label>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] font-bold text-slate-300">Centre court image scale</p>
                        <p className="mb-2 text-[10px] text-slate-500">
                          Uniform scale for Ace / God / royalty / Joker centre rasters (artwork mode). Per-card scale
                          overrides this. Blank = 1.
                        </p>
                        <label className="text-[11px] text-slate-400">
                          Scale
                          <input
                            type="number"
                            step={0.05}
                            min={0.25}
                            max={3}
                            value={
                              draftDefaults.centrePictureScale !== undefined &&
                              draftDefaults.centrePictureScale !== null
                                ? draftDefaults.centrePictureScale
                                : ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              setDraftDefaults((prev) => {
                                const next = { ...prev };
                                if (!raw.length) {
                                  delete next.centrePictureScale;
                                  return next;
                                }
                                const n = Number(raw);
                                if (!Number.isFinite(n)) return prev;
                                next.centrePictureScale = Math.min(3, Math.max(0.25, n));
                                return next;
                              });
                            }}
                            placeholder="1"
                            className="ml-2 w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                          />
                        </label>
                      </div>
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
