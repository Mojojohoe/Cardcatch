import React, { useEffect, useMemo, useState } from 'react';
import { parseCard } from '../services/gameService';
import { SuitGlyph } from '../components/SuitGlyphs';
import { SUIT_COLORS } from '../suitPresentation';
import {
  cardArtAssetUrl,
  cardBackgroundUrlCandidates,
  pictureCardUrlCandidates,
  suitRasterUrlCandidates,
} from './paths';
import type { CardArtOverride } from './types';
import type { PipGridCell } from './types';
import { defaultPipCellsForRank, pipGridCellToFraction } from './pipLayouts';

export const CARD_ART_WIDTH = 256;
export const CARD_ART_HEIGHT = 374;

const CORNER_TOP = '7%';
const CORNER_SIDE = '6%';
const PIP_FRAC = 0.072;

type Props = {
  card: string;
  override?: CardArtOverride;
};

function PipImage({
  suit,
  x,
  y,
  maxSideFrac,
}: {
  suit: string;
  x: number;
  y: number;
  maxSideFrac: number;
}) {
  const candidates = useMemo(() => suitRasterUrlCandidates(suit), [suit]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [suit]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${maxSideFrac * 100}%`,
    height: `${maxSideFrac * 100}%`,
    transform: 'translate(-50%, -50%)',
  };

  const color = SUIT_COLORS[suit] ?? 'text-red-600';
  if (attempt >= candidates.length) {
    return (
      <div className={`pointer-events-none flex items-center justify-center ${color}`} style={style}>
        <SuitGlyph suit={suit as any} className="h-full w-full" />
      </div>
    );
  }

  return (
    <img
      src={candidates[attempt]}
      alt=""
      draggable={false}
      onError={() => setAttempt((a) => a + 1)}
      className="pointer-events-none object-contain"
      style={style}
    />
  );
}

function CornerSuitRaster({ suit, sizePx }: { suit: string; sizePx: number }) {
  const candidates = useMemo(() => suitRasterUrlCandidates(suit), [suit]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [suit]);

  if (attempt >= candidates.length) {
    return (
      <SuitGlyph
        suit={suit as any}
        className="opacity-95"
        style={{ width: sizePx, height: sizePx }}
      />
    );
  }

  return (
    <img
      src={candidates[attempt]}
      alt=""
      draggable={false}
      onError={() => setAttempt((a) => a + 1)}
      className="pointer-events-none object-contain opacity-95"
      style={{ width: sizePx, height: sizePx }}
    />
  );
}

export const AssembledPlayingCardFace: React.FC<Props> = ({ card, override }) => {
  const p = useMemo(() => parseCard(card), [card]);
  const { suit, value } = p;

  const bgCandidates = useMemo(() => cardBackgroundUrlCandidates(), []);
  const [bgAttempt, setBgAttempt] = useState(0);

  useEffect(() => {
    setBgAttempt(0);
  }, [card]);

  const bgKnownMissing = bgAttempt >= bgCandidates.length;

  const customFullBleed =
    override?.customDataUrl ||
    (override?.customImageFile ? cardArtAssetUrl(override.customImageFile) : null);

  const [customBroken, setCustomBroken] = useState(!customFullBleed);

  useEffect(() => {
    setCustomBroken(!customFullBleed);
  }, [customFullBleed]);

  if (customFullBleed && !customBroken) {
    return (
      <div
        className="relative overflow-hidden rounded-[inherit] bg-zinc-100"
        style={{ width: CARD_ART_WIDTH, height: CARD_ART_HEIGHT }}
      >
        <img
          src={customFullBleed}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setCustomBroken(true)}
        />
      </div>
    );
  }

  const pictureRank = value === 'J' || value === 'Q' || value === 'K' || value === 'A';

  const cornerGlyphPx = CARD_ART_WIDTH * 0.12;

  return (
    <div
      className="relative overflow-hidden rounded-[inherit]"
      style={{
        width: CARD_ART_WIDTH,
        height: CARD_ART_HEIGHT,
        background: bgKnownMissing ? 'linear-gradient(145deg,#fafafa,#e4e4e7)' : undefined,
      }}
    >
      {!bgKnownMissing && (
        <img
          src={bgCandidates[bgAttempt]}
          alt=""
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          draggable={false}
          onError={() => setBgAttempt((a) => a + 1)}
        />
      )}

      <div
        className={`pointer-events-none absolute z-[2] flex flex-col items-start leading-[0.85] ${SUIT_COLORS[suit] ?? 'text-red-600'}`}
        style={{ left: CORNER_SIDE, top: CORNER_TOP }}
      >
        <span
          className="font-card-rank font-black text-zinc-900"
          style={{ fontSize: Math.round(CARD_ART_WIDTH * 0.085) }}
        >
          {value}
        </span>
        <CornerSuitRaster suit={suit} sizePx={cornerGlyphPx} />
      </div>
      <div
        className={`pointer-events-none absolute z-[2] flex flex-col items-start leading-[0.85] rotate-180 ${SUIT_COLORS[suit] ?? 'text-red-600'}`}
        style={{ right: CORNER_SIDE, bottom: CORNER_TOP }}
      >
        <span
          className="font-card-rank font-black text-zinc-900"
          style={{ fontSize: Math.round(CARD_ART_WIDTH * 0.085) }}
        >
          {value}
        </span>
        <CornerSuitRaster suit={suit} sizePx={cornerGlyphPx} />
      </div>

      {pictureRank ? (
        <PictureInterior suit={suit} value={value} cardId={card} />
      ) : (
        <PipInterior suit={suit} value={value} override={override} />
      )}
    </div>
  );
};

function PictureInterior({ suit, value, cardId }: { suit: string; value: string; cardId: string }) {
  const candidates = useMemo(() => pictureCardUrlCandidates(cardId), [cardId]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [cardId]);

  if (attempt < candidates.length) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-[14%] pb-[12%] pt-[16%]">
        <img
          src={candidates[attempt]}
          alt=""
          className="max-h-[72%] max-w-full object-contain drop-shadow"
          draggable={false}
          onError={() => setAttempt((a) => a + 1)}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-1 px-[10%]">
      <SuitGlyph
        suit={suit as any}
        className={`max-h-[42%] max-w-[55%] opacity-90 ${SUIT_COLORS[suit] ?? ''}`}
      />
      <span
        className="font-card-rank font-black text-zinc-800"
        style={{ fontSize: Math.round(CARD_ART_WIDTH * 0.14) }}
      >
        {value}
      </span>
    </div>
  );
}

function PipInterior({ suit, value, override }: { suit: string; value: string; override?: CardArtOverride }) {
  let cells: PipGridCell[] | null = null;
  if (value === 'A') {
    cells = [{ col: 6, row: 8 }];
  } else if (override?.pipGrid && override.pipGrid.length > 0) {
    cells = override.pipGrid;
  } else {
    cells = defaultPipCellsForRank(value);
  }

  if (!cells || cells.length === 0) return null;

  const count = cells.length;
  const maxSide =
    value === 'A' ? 0.28 : count >= 9 ? PIP_FRAC * 0.92 : count >= 6 ? PIP_FRAC * 1.05 : PIP_FRAC * 1.2;

  return (
    <>
      {cells.map((cell, i) => {
        const { x, y } = pipGridCellToFraction(cell);
        return (
          <React.Fragment key={`${i}-${cell.col}-${cell.row}`}>
            <PipImage suit={suit} x={x} y={y} maxSideFrac={maxSide} />
          </React.Fragment>
        );
      })}
    </>
  );
}
