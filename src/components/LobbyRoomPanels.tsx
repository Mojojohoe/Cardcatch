import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Dice3,
  Flame,
  Hash,
  Heart,
  Layers,
  Play,
  RefreshCw,
  Settings2,
  Skull,
  X,
  Zap,
} from 'lucide-react';
import type { GameSettings, RoomData } from '../types';
import { desperationTierRowsForDisplay } from '../types';
import {
  CUSTOM_LOBBY_PRESET_ID,
  BUILTIN_CARDCATCH_PRESET_ID,
  type SavedLobbyPreset,
} from '../settings/gameSettingsConstants';
import { listStaticBuiltinPresets, loadCustomPresets, saveCustomPresetList } from '../settings/lobbyPresetIO';
import { normalizeGameSettings } from '../settings/normalizeGameSettings';
import { standardDeckComposition, deckBlurb } from '../settings/deckMath';

/** Feature toggles share the same enabled/disabled silhouette (curse uses green when on, zinc when off — not “danger red”). */
function toggleTileClass(enabled: boolean, disabledGhost = false): string {
  if (disabledGhost) {
    return 'border-zinc-800/70 bg-zinc-950/50 text-zinc-600 opacity-45 pointer-events-none';
  }
  return enabled
    ? 'border-emerald-500/70 bg-emerald-950/40 text-emerald-100 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]'
    : 'border-zinc-700/90 bg-zinc-950/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400';
}

type HostLobbyPanelProps = {
  room: RoomData;
  tableCode: string;
  preySideLabelShort: string;
  loading: boolean;
  guestLobbyReady: boolean;
  showCopySuccess: boolean;
  onRoomIdCopy: () => void;
  onPatchSettings: (partial: Partial<GameSettings>) => void;
  /** Full replace (preset apply) — preserves fields not present in preset via normalize. */
  onApplyPreset: (presetId: string, partial?: Partial<GameSettings>) => void;
  onApplySavedPreset: (entry: SavedLobbyPreset) => void;
  onStartGame: () => void;
};

export const HostLobbyPanel: React.FC<HostLobbyPanelProps> = ({
  room,
  tableCode,
  preySideLabelShort,
  loading,
  guestLobbyReady,
  showCopySuccess,
  onRoomIdCopy,
  onPatchSettings,
  onApplyPreset,
  onApplySavedPreset,
  onStartGame,
}) => {
  const [advancedLobby, setAdvancedLobby] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');

  const builtin = useMemo(() => listStaticBuiltinPresets(), []);
  const customs = useMemo(() => loadCustomPresets(), [saveOpen, room.updatedAt]);

  const deckSnap = standardDeckComposition(room.settings);
  const handsFitDeck =
    room.settings.predatorStartingCards + room.settings.preyStartingCards <= deckSnap.total;
  const canDeal = handsFitDeck && Object.keys(room.players).length >= 2 && guestLobbyReady;

  const selectedPresetDescribe = builtin.find((b) => b.id === room.settings.lobbyPresetId)?.description;
  const customDescribe = customs.find((c) => c.id === room.settings.lobbyPresetId)?.description;

  const handlePresetDropdown = (value: string) => {
    if (value === CUSTOM_LOBBY_PRESET_ID || value === '') return;
    const b = builtin.find((x) => x.id === value);
    if (b?.partial) {
      onApplyPreset(b.id, b.partial as Partial<GameSettings>);
      return;
    }
    const c = customs.find((x) => x.id === value);
    if (c) onApplySavedPreset(c);
  };

  const presetIdKnown =
    room.settings.lobbyPresetId === CUSTOM_LOBBY_PRESET_ID ||
    [...builtin.map((b) => b.id), ...customs.map((c) => c.id)].includes(room.settings.lobbyPresetId);
  const selectValue = presetIdKnown ? room.settings.lobbyPresetId : CUSTOM_LOBBY_PRESET_ID;

  const savePreset = () => {
    const name = saveName.trim() || 'My preset';
    const description = saveDesc.trim() || 'Saved table rules';
    const id = `local:${Date.now()}`;
    const settings = normalizeGameSettings({ ...room.settings, lobbyPresetId: id });
    const row: SavedLobbyPreset = {
      id,
      name,
      description,
      settings: JSON.parse(JSON.stringify(settings)) as unknown as Record<string, unknown>,
    };
    saveCustomPresetList([...loadCustomPresets().filter((p) => p.id !== id), row]);
    const { lobbyPresetId: _lp, ...rest } = settings;
    void _lp;
    onApplyPreset(id, rest as Partial<GameSettings>);
    setSaveOpen(false);
    setSaveName('');
    setSaveDesc('');
  };

  const deckHelp = deckBlurb(room.settings);

  return (
    <>
      <div className="flex justify-between items-center rounded-xl border border-emerald-800 bg-emerald-900/30 p-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">TABLE LINK</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-black text-white">{tableCode}</span>
            <button type="button" onClick={onRoomIdCopy} className="p-1 text-yellow-400">
              {showCopySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">STATUS</span>
          <div className="animate-pulse text-xs font-black uppercase text-emerald-400">
            {Object.keys(room.players).length < 2
              ? 'WAITING FOR PLAYER 2'
              : guestLobbyReady
                ? 'OPPONENT READY'
                : 'WAITING FOR READY'}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="border-l-4 border-yellow-400 pl-3 text-xs font-black uppercase tracking-widest text-yellow-400">
            Table setup
          </h3>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-emerald-500">Host primary identity</label>
            <div className="flex rounded-xl border border-emerald-800 bg-emerald-900/50 p-1">
              {(['Predator', 'Prey', 'Preydator'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    onPatchSettings({
                      hostRole: r,
                    })
                  }
                  className={`flex-1 rounded-lg py-3 text-[10px] font-black uppercase transition-all ${
                    room.settings.hostRole === r
                      ? 'bg-yellow-400 text-emerald-950 shadow-lg'
                      : 'text-emerald-500 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-emerald-500">Presets</label>
            <div className="relative">
              <select
                aria-label="Match preset"
                value={selectValue}
                onChange={(e) => handlePresetDropdown(e.target.value)}
                className="w-full appearance-none rounded-xl border border-emerald-700/85 bg-emerald-950/90 py-3.5 pl-3 pr-10 text-[11px] font-black uppercase tracking-wide text-emerald-50 outline-none ring-0 focus:border-yellow-400/65"
              >
                <option value={CUSTOM_LOBBY_PRESET_ID}>Custom game settings</option>
                {builtin.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                {customs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (saved)
                  </option>
                ))}
              </select>
              <Settings2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
            </div>
            <p className="text-[10px] font-bold uppercase leading-snug text-emerald-400/95">
              {room.settings.lobbyPresetId === CUSTOM_LOBBY_PRESET_ID
                ? 'You are tuning a custom configuration — tweak advanced options below.'
                : selectedPresetDescribe || customDescribe || 'Bundled preset — enable advanced options to fine-tune every lever.'}
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-800/80 bg-emerald-950/30 px-3 py-2.5">
            <input
              type="checkbox"
              checked={advancedLobby}
              onChange={(e) => setAdvancedLobby(e.target.checked)}
              className="h-4 w-4 rounded border-emerald-700 text-yellow-400 focus:ring-yellow-400"
            />
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Advanced options</span>
          </label>

          {advancedLobby && (
            <>
              <div className="space-y-2 rounded-xl border border-emerald-800/70 bg-emerald-950/25 p-3">
                <label className="text-[10px] font-black uppercase text-emerald-500">
                  Starting suit cards{' '}
                  <span className="text-yellow-400/85">· Pred seat / Prey ({preySideLabelShort})</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1 block text-[9px] font-bold uppercase text-emerald-400">Predator count</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={room.settings.predatorStartingCards}
                      onChange={(e) =>
                        onPatchSettings({
                          predatorStartingCards: Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 1,
                        })
                      }
                      className="w-full rounded-lg border border-emerald-800 bg-emerald-900/45 px-3 py-2 text-sm font-black text-emerald-50 outline-none focus:border-yellow-400/60"
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[9px] font-bold uppercase text-emerald-400">Prey count</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={room.settings.preyStartingCards}
                      onChange={(e) =>
                        onPatchSettings({
                          preyStartingCards: Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 1,
                        })
                      }
                      className="w-full rounded-lg border border-emerald-800 bg-emerald-900/45 px-3 py-2 text-sm font-black text-emerald-50 outline-none focus:border-yellow-400/60"
                    />
                  </div>
                </div>
                <p className="text-[9px] font-bold uppercase leading-snug text-emerald-500/95">
                  Counts clamp to deck capacity — roles still map Predator seat vs prey seat from identity above.
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-emerald-800/70 bg-emerald-950/25 p-3">
                <span className="text-[10px] font-black uppercase text-emerald-500">Deck size</span>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onPatchSettings({
                          deckSizeMultiplier: Math.max(1, room.settings.deckSizeMultiplier - 1),
                        })
                      }
                      className="rounded-lg border border-emerald-800 bg-black/30 px-3 py-2 text-lg font-black text-yellow-400 hover:bg-emerald-900/70"
                      aria-label="Decrease deck copies"
                    >
                      −
                    </button>
                    <span className="min-w-[3rem] text-center font-mono text-lg font-black text-emerald-100">
                      ×{deckSnap.multiplier}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onPatchSettings({
                          deckSizeMultiplier: Math.min(24, room.settings.deckSizeMultiplier + 1),
                        })
                      }
                      className="rounded-lg border border-emerald-800 bg-black/30 px-3 py-2 text-lg font-black text-yellow-400 hover:bg-emerald-900/70"
                      aria-label="Increase deck copies"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="text-[10px] font-bold uppercase leading-snug text-emerald-300/95">{deckHelp}</p>
                {!handsFitDeck && (
                  <p className="border-l-4 border-red-500/70 pl-2 text-[10px] font-black uppercase tracking-wide text-red-300">
                    Starting hands exceed deck — lower counts or add deck copies before dealing.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onPatchSettings({ disableJokers: !room.settings.disableJokers })}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all ${toggleTileClass(!room.settings.disableJokers)}`}
                >
                  <Skull className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-black uppercase">Jokers</span>
                  <span className="text-[8px] font-bold">{room.settings.disableJokers ? 'OFF' : 'ACTIVE'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPatchSettings({ disablePowerCards: !room.settings.disablePowerCards })}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all ${toggleTileClass(!room.settings.disablePowerCards)}`}
                >
                  <Zap className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-black uppercase">Power cards</span>
                  <span className="text-[8px] font-bold">{room.settings.disablePowerCards ? 'OFF' : 'ACTIVE'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onPatchSettings({ enablePokerChips: !room.settings.enablePokerChips })}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all ${toggleTileClass(room.settings.enablePokerChips)}`}
                >
                  <Layers className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-black uppercase">Poker chips</span>
                  <span className="text-[8px] font-bold opacity-80">Rule module (later)</span>
                  <span className="text-[8px] font-bold">{room.settings.enablePokerChips ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPatchSettings({ enablePanicDice: !room.settings.enablePanicDice })}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all ${toggleTileClass(room.settings.enablePanicDice)}`}
                >
                  <Dice3 className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-black uppercase">Panic dice</span>
                  <span className="text-[8px] font-bold opacity-80">Rule module (later)</span>
                  <span className="text-[8px] font-bold">{room.settings.enablePanicDice ? 'ON' : 'OFF'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onPatchSettings({ enableCurseCards: !room.settings.enableCurseCards })}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all ${toggleTileClass(room.settings.enableCurseCards)}`}
                >
                  <Heart className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-black uppercase">Curse cards</span>
                  <span className="text-[8px] font-bold">{room.settings.enableCurseCards ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  disabled={room.settings.disablePowerCards || !room.settings.enableCurseCards}
                  onClick={() =>
                    onPatchSettings({
                      curseCardsInPowerDeck: !room.settings.curseCardsInPowerDeck,
                    })
                  }
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all ${toggleTileClass(
                    room.settings.curseCardsInPowerDeck,
                    room.settings.disablePowerCards || !room.settings.enableCurseCards,
                  )}`}
                >
                  <Flame className="mb-1 h-5 w-5" />
                  <span className="text-[10px] font-black uppercase">Curses in power deck</span>
                  <span className="text-[8px] font-bold text-center leading-tight">
                    {room.settings.curseCardsInPowerDeck ? 'Draft & draws' : 'Separate'}
                  </span>
                </button>
              </div>
            </>
          )}

          {!advancedLobby && (
            <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/35 px-3 py-3 text-[10px] font-bold uppercase leading-relaxed text-emerald-200/95">
              <span className="block text-yellow-400/95">
                {room.settings.lobbyPresetId === CUSTOM_LOBBY_PRESET_ID
                  ? 'Custom game settings'
                  : builtin.find((b) => b.id === room.settings.lobbyPresetId)?.name ??
                    customs.find((c) => c.id === room.settings.lobbyPresetId)?.name ??
                    room.settings.lobbyPresetId}
                {room.settings.lobbyPresetId === BUILTIN_CARDCATCH_PRESET_ID ? ' · Cardcatch default' : null}
              </span>
              <span className="mt-1 block text-emerald-400/90">
                Pred {room.settings.predatorStartingCards} / Prey {room.settings.preyStartingCards} · Deck ×{deckSnap.multiplier} (
                {deckSnap.total} cards)
              </span>
            </div>
          )}
        </div>

        {advancedLobby && (
          <div className="space-y-4">
            <h3 className="border-l-4 border-purple-400 pl-3 text-xs font-black uppercase tracking-widest text-purple-400">
              Last-chance wheel
            </h3>
            <div className="space-y-4 rounded-xl border border-purple-900/50 bg-purple-950/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-purple-400">Desperation wheel on</span>
                <button
                  type="button"
                  onClick={() => onPatchSettings({ enableDesperation: !room.settings.enableDesperation })}
                  className={`relative h-6 w-12 rounded-full transition-colors ${room.settings.enableDesperation ? 'bg-purple-600' : 'bg-emerald-900'}`}
                >
                  <div
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                      room.settings.enableDesperation ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {room.settings.enableDesperation && (
                <div className="space-y-3 border-t border-purple-900/40 pt-3">
                  <div className="flex items-center justify-between gap-4 pb-2">
                    <span className="text-[10px] font-bold normal-case leading-snug text-purple-100/95">
                      Tier 0 from deal — prey begins on ladder immediately when enabled.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onPatchSettings({
                          desperationStarterTierEnabled: !room.settings.desperationStarterTierEnabled,
                        })
                      }
                      className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
                        room.settings.desperationStarterTierEnabled ? 'bg-amber-500' : 'bg-emerald-900'
                      }`}
                    >
                      <div
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                          room.settings.desperationStarterTierEnabled ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div
                    className={`rounded-xl border p-4 space-y-3 transition-opacity ${
                      room.settings.hostRole !== 'Preydator'
                        ? 'pointer-events-none border-purple-950/55 bg-purple-950/10 opacity-40'
                        : 'border-purple-800/55 bg-purple-950/25'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-200">
                      Preydator · desperation access
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'guest' as const, label: 'Guest only', sub: 'Prey-aligned seat spins' },
                          { id: 'host' as const, label: 'Host only', sub: 'Host seat spins' },
                          { id: 'both' as const, label: 'Both', sub: 'Either seat spins' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={room.settings.hostRole !== 'Preydator'}
                          onClick={() => onPatchSettings({ preydatorDesperationSeats: opt.id })}
                          className={`min-w-[8rem] flex-1 rounded-lg border py-2 px-2 text-left transition-all ${
                            (room.settings.preydatorDesperationSeats ?? 'guest') === opt.id &&
                            room.settings.hostRole === 'Preydator'
                              ? 'border-amber-400 bg-amber-400/15 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.15)]'
                              : 'border-purple-900/70 bg-purple-950/40 text-purple-300/90 hover:border-purple-600'
                          }`}
                        >
                          <span className="block text-[9px] font-black uppercase">{opt.label}</span>
                          <span className="mt-1 block text-[7px] font-bold leading-tight text-purple-500/95">{opt.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {room.settings.tiers.map((tier, idx) => {
                    if (!room.settings.desperationStarterTierEnabled && idx === 0) return null;
                    return (
                      <div key={idx} className="flex gap-2">
                        <div className="flex min-w-[60px] items-center justify-center rounded border border-purple-800 bg-purple-900/50 px-2 py-1">
                          <span className="text-[8px] font-black text-purple-300">TIER {idx}</span>
                        </div>
                        <input
                          type="text"
                          value={tier}
                          onChange={(e) => {
                            const newTiers = [...room.settings.tiers];
                            newTiers[idx] = e.target.value;
                            onPatchSettings({ tiers: newTiers });
                          }}
                          className="flex-1 rounded border border-emerald-800 bg-emerald-900/50 px-3 py-1 text-[10px] text-white outline-none focus:border-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newTiers = room.settings.tiers.filter((_, i) => i !== idx);
                            onPatchSettings({ tiers: newTiers });
                          }}
                          className="rounded p-1 text-red-500 hover:bg-red-950/40"
                        >
                          <Hash className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>
                      onPatchSettings({
                        tiers: [...room.settings.tiers, `TIER ${room.settings.tiers.length}`],
                      })
                    }
                    className="w-full rounded border border-dashed border-purple-800 py-2 text-center text-[8px] font-black uppercase text-purple-400 hover:bg-purple-900/20"
                  >
                    + Add wheel tier label
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="w-full rounded-xl border border-dashed border-yellow-500/45 bg-yellow-500/10 py-3 text-[10px] font-black uppercase tracking-widest text-yellow-200 transition-colors hover:bg-yellow-500/15"
          >
            Save settings as preset
          </button>
          {Object.keys(room.players).length < 2 ? (
            <div className="rounded-xl border border-dashed border-emerald-800 bg-emerald-900/20 py-4 text-center">
              <span className="animate-pulse text-[10px] font-black uppercase text-emerald-700">WAITING FOR PLAYER 2...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartGame}
              disabled={loading || !canDeal}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-black uppercase tracking-widest shadow-[0_0_30px_rgba(250,204,21,0.3)] transition-all ${
                loading || !canDeal
                  ? 'cursor-not-allowed bg-emerald-900 text-emerald-700 opacity-70'
                  : 'bg-yellow-400 text-emerald-950 hover:scale-[1.02] active:scale-95'
              }`}
            >
              {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              DEAL & START
            </button>
          )}
          <p className="px-2 text-center text-[8px] font-bold uppercase leading-relaxed tracking-tight text-emerald-600">
            {Object.keys(room.players).length >= 2 && !guestLobbyReady
              ? 'You can tweak options until your opponent taps Ready on their screen.'
              : 'Only the host can start once the guest has confirmed Ready.'}
          </p>
        </div>
      </div>

      {saveOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-yellow-500/35 bg-emerald-950 p-6 shadow-2xl">
            <div className="mb-4 flex justify-between gap-4">
              <h4 className="text-sm font-black uppercase tracking-wide text-yellow-400">Save lobby preset</h4>
              <button type="button" onClick={() => setSaveOpen(false)} className="rounded-full p-1 text-emerald-400 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-emerald-500">Preset name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My quick table..."
                  className="w-full rounded-lg border border-emerald-800 bg-black/35 px-3 py-2 text-sm text-emerald-50 outline-none focus:border-yellow-400/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-emerald-500">Short description</label>
                <textarea
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="Friends night — power heavy"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-emerald-800 bg-black/35 px-3 py-2 text-sm text-emerald-50 outline-none focus:border-yellow-400/60"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="flex-1 rounded-xl border border-emerald-800 py-3 text-[10px] font-black uppercase text-emerald-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => savePreset()}
                className="flex-1 rounded-xl bg-yellow-400 py-3 text-[10px] font-black uppercase text-emerald-950 hover:bg-yellow-300"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/** Guest-facing configuration summary matching host toggle palette. */
export const GuestLobbyPanel: React.FC<{
  room: RoomData;
  preyLab: string;
  guestLobbyReady: boolean;
  onToggleReady: () => void;
}> = ({ room, preyLab, guestLobbyReady, onToggleReady }) => {
  const desperationDisplayRows = desperationTierRowsForDisplay(room.settings);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="border-l-4 border-yellow-400 pl-3 text-xs font-black uppercase tracking-widest text-yellow-400">
          Host confirmed setup
        </h3>

        <div className="space-y-2 rounded-xl border border-emerald-800/70 bg-emerald-950/40 p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">Preset</span>
          <p className="text-[12px] font-black uppercase text-yellow-400/95">
            {room.settings.lobbyPresetId === CUSTOM_LOBBY_PRESET_ID
              ? 'Custom game settings'
              : listStaticBuiltinPresets().find((b) => b.id === room.settings.lobbyPresetId)?.name ??
                loadCustomPresets().find((c) => c.id === room.settings.lobbyPresetId)?.name ??
                room.settings.lobbyPresetId}
          </p>
          <p className="text-[11px] font-bold uppercase leading-snug text-emerald-300/95">
            {deckBlurb(room.settings)}
          </p>
          <p className="text-[11px] font-bold leading-snug text-yellow-100/90">
            Predator draws {room.settings.predatorStartingCards} · Prey ({preyLab}) draws{' '}
            {room.settings.preyStartingCards}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg border px-3 py-2 ${toggleTileClass(!room.settings.disableJokers)}`}>
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
              <Skull className="h-3.5 w-3.5" /> Jokers
            </p>
            <p className="mt-1 text-[8px] font-bold">{room.settings.disableJokers ? 'Off' : 'In deck'}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${toggleTileClass(!room.settings.disablePowerCards)}`}>
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
              <Zap className="h-3.5 w-3.5" /> Powers
            </p>
            <p className="mt-1 text-[8px] font-bold">{room.settings.disablePowerCards ? 'Off' : 'Draft'}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${toggleTileClass(room.settings.enablePokerChips)}`}>
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
              <Layers className="h-3.5 w-3.5" /> Poker chips
            </p>
            <p className="mt-1 text-[8px] font-bold">{room.settings.enablePokerChips ? 'On' : 'Off'}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${toggleTileClass(room.settings.enablePanicDice)}`}>
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
              <Dice3 className="h-3.5 w-3.5" /> Panic dice
            </p>
            <p className="mt-1 text-[8px] font-bold">{room.settings.enablePanicDice ? 'On' : 'Off'}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${toggleTileClass(room.settings.enableCurseCards)}`}>
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
              <Heart className="h-3.5 w-3.5" /> Curses
            </p>
            <p className="mt-1 text-[8px] font-bold">{room.settings.enableCurseCards ? 'On' : 'Off'}</p>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 ${toggleTileClass(
              room.settings.curseCardsInPowerDeck,
              room.settings.disablePowerCards || !room.settings.enableCurseCards,
            )}`}
          >
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest">
              <Flame className="h-3.5 w-3.5" /> Curses in powers
            </p>
            <p className="mt-1 text-[8px] font-bold uppercase leading-tight">
              {room.settings.disablePowerCards || !room.settings.enableCurseCards
                ? 'N/A'
                : room.settings.curseCardsInPowerDeck
                  ? 'Yes'
                  : 'Separate'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-purple-900/50 bg-purple-950/25 p-4 space-y-2">
        <span className="text-[10px] font-black uppercase text-purple-300">Desperation wheel</span>
        <span className={`block text-[10px] font-black uppercase ${room.settings.enableDesperation ? 'text-purple-200' : 'text-slate-500'}`}>
          {room.settings.enableDesperation ? 'Enabled' : 'Disabled'}
        </span>
        {room.settings.enableDesperation && desperationDisplayRows.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] text-purple-50/95">
            {desperationDisplayRows.map((row) => (
              <li key={row.ladderIdx}>
                <span className="font-mono text-[9px] text-purple-500">Tier {row.ladderIdx}</span> {row.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleReady}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 py-4 text-sm font-black uppercase tracking-widest transition-all ${
          guestLobbyReady
            ? 'border-emerald-500 bg-emerald-800/70 text-emerald-50 hover:bg-emerald-800'
            : 'border-yellow-300 bg-yellow-400 text-emerald-950 hover:scale-[1.01]'
        }`}
      >
        {guestLobbyReady ? <>EDIT READY STATUS</> : <>READY UP</>}
      </button>
    </div>
  );
};
