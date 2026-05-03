import React, { useEffect, useMemo, useState } from 'react';
import { parseCard } from '../services/gameService';
import { SuitGlyph } from '../components/SuitGlyphs';
import { resolveSuitFaceTextColor, SUIT_COLORS } from '../suitPresentation';
import {
  cardArtAssetUrl,
  pictureCardUrlCandidates,
  suitRasterUrlCandidates,
} from './paths';
import type { BackgroundCaptionConfig, CardArtGlobalDefaults, CardArtOverride, PipOrient, PipSlot } from './types';
import { pipGridCellToFraction } from './pipLayouts';
import {
  mergedBackgroundCaption,
  resolvedFaceTextOpacity,
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

function captionTypographyStyle(scale: number, maxW: number, rotate180: boolean): React.CSSProperties {
  return {
    transform: rotate180 ? 'translate(-50%, -50%) rotate(180deg)' : 'translate(-50%, -50%)',
    fontSize: Math.max(8, Math.round(12 * scale * (CARD_ART_WIDTH / 256))),
    width: `${maxW}%`,
    maxWidth: `${maxW}%`,
  };
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Helps light numerals on bright faces and dark numerals on dark underlays without extra config. */
function contrastTextShadow(fill: string): React.CSSProperties {
  const rgb = /^#?[0-9a-f]{6}$/i.test(fill) ? hexRgb(fill.startsWith('#') ? fill : `#${fill}`) : null;
  if (!rgb) return {};
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.7) {
    return { textShadow: '0 0 5px rgba(0,0,0,.9), 0 1px 4px rgba(0,0,0,.82)' };
  }
  if (luminance < 0.26) {
    return { textShadow: '0 0 4px rgba(255,255,255,.42), 0 1px 2px rgba(0,0,0,.55)' };
  }
  return {};
}

/** One or two blocks (dual mirrors through card centre like corner indices). */
function BackgroundCaptionLayers({
  config,
  textColor,
  opacity,
}: {
  config: BackgroundCaptionConfig;
  textColor: string;
  opacity: number;
}) {
  const t = config.text?.trim();
  if (!t) return null;
  const sx = config.scale ?? 1;
  const ax = config.anchorXPct ?? 50;
  const ay = config.anchorYPct ?? 50;
  const maxW = config.maxWidthPct ?? 88;
  const mirror = Boolean(config.mirrorDual);
  const shadow = contrastTextShadow(textColor);
  const cls =
    'font-card-rank pointer-events-none absolute z-[4] whitespace-pre-wrap px-1 text-center font-black leading-tight tracking-tight';

  return (
    <>
      <div
        className={cls}
        style={{
          left: `${ax}%`,
          top: `${ay}%`,
          color: textColor,
          opacity,
          ...captionTypographyStyle(sx, maxW, false),
          ...shadow,
        }}
      >
        {t}
      </div>
      {mirror ? (
        <div
          className={cls}
          style={{
            left: `${100 - ax}%`,
            top: `${100 - ay}%`,
            color: textColor,
            opacity,
            ...captionTypographyStyle(sx, maxW, true),
            ...shadow,
          }}
        >
          {t}
        </div>
      ) : null}
    </>
  );
}

function clampCentrePictureScale(n: number | undefined | null): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(0.25, n));
}

/** Try `{cardId}.png` etc.; then render fallback (pip court or glyph). */
function RasterPictureOr({
  cardId,
  pictureStem,
  pictureScale = 1,
  fallback,
}: {
  cardId: string;
  /** Tried before `{cardId}` (see {@link CardArtOverride.centrePictureFile}). */
  pictureStem?: string | null;
  /** Uniform scale of the raster inside the court frame (see {@link CardArtOverride.centrePictureScale}). */
  pictureScale?: number;
  fallback: React.ReactNode;
}) {
  const candidates = useMemo(() => pictureCardUrlCandidates(cardId, pictureStem), [cardId, pictureStem]);
  const [attempt, setAttempt] = useState(0);
  const s = clampCentrePictureScale(pictureScale);

  useEffect(() => {
    setAttempt(0);
  }, [cardId, pictureStem]);

  if (attempt >= candidates.length) {
    return <>{fallback}</>;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-[14%] pb-[12%] pt-[16%]">
      <div
        className="flex max-h-[72%] max-w-full items-center justify-center"
        style={{ transform: s !== 1 ? `scale(${s})` : undefined }}
      >
        <img
          src={candidates[attempt]}
          alt=""
          className="max-h-full max-w-full object-contain drop-shadow"
          draggable={false}
          onError={() => setAttempt((a) => a + 1)}
        />
      </div>
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

  const bgOnlyEarly = override?.backgroundOnly ?? defaults?.backgroundOnly ?? false;
  const captionConfig = useMemo(
    () => mergedBackgroundCaption(defaults?.backgroundCaptionDefaults, override?.backgroundCaption),
    [defaults?.backgroundCaptionDefaults, override?.backgroundCaption],
  );
  const faceTextFill = resolveSuitFaceTextColor(bgSuitKey, defaults?.suitFaceTextColor);
  const faceTextOpacity = resolvedFaceTextOpacity(override, defaults);

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
        {bgOnlyEarly && captionConfig ? (
          <BackgroundCaptionLayers
            config={captionConfig}
            textColor={captionConfig.color?.trim() || faceTextFill}
            opacity={faceTextOpacity}
          />
        ) : null}
      </div>
    );
  }

  const rankForScale = isJoker ? '10' : value;
  const pipScale = resolvePipScale(rankForScale, defaults);
  const notifierScale = resolveNotifierScale(rankForScale, defaults);
  const ct = defaults?.cornerText ?? {};
  const textScaleMul = (ct.scale ?? 1) * notifierScale;
  const rLX = ct.offsetLeftXPct ?? 0;
  const rTY = ct.offsetTopYPct ?? 0;
  const nLX = ct.notifierOffsetLeftXPct !== undefined && ct.notifierOffsetLeftXPct !== null ? ct.notifierOffsetLeftXPct : rLX;
  const nTYExplicit = ct.notifierOffsetTopYPct !== undefined && ct.notifierOffsetTopYPct !== null;
  const nTY = nTYExplicit ? (ct.notifierOffsetTopYPct ?? 0) : 0;
  const symmetricCorners = ct.symmetricCorners !== false;

  const cornerFontPx = Math.round(CARD_ART_WIDTH * 0.085 * textScaleMul);
  const cornerGlyphPx = CARD_ART_WIDTH * 0.12 * notifierScale;
  const notifierStackPx = Math.round(cornerFontPx * 0.92);

  const bgOnly = bgOnlyEarly;
  const underlay = defaults?.faceUnderlayColor ?? '#000000';

  const royalPicture = value === 'J' || value === 'Q' || value === 'K';

  const courtOX = defaults?.courtCentreOffsetPct?.x ?? 0;
  const courtOY = defaults?.courtCentreOffsetPct?.y ?? 0;
  const centrePictureScale = clampCentrePictureScale(
    override?.centrePictureScale ?? defaults?.centrePictureScale ?? 1,
  );

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
            className="pointer-events-none absolute z-[3] leading-[0.85]"
            style={{
              left: `calc(${CORNER_SIDE} + ${rLX}%)`,
              top: `calc(${CORNER_TOP} + ${rTY}%)`,
              color: faceTextFill,
              opacity: faceTextOpacity,
              ...contrastTextShadow(faceTextFill),
            }}
          >
            <span className="font-card-rank font-black" style={{ fontSize: cornerFontPx }}>
              {cornerRankText}
            </span>
          </div>
          <div
            className={`pointer-events-none absolute z-[3] ${SUIT_COLORS[suit] ?? 'text-red-600'}`}
            style={{
              left: `calc(${CORNER_SIDE} + ${nLX}%)`,
              top: nTYExplicit
                ? `calc(${CORNER_TOP} + ${nTY}%)`
                : `calc(${CORNER_TOP} + ${rTY}% + ${notifierStackPx}px)`,
            }}
          >
            <CornerSuitRaster suit={suit} sizePx={cornerGlyphPx} />
          </div>
          <div
            className="pointer-events-none absolute z-[3] leading-[0.85] rotate-180"
            style={{
              right: symmetricCorners
                ? `calc(${CORNER_SIDE} + ${rLX}%)`
                : `calc(${CORNER_SIDE} - ${rLX}%)`,
              bottom: symmetricCorners
                ? `calc(${CORNER_TOP} + ${rTY}%)`
                : `calc(${CORNER_TOP} - ${rTY}%)`,
              color: faceTextFill,
              opacity: faceTextOpacity,
              ...contrastTextShadow(faceTextFill),
            }}
          >
            <span className="font-card-rank font-black" style={{ fontSize: cornerFontPx }}>
              {cornerRankText}
            </span>
          </div>
          <div
            className={`pointer-events-none absolute z-[3] rotate-180 ${SUIT_COLORS[suit] ?? 'text-red-600'}`}
            style={{
              right: symmetricCorners
                ? `calc(${CORNER_SIDE} + ${nLX}%)`
                : `calc(${CORNER_SIDE} - ${nLX}%)`,
              bottom: nTYExplicit
                ? symmetricCorners
                  ? `calc(${CORNER_TOP} + ${nTY}%)`
                  : `calc(${CORNER_TOP} - ${nTY}%)`
                : symmetricCorners
                  ? `calc(${CORNER_TOP} + ${rTY}% + ${notifierStackPx}px)`
                  : `calc(${CORNER_TOP} - ${rTY}% + ${notifierStackPx}px)`,
            }}
          >
            <CornerSuitRaster suit={suit} sizePx={cornerGlyphPx} />
          </div>
        </>
      )}

      {!bgOnly && (
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{ transform: `translate(${courtOX}%, ${courtOY}%)` }}
        >
          {isJoker ? (
            <RasterPictureOr
              cardId={card}
              pictureStem={override?.centrePictureFile}
              pictureScale={centrePictureScale}
              fallback={
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className={`opacity-90 ${SUIT_COLORS['Joker'] ?? 'text-purple-500'}`}>
                    <SuitGlyph suit="Joker" className="h-[min(42vw,7rem)] w-[min(42vw,7rem)] max-h-[55%] max-w-[55%]" />
                  </div>
                </div>
              }
            />
          ) : royalPicture ? (
            <PictureInterior
              suit={suit}
              value={value}
              cardId={card}
              pipScale={pipScale}
              defaults={defaults}
              textOpacity={faceTextOpacity}
              centrePictureStem={override?.centrePictureFile}
              centrePictureScale={centrePictureScale}
            />
          ) : (
            <CenterFill
              card={card}
              suit={suit}
              value={value}
              override={override}
              defaults={defaults}
              pipScale={pipScale}
              centrePictureScale={centrePictureScale}
              textOpacity={faceTextOpacity}
            />
          )}
        </div>
      )}

      {bgOnly && captionConfig ? (
        <BackgroundCaptionLayers
          config={captionConfig}
          textColor={captionConfig.color?.trim() || faceTextFill}
          opacity={faceTextOpacity}
        />
      ) : null}
    </div>
  );
};

function PictureInterior({
  suit,
  value,
  cardId,
  pipScale,
  defaults,
  textOpacity,
  centrePictureStem,
  centrePictureScale,
}: {
  suit: string;
  value: string;
  cardId: string;
  pipScale: number;
  defaults?: CardArtGlobalDefaults;
  textOpacity: number;
  centrePictureStem?: string | null;
  centrePictureScale: number;
}) {
  const candidates = useMemo(() => pictureCardUrlCandidates(cardId, centrePictureStem), [cardId, centrePictureStem]);
  const [attempt, setAttempt] = useState(0);
  const s = clampCentrePictureScale(centrePictureScale);

  useEffect(() => {
    setAttempt(0);
  }, [cardId, centrePictureStem]);

  const rankFill = resolveSuitFaceTextColor(suit, defaults?.suitFaceTextColor);

  if (attempt < candidates.length) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-[14%] pb-[12%] pt-[16%]">
        <div
          className="flex max-h-[72%] max-w-full items-center justify-center"
          style={{ transform: s !== 1 ? `scale(${s})` : undefined }}
        >
          <img
            src={candidates[attempt]}
            alt=""
            className="max-h-full max-w-full object-contain drop-shadow"
            draggable={false}
            onError={() => setAttempt((a) => a + 1)}
          />
        </div>
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
        className="font-card-rank font-black"
        style={{
          fontSize: Math.round(CARD_ART_WIDTH * 0.14 * pipScale),
          color: rankFill,
          opacity: textOpacity,
          ...contrastTextShadow(rankFill),
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Large centre suit + rank when Ace/God court rasters are missing or fail to load (e.g. pip fallback looked tiny). */
function AceOrGodCentreFallback({
  suit,
  value,
  pipScale,
  defaults,
  textOpacity,
}: {
  suit: string;
  value: string;
  pipScale: number;
  defaults?: CardArtGlobalDefaults;
  textOpacity: number;
}) {
  const rankFill = resolveSuitFaceTextColor(suit, defaults?.suitFaceTextColor);
  const glyphScale = Math.max(pipScale, 1);
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1 px-[10%]">
      <div
        className="flex max-h-[52%] max-w-[62%] items-center justify-center"
        style={{ transform: `scale(${glyphScale})` }}
      >
        <SuitGlyph suit={suit as any} className={`h-full w-full max-h-full max-w-full opacity-90 ${SUIT_COLORS[suit] ?? ''}`} />
      </div>
      <span
        className="font-card-rank font-black"
        style={{
          fontSize: Math.round(CARD_ART_WIDTH * 0.2 * Math.max(pipScale, 0.85)),
          color: rankFill,
          opacity: textOpacity,
          ...contrastTextShadow(rankFill),
        }}
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
  centrePictureScale,
  textOpacity,
}: {
  card: string;
  suit: string;
  value: string;
  override?: CardArtOverride;
  defaults?: CardArtGlobalDefaults;
  pipScale: number;
  centrePictureScale: number;
  textOpacity: number;
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

  const centreStem = override?.centrePictureFile;

  if (aceOrGod) {
    return (
      <RasterPictureOr
        cardId={card}
        pictureStem={centreStem}
        pictureScale={centrePictureScale}
        fallback={
          <AceOrGodCentreFallback
            suit={suit}
            value={value}
            pipScale={pipScale}
            defaults={defaults}
            textOpacity={textOpacity}
          />
        }
      />
    );
  }

  return (
    <RasterPictureOr
      cardId={card}
      pictureStem={centreStem}
      pictureScale={centrePictureScale}
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
