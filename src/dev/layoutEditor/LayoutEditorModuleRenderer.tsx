/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { BookType, Copy, Monitor, Sparkles } from 'lucide-react';
import { CardVisual, PowerCardVisual } from '../../components/GameVisuals';
import { TargetSuitWheel } from '../../components/GameWheels';
import { SacrificialBowl } from '../../components/SacrificialBowl';
import { CurseZonePanel } from '../../components/CurseZonePanel';
import { TokenTowerStack } from '../../components/TokenTowerStack';
import type { ChipPileHandle } from '../../hooks/useChipPileSync';
import { PlayerSettingsMenu } from '../../components/PlayerSettingsMenu';
import { TyrantCrownTablePiece, OpponentDesperationTopStrip } from '../../gameInstance/TableOverlayPieces';
import { cardArtAssetUrl } from '../../cardArt/paths';
import { shippedPlayingCardBackRasterUrl } from '../../cardArt/shippedRasterFallbacks';
import { jointTableTrumpPair } from '../../suitPresentation';
import { greedCurseActive } from '../../curses';
import type { RoomData } from '../../types';
import type { GameElementKey, GameUiElementKey } from './types';

const chipColor = 0xef4444;
const chipEmissive = 0x3b0000;

function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col items-center justify-center overflow-auto p-1 text-slate-100">
      {children}
    </div>
  );
}

function OpponentTokenPreview({ balance }: { balance: number }) {
  const ref = useRef<ChipPileHandle | null>(null);
  useEffect(() => {
    ref.current?.resetToCount(balance);
  }, [balance]);
  return (
    <PreviewShell>
      <div className="h-28 w-full max-w-[8rem] min-h-0">
        <TokenTowerStack ref={ref} chipColor={chipColor} chipEmissive={chipEmissive} className="h-full" />
      </div>
      <span className="mt-1 text-[8px] font-bold text-slate-400">Balance {balance}</span>
    </PreviewShell>
  );
}

function PlayerTokenPreview({ balance }: { balance: number }) {
  const ref = useRef<ChipPileHandle | null>(null);
  useEffect(() => {
    ref.current?.resetToCount(balance);
  }, [balance]);
  return (
    <PreviewShell>
      <div className="h-28 w-full max-w-[8rem] min-h-0">
        <TokenTowerStack ref={ref} chipColor={chipColor} chipEmissive={chipEmissive} pileAccent className="h-full" />
      </div>
      <span className="mt-1 text-[8px] font-bold text-slate-400">Balance {balance}</span>
    </PreviewShell>
  );
}

function LayoutPreviewChatStub() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-lg border border-emerald-800/50 bg-emerald-950/80 p-2 text-[9px]">
      <div className="font-black uppercase tracking-wider text-emerald-400/90">Room chat (live wiring only in match)</div>
      <div className="mt-2 flex-1 space-y-1 overflow-auto text-slate-300">
        <div>Guest: Example…</div>
        <div>Host: Second line…</div>
      </div>
    </div>
  );
}

export function LayoutEditorModuleRenderer(props: {
  room: RoomData;
  myUid: string;
  gameKey: GameElementKey;
}): React.ReactNode {
  const { room, myUid: _myUid, gameKey } = props;
  const guestUid = Object.keys(room.players).find((u) => u !== room.hostUid) ?? 'guest';
  const host = room.players[room.hostUid];
  const guest = room.players[guestUid];

  switch (gameKey) {
    case 'opponent_cards':
      return (
        <PreviewShell>
          <div className="flex max-w-full items-end justify-center gap-0.5 overflow-x-auto -space-x-6 px-1">
            {Array.from({ length: guest.hand.length }, (_, i) => (
              <CardVisual key={i} card="" revealed={false} disabled role={guest.role} delay={i * 0.04} small />
            ))}
          </div>
        </PreviewShell>
      );
    case 'opponent_tokens':
      return <OpponentTokenPreview balance={guest.tokenBalance ?? 0} />;
    case 'opponent_power_cards':
      return (
        <PreviewShell>
          <div className="flex flex-wrap justify-center gap-1">
            {guest.powerCards.map((pid, i) => (
              <PowerCardVisual key={`${pid}-${i}`} cardId={pid} revealed={false} small staticBackdrop />
            ))}
          </div>
        </PreviewShell>
      );
    case 'play_area': {
      const ts = room.targetSuit;
      const greedActive = greedCurseActive(room.activeCurses ?? []);
      const joint = jointTableTrumpPair(ts, { greedActive });
      return (
        <PreviewShell>
          <div className="flex min-h-0 w-full flex-col items-center gap-2 overflow-auto">
            <TargetSuitWheel
              suit={ts}
              isSpinning={false}
              offset={room.wheelOffset}
              availableSuits={room.availableSuits}
              lustTripleHearts={false}
              greedHalveBasicSuits={false}
              greedJointDiamondCoinGlyphs={Boolean(joint)}
              artworkTable={false}
            />
            {joint ? (
              <span className="text-[8px] font-black uppercase text-amber-200/90">Greed joint trump dial</span>
            ) : null}
          </div>
        </PreviewShell>
      );
    }
    case 'fire_bowl':
      return (
        <PreviewShell>
          <SacrificialBowl rasterMode={false} expanded={false} catchGlow={false} burnsRemaining={2} lustFire={false} />
        </PreviewShell>
      );
    case 'deck':
      return (
        <PreviewShell>
          <div className="relative h-24 w-16 shrink-0">
            {shippedPlayingCardBackRasterUrl ? (
              <img src={shippedPlayingCardBackRasterUrl} alt="" className="h-full w-full rounded-md object-cover shadow-lg" />
            ) : (
              <div className="h-full w-full rounded-md border-2 border-slate-600 bg-slate-900" />
            )}
          </div>
        </PreviewShell>
      );
    case 'player_power_cards':
      return (
        <PreviewShell>
          <div className="flex flex-wrap justify-center gap-1">
            {host.powerCards.map((pid, i) => (
              <PowerCardVisual key={`${pid}-${i}`} cardId={pid} matchHandCard selected={i === 0} onClick={() => {}} />
            ))}
          </div>
        </PreviewShell>
      );
    case 'player_cards':
      return (
        <PreviewShell>
          <div className="flex max-w-full items-end justify-center gap-0.5 overflow-x-auto -space-x-5 px-1">
            {host.hand.map((card, i) => (
              <CardVisual key={`${card}-${i}`} card={card} revealed role={host.role} delay={i * 0.03} small />
            ))}
          </div>
        </PreviewShell>
      );
    case 'panic_dice_image':
      return (
        <PreviewShell>
          <img
            src={cardArtAssetUrl('PanicDice.png')}
            alt=""
            draggable={false}
            className="h-14 w-auto max-w-full object-contain drop-shadow-lg sm:h-16"
          />
        </PreviewShell>
      );
    case 'player_tokens':
      return <PlayerTokenPreview balance={host.tokenBalance ?? 0} />;
    case 'curse_zone':
      return (
        <PreviewShell>
          <CurseZonePanel
            settings={room.settings}
            activeCurses={room.activeCurses}
            prideCeilingCard={room.prideCeilingCard}
            wrathMinionCard={room.wrathMinionCard}
          />
        </PreviewShell>
      );
    case 'room_chat':
      return <LayoutPreviewChatStub />;
    case 'tyrant_crown':
      return room.tyrantCrownPending ? (
        <PreviewShell>
          <TyrantCrownTablePiece crownTotal={room.tyrantCrownPending.crownTotal} />
        </PreviewShell>
      ) : (
        <PreviewShell>
          <span className="text-[9px] text-slate-500">No tyrant crown this round</span>
        </PreviewShell>
      );
    case 'other_game':
      return (
        <PreviewShell>
          <span className="text-[9px] text-slate-500">Other (game)</span>
        </PreviewShell>
      );
    default:
      return null;
  }
}

export function LayoutEditorUiModuleRenderer(props: { room: RoomData; myUid: string; uiKey: GameUiElementKey }): React.ReactNode {
  const { room, myUid: _myUid, uiKey } = props;
  const guestUid = Object.keys(room.players).find((u) => u !== room.hostUid) ?? 'guest';
  const host = room.players[room.hostUid];
  const guest = room.players[guestUid];

  switch (uiKey) {
    case 'opponent_desperation':
      return (
        <PreviewShell>
          <OpponentDesperationTopStrip opponent={guest} room={room} className="max-w-full" />
        </PreviewShell>
      );
    case 'player_desperation':
      return (
        <PreviewShell>
          <div className="rounded-lg border border-purple-800/60 bg-purple-950/90 px-3 py-2 text-center text-[9px] font-black uppercase tracking-wide text-purple-100">
            Player desperation (Predator seat usually off-ladder — tune in real match)
          </div>
        </PreviewShell>
      );
    case 'play_card_button':
      return (
        <PreviewShell>
          <button type="button" className="rounded-xl border-2 border-amber-500/90 bg-amber-400/95 px-4 py-2 text-[9px] font-black uppercase text-emerald-950">
            Play card
          </button>
        </PreviewShell>
      );
    case 'cash_chips_button':
      return (
        <PreviewShell>
          <button type="button" className="rounded-xl border-2 border-amber-600/80 bg-amber-500/90 px-4 py-2 text-[9px] font-black uppercase text-emerald-950">
            Cash Chips
          </button>
        </PreviewShell>
      );
    case 'panic_dice_button':
      return (
        <PreviewShell>
          <button type="button" className="rounded-lg border border-amber-700/70 bg-slate-900/90 px-3 py-2 text-[9px] font-black uppercase text-amber-100">
            Panic dice
          </button>
        </PreviewShell>
      );
    case 'room_code_copy':
      return (
        <PreviewShell>
          <div className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/90 px-2 py-1.5 font-mono text-xs text-amber-100">
            <span>{room.code}</span>
            <button type="button" className="rounded p-1 hover:bg-slate-800" aria-label="Copy">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </PreviewShell>
      );
    case 'role_title':
      return (
        <PreviewShell>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/90">{host.role}</span>
        </PreviewShell>
      );
    case 'name_ready':
      return (
        <PreviewShell>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs font-bold text-white">{host.name}</span>
            <span className="text-[9px] font-black uppercase text-emerald-400">Ready ✓</span>
          </div>
        </PreviewShell>
      );
    case 'settings_button':
      return (
        <PreviewShell>
          <PlayerSettingsMenu className="inline-flex" />
        </PreviewShell>
      );
    case 'rules_button':
      return (
        <PreviewShell>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border-2 border-slate-500 bg-slate-900 px-2 py-1.5 text-[9px] font-black uppercase text-slate-200"
          >
            <BookType className="h-3.5 w-3.5" />
            Rules
          </button>
        </PreviewShell>
      );
    case 'local_multiplayer_toggle':
      return (
        <PreviewShell>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-900/80 px-2 py-1.5 text-[8px] font-black uppercase text-emerald-200"
          >
            <Monitor className="h-3 w-3" />
            Local MP test
          </button>
        </PreviewShell>
      );
    case 'dev_menu_button':
      return (
        <PreviewShell>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border-2 border-yellow-500/60 bg-black/80 px-3 py-2 text-[9px] font-black uppercase text-yellow-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Dev
          </button>
        </PreviewShell>
      );
    case 'other_ui':
      return (
        <PreviewShell>
          <span className="text-[9px] text-slate-500">Other (UI)</span>
        </PreviewShell>
      );
    default:
      return null;
  }
}
