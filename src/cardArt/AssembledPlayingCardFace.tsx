import React, { useEffect, useMemo, useState } from 'react';
import { parseCard } from '../services/gameService';
import { SuitGlyph } from '../components/SuitGlyphs';
import { SUIT_COLORS } from '../suitPresentation';
import {
  cardArtAssetUrl,
  pictureCardUrlCandidates,
  suitRasterUrlCandidates,
} from './paths';
import type { CardArtGlobalDefaults, CardArtOverride, PipOrient, PipSlot } from './types';
import { pipGridCellToFraction } from './pipLayouts';
import {
  resolveFaceBackgroundCandidates,
  resolveNotifierScale,
  resolvePipScale,
  resolvePipSlots,
} from './resolveCardArt';

export const CARD_ART_WIDTH = 256;
export const CARD_ART_HEIGHT = 374;

const CORNER_TOP = '7%';
const CORNER_SIDE = '6%';
const PIP_FRAC = 0.072;

function pipTransform(o: PipOrient): string {
  const t = 'translate(-50%, -50%)';
  if (o === 1) return `${t} scaleX(-1)`;
  if (o === 2) return `${t} scaleY(-1)`;
  if (o === 3) return `${t} scale(-1, -1)`;
  return t;
}

type Props = {
  card: string;
  override?: CardArtOverride;
  defaults?: CardArtGlobalDefaults;
};

function PipImage({
  suit,
  x,
  y,
  maxSideFrac,
  orient,
}: {
  suit: string;
  x: number;
  y: number;
  maxSideFrac: number;
  orient: PipOrient;
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
    transform: pipTransform(orient),
    zIndex: 2,
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

  const wrap = 'flex shrink-0 items-center justify-center opacity-95';

  if (attempt >= candidates.length) {
    return (
      <div className={wrap} style={{ width: sizePx, height: sizePx }}>
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
      className={`pointer-events-none object-contain opacity-95 ${wrap}`}
      style={{ width: sizePx, height: sizePx }}
    />
  );
}

/** Try `{cardId}.png` etc.; then render fallback (pip court or glyph). */
function RasterPictureOr({
  cardId,
  fallback,
}: {
  cardId: string;
  fallback: React.ReactNode;
}) {
  const candidates = useMemo(() => pictureCardUrlCandidates(cardId), [cardId]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [cardId]);

  if (attempt >= candidates.length) {
    return <>{fallback}</>;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-[14%] pb-[12%] pt-[16%]">
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

export const AssembledPlayingCardFace: React.FC<Props> = ({ card, override, defaults }) => {
  const p = useMemo(() => parseCard(card), [card]);
  const isJoker = p.isJoker;
  const suit = isJoker ? 'Joker' : p.suit;
  const value = p.value;

  const cornerRankText = useMemo(() => {
    if (isJoker) return card.replace(/^Joker-/, '') || '?';
    if (p.suit === 'Grovels') return 'Grovel';
    return value;
  }, [card, isJoker, p.suit, value]);

  const bgSuitKey = isJoker ? 'Joker' : p.suit;
  const bgCandidates = useMemo(() => resolveFaceBackgroundCandidates(bgSuitKey, defaults), [bgSuitKey, defaults]);
  const [bgAttempt, setBgAttempt] = useState(0);

  useEffect(() => {
    setBgAttempt(0);
  }, [card, defaults]);

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

  const rankForScale = isJoker ? '10' : value;
  const pipScale = resolvePipScale(rankForScale, defaults);
  const notifierScale = resolveNotifierScale(rankForScale, defaults);
  const ct = defaults?.cornerText ?? {};
  const textScaleMul = (ct.scale ?? 1) * notifierScale;
  const offLX = ct.offsetLeftXPct ?? 0;
  const offTY = ct.offsetTopYPct ?? 0;

  const cornerFontPx = Math.round(CARD_ART_WIDTH * 0.085 * textScaleMul);
  const cornerGlyphPx = CARD_ART_WIDTH * 0.12 * notifierScale;

  const bgOnly = override?.backgroundOnly ?? defaults?.backgroundOnly ?? false;
  const underlay = defaults?.faceUnderlayColor ?? '#000000';

  const royalPicture = value === 'J' || value === 'Q' || value === 'K';

  return (
    <div
      className="relative overflow-hidden rounded-[inherit]"
      style={{
        width: CARD_ART_WIDTH,
        height: CARD_ART_HEIGHT,
        background: bgKnownMissing ? 'linear-gradient(145deg,#fafafa,#e4e4e7)' : undefined,
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-0" style={{ backgroundColor: underlay }} />

      {!bgKnownMissing && (
        <img
          src={bgCandidates[bgAttempt]}
          alt=""
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
          draggable={false}
          onError={() => setBgAttempt((a) => a + 1)}
        />
      )}

      {!bgOnly && (
        <>
          <div
            className={`pointer-events-none absolute z-[3] flex flex-col items-start leading-[0.85] ${SUIT_COLORS[suit] ?? 'text-red-600'}`}
            style={{ left: `calc(${CORNER_SIDE} + ${offLX}%)`, top: `calc(${CORNER_TOP} + ${offTY}%)` }}
          >
            <span className="font-card-rank font-black text-zinc-900" style={{ fontSize: cornerFontPx }}>
              {cornerRankText}
            </span>
            <CornerSuitRaster suit={suit} sizePx={cornerGlyphPx} />
          </div>
          <div
            className={`pointer-events-none absolute z-[3] flex flex-col items-start leading-[0.85] rotate-180 ${SUIT_COLORS[suit] ?? 'text-red-600'}`}
            style={{
              right: `calc(${CORNER_SIDE} - ${offLX}%)`,
              bottom: `calc(${CORNER_TOP} - ${offTY}%)`,
            }}
          >
            <span className="font-card-rank font-black text-zinc-900" style={{ fontSize: cornerFontPx }}>
              {cornerRankText}
            </span>
            <CornerSuitRaster suit={suit} sizePx={cornerGlyphPx} />
          </div>
        </>
      )}

      {!bgOnly && isJoker && (
        <RasterPictureOr
          cardId={card}
          fallback={
            <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
              <div className={`opacity-90 ${SUIT_COLORS['Joker'] ?? 'text-purple-500'}`}>
                <SuitGlyph suit="Joker" className="h-[min(42vw,7rem)] w-[min(42vw,7rem)] max-h-[55%] max-w-[55%]" />
              </div>
            </div>
          }
        />
      )}

      {!bgOnly && !isJoker && royalPicture && (
        <PictureInterior suit={suit} value={value} cardId={card} pipScale={pipScale} />
      )}

      {!bgOnly && !isJoker && !royalPicture && (
        <CenterFill
          card={card}
          suit={suit}
          value={value}
          override={override}
          defaults={defaults}
          pipScale={pipScale}
        />
      )}
    </div>
  );
};

function PictureInterior({
  suit,
  value,
  cardId,
  pipScale,
}: {
  suit: string;
  value: string;
  cardId: string;
  pipScale: number;
}) {
  const candidates = useMemo(() => pictureCardUrlCandidates(cardId), [cardId]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [cardId]);

  if (attempt < candidates.length) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-[14%] pb-[12%] pt-[16%]">
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
    <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1 px-[10%]">
      <div
        className="flex max-h-[42%] max-w-[55%] items-center justify-center"
        style={{ transform: `scale(${pipScale})` }}
      >
        <SuitGlyph suit={suit as any} className={`h-full w-full max-h-full max-w-full opacity-90 ${SUIT_COLORS[suit] ?? ''}`} />
      </div>
      <span
        className="font-card-rank font-black text-zinc-800"
        style={{ fontSize: Math.round(CARD_ART_WIDTH * 0.14 * pipScale) }}
      >
        {value}
      </span>
    </div>
  );
}

function CenterFill({
  card,
  suit,
  value,
  override,
  defaults,
  pipScale,
}: {
  card: string;
  suit: string;
  value: string;
  override?: CardArtOverride;
  defaults?: CardArtGlobalDefaults;
  pipScale: number;
}) {
  const slots = resolvePipSlots(value, override, defaults);
  const aceOrGod = value === 'A' || value === 'G';

  if (slots.length > 0 && !aceOrGod) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[2]">
        <PipInterior suit={suit} value={value} override={override} defaults={defaults} pipScale={pipScale} />
      </div>
    );
  }

  if (aceOrGod) {
    return (
      <RasterPictureOr
        cardId={card}
        fallback={
          <div className="pointer-events-none absolute inset-0 z-[2]">
            <PipInterior suit={suit} value={value} override={override} defaults={defaults} pipScale={pipScale} />
          </div>
        }
      />
    );
  }

  return (
    <RasterPictureOr
      cardId={card}
      fallback={
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center opacity-[0.22]">
          <div className={`${SUIT_COLORS[suit] ?? 'text-red-500'}`}>
            <SuitGlyph suit={suit as any} className="h-28 w-28 sm:h-32 sm:w-32" />
          </div>
        </div>
      }
    />
  );
}

function PipInterior({
  suit,
  value,
  override,
  defaults,
  pipScale,
}: {
  suit: string;
  value: string;
  override?: CardArtOverride;
  defaults?: CardArtGlobalDefaults;
  pipScale: number;
}) {
  const cells: PipSlot[] = resolvePipSlots(value, override, defaults);

  if (!cells.length) return null;

  const count = cells.length;
  const baseMax =
    value === 'A' || value === 'G'
      ? 0.28
      : count >= 9
        ? PIP_FRAC * 0.92
        : count >= 6
          ? PIP_FRAC * 1.05
          : PIP_FRAC * 1.2;
  const maxSide = baseMax * pipScale;

  return (
    <>
      {cells.map((cell, i) => {
        const { x, y } = pipGridCellToFraction(cell);
        const o = (cell.o ?? 0) as PipOrient;
        return (
          <React.Fragment key={`${i}-${cell.col}-${cell.row}-${o}`}>
            <PipImage suit={suit} x={x} y={y} maxSideFrac={maxSide} orient={o} />
          </React.Fragment>
        );
      })}
    </>
  );
}
