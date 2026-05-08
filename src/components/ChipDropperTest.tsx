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
      <div className="fixed inset-0 z-[26] pointer-events-none">
        <HoldDelayTooltip
          caption={opponentTokensHoldCaption}
          className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl
            bottom-[max(7rem,18vh)] left-[calc(50%-min(23rem,90vw))]
            h-[min(52vh,30rem)] w-[min(88vw,26rem)] scale-[0.25] origin-bottom-left
            lg:bottom-auto lg:top-1/2 lg:left-[calc(50%-28vw)] lg:h-[min(56vh,34rem)] lg:w-[min(32vw,28rem)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:scale-100 lg:origin-center"
          style={{ filter: tokenHueFilter(opponent?.role) }}
        >
          <div className="pointer-events-none absolute top-1 left-2 z-10 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-100">
            Their tokens: {opponentBalance}
          </div>
          <TokenTowerStack ref={leftRef} chipColor={oppPalette.chipColor} chipEmissive={oppPalette.chipEmissive} className="min-h-0 flex-1" />
        </HoldDelayTooltip>
        <HoldDelayTooltip
          caption={selfTokensHoldCaption}
          className="pointer-events-auto absolute top-1/2 left-[calc(50%+28vw)] flex h-[min(56vh,34rem)] w-[min(32vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl [@media(max-height:1100px)]:origin-center [@media(max-height:1100px)]:scale-[0.75]"
          style={{ filter: tokenHueFilter(me?.role) }}
        >
          <div className="pointer-events-none absolute top-1 left-2 z-10 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-100">
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
