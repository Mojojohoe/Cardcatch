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

const CHIP_PANEL_BOX = 'h-[min(42vh,24rem)] w-[min(13.5rem,31vw)] sm:h-[min(46vh,26rem)] sm:w-[min(14.5rem,28vw)]';

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
        {/** Opponent pile — left of centre table / opponent hand rail */}
        <HoldDelayTooltip
          caption={opponentTokensHoldCaption}
          className={`pointer-events-auto absolute left-[max(0.5rem,calc(50%-min(44rem,94vw)/2-8.75rem))] top-[max(5.5rem,11vh)] ${CHIP_PANEL_FRAME} ${CHIP_PANEL_BOX}`}
          style={{ filter: tokenHueFilter(opponent?.role) }}
        >
          <div className="pointer-events-none absolute left-2 top-1 z-10 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-100">
            Their tokens: {opponentBalance}
          </div>
          <TokenTowerStack ref={leftRef} chipColor={oppPalette.chipColor} chipEmissive={oppPalette.chipEmissive} className="min-h-0 flex-1" />
        </HoldDelayTooltip>

        {/** Player pile — between centred hand and right panic-dice column */}
        <HoldDelayTooltip
          caption={selfTokensHoldCaption}
          className={`pointer-events-auto absolute bottom-[max(7.25rem,15vh)] left-[calc(50%+min(10rem,23vw))] ${CHIP_PANEL_FRAME} ${CHIP_PANEL_BOX}`}
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
