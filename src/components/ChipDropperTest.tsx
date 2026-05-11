import React, { useRef } from 'react';
import type { PlayerRole, RoomData } from '../types';
import { useChipPileSync, type ChipPileHandle } from '../hooks/useChipPileSync';
import { HoldDelayTooltip } from './HoldDelayTooltip';
import { TokenTowerStack } from './TokenTowerStack';

function tokenPalette(role: PlayerRole | undefined): { chipColor: number; chipEmissive: number } {
  if (role === 'Prey') {
    return { chipColor: 0xef4444, chipEmissive: 0x3b0000 };
  }
  if (role === 'Preydator') {
    return { chipColor: 0xef4444, chipEmissive: 0x3b0000 };
  }
  return { chipColor: 0xef4444, chipEmissive: 0x3b0000 };
}

function tokenHueFilter(role: PlayerRole | undefined): string {
  if (role === 'Prey') return 'hue-rotate(200deg)';
  if (role === 'Preydator') return 'hue-rotate(300deg)';
  return 'none';
}

/** Fixed footprint so both piles read at the same scale (HUD positioning only). */
const CHIP_PANEL_FRAME =
  'flex flex-col overflow-hidden rounded-xl border border-emerald-800/45 bg-emerald-950/40 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)] backdrop-blur-[2px]';

/**
 * Width / height caps — keep `min(13.5rem,28vw)` in sync with the subtract term in opponent/player
 * `left` calcs below. Shorter default heights reduce vertical crowding of the sacrificial bowl until
 * a layout-tier system moves chips (`tableLayoutPolicy.ts`).
 */
const CHIP_PANEL_BOX =
  'h-[min(34vh,20rem)] w-[min(13.5rem,28vw)] sm:h-[min(38vh,22rem)] sm:w-[min(13.5rem,26vw)] lg:h-[min(42vh,24rem)] lg:w-[min(14.5rem,28vw)]';

export const ChipDropperTest: React.FC<{
  room: RoomData;
  myUid: string;
  selfBalance: number;
  opponentBalance: number;
  /** True while Cash Chips control is hovered/focused — newest token highlight on your pile. */
  highlightSelfTokens?: boolean;
  selfTokensHoldCaption: string;
  opponentTokensHoldCaption: string;
}> = ({
  room,
  myUid,
  selfBalance,
  opponentBalance,
  highlightSelfTokens = false,
  selfTokensHoldCaption,
  opponentTokensHoldCaption,
}) => {
  const leftRef = useRef<ChipPileHandle | null>(null);
  const rightRef = useRef<ChipPileHandle | null>(null);

  const opponentUid = Object.keys(room.players).find((uid) => uid !== myUid) ?? null;
  const me = room.players[myUid];
  const opponent = opponentUid ? room.players[opponentUid] : null;
  const myPalette = tokenPalette(me?.role);
  const oppPalette = tokenPalette(opponent?.role);

  useChipPileSync(rightRef, selfBalance);
  useChipPileSync(leftRef, opponentBalance);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[26]">
        {/** Opponent pile — fully **outside** the center stack’s horizontal band (matches xl 64rem cap). */}
        <HoldDelayTooltip
          caption={opponentTokensHoldCaption}
          className={`pointer-events-auto absolute left-[max(0.5rem,calc(50%-min(64rem,92vw)/2-0.875rem-min(13.5rem,28vw)))] top-[max(5.5rem,11vh)] max-[1220px]:!left-2 max-[1220px]:!top-[5.25rem] max-[1220px]:!h-[min(24vh,11rem)] max-[1220px]:!w-[min(10.5rem,26vw)] max-[1220px]:max-w-[calc(100vw-1rem)] ${CHIP_PANEL_FRAME} ${CHIP_PANEL_BOX}`}
          style={{ filter: tokenHueFilter(opponent?.role) }}
        >
          <div className="pointer-events-none absolute left-2 top-1 z-10 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-100">
            Their tokens: {opponentBalance}
          </div>
          <TokenTowerStack ref={leftRef} chipColor={oppPalette.chipColor} chipEmissive={oppPalette.chipEmissive} className="min-h-0 flex-1" />
        </HoldDelayTooltip>

        {/** Player pile — outside center stack’s right edge; narrow viewports pin to bottom-right. */}
        <HoldDelayTooltip
          caption={selfTokensHoldCaption}
          className={`pointer-events-auto absolute bottom-[max(8.75rem,17vh)] left-[min(calc(100vw-0.5rem-min(13.5rem,28vw)),calc(50%+min(64rem,92vw)/2+0.875rem))] max-[1220px]:!bottom-[max(9.5rem,19vh)] max-[1220px]:!left-auto max-[1220px]:!right-2 max-[1220px]:!h-[min(24vh,11rem)] max-[1220px]:!w-[min(10.5rem,26vw)] ${CHIP_PANEL_FRAME} ${CHIP_PANEL_BOX}`}
          style={{ filter: tokenHueFilter(me?.role) }}
        >
          <div className="pointer-events-none absolute left-2 top-1 z-10 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-100">
            Your tokens: {selfBalance}
          </div>
          <TokenTowerStack
            ref={rightRef}
            chipColor={myPalette.chipColor}
            chipEmissive={myPalette.chipEmissive}
            pileAccent={highlightSelfTokens}
            className="min-h-0 flex-1"
          />
        </HoldDelayTooltip>
      </div>
    </>
  );
};
