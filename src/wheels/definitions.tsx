import React from 'react';
import { Cloud, Moon, Skull, Sun } from 'lucide-react';
import type { Suit } from '../types';
import { SuitGlyph } from '../components/SuitGlyphs';
import { SUITS } from '../types';
import type { WheelDefinition, WheelOutcomeInput } from './types';
import { DESPERATION_SLICE_ROWS, FORTUNE_SLICE_ROWS, SLOTH_DREAM_SLICE_ROWS } from './presets';

const desperationOutcomes: WheelOutcomeInput[] = DESPERATION_SLICE_ROWS.map((r) =>
  r.label === 'GAME OVER'
    ? {
        id: r.id,
        label: r.label,
        display: 'SYSTEM FAIL',
        color: '#2d0606',
        probability: r.probability,
        textTone: 'danger',
      }
    : {
        id: r.id,
        label: r.label,
        display: r.label.toUpperCase().replace('GAIN', 'DRAW'),
        color: 'alternating',
        probability: r.probability,
        textTone: 'muted',
      },
);

export const desperationWheelDefinition: WheelDefinition = {
  id: 'desperation',
  name: 'Desperation',
  outerEdgeColor: 'rgba(88, 28, 135, 0.4)',
  color1: '#1e1b4b',
  color2: '#110e2d',
  tickerColor: '#facc15',
  spinDurationSeconds: 12,
  extraSpinsWhileSpinning: 15,
  outerEdgeWidthPx: 10,
  showSliceDividers: true,
  dividerOpacity: 0.2,
  outcomes: desperationOutcomes,
};

const fortuneOutcomes: WheelOutcomeInput[] = FORTUNE_SLICE_ROWS.map((r) => ({
  id: r.id,
  label: r.label,
  color:
    r.label === 'LOSE_ROUND'
      ? '#7f1d1d'
      : r.label === 'WIN_ROUND'
        ? '#14532d'
        : r.label === 'WIN_2_CARDS'
          ? '#1e3a8a'
          : r.label === 'DOUBLE_JOKER'
            ? '#581c87'
            : r.label === 'JACKPOT'
              ? '#854d0e'
              : r.label === 'POWER_CARD'
                ? '#0f766e'
                : '#7c2d12',
  probability: r.probability,
  textTone: 'default' as const,
}));

/** Sloth curse dream wheel (equal fifths; aligns with ~0.2 Sun odds in design docs). */
const slothDreamOutcomes: WheelOutcomeInput[] = SLOTH_DREAM_SLICE_ROWS.map((r) => {
  const base = {
    id: r.id,
    label: r.label,
    probability: r.probability,
    textTone: 'default' as const,
  };
  switch (r.id) {
    case 'nothing':
      return {
        ...base,
        display: 'Stillness',
        color: '#475569',
        content: (
          <span className="text-slate-200">
            <Cloud className="mx-auto h-7 w-7 sm:h-9 sm:w-9 opacity-90" strokeWidth={1.75} />
          </span>
        ),
      };
    case 'stars':
      return {
        ...base,
        display: 'Stars',
        color: '#1e1b4b',
        content: (
          <span className="text-amber-200">
            <SuitGlyph suit="Stars" className="mx-auto h-8 w-8 sm:h-9 sm:w-9" />
          </span>
        ),
      };
    case 'moons':
      return {
        ...base,
        display: 'Moons',
        color: '#0f172a',
        content: (
          <span className="text-slate-100">
            <SuitGlyph suit="Moons" className="mx-auto h-8 w-8 sm:h-9 sm:w-9" />
          </span>
        ),
      };
    case 'both':
      return {
        ...base,
        display: 'Both',
        color: '#312e81',
        content: (
          <span className="flex justify-center gap-0.5 text-amber-200">
            <SuitGlyph suit="Stars" className="h-6 w-6 sm:h-8 sm:w-8" />
            <SuitGlyph suit="Moons" className="h-6 w-6 sm:h-8 sm:w-8" />
          </span>
        ),
      };
    case 'sun':
    default:
      return {
        ...base,
        display: 'Sun',
        color: '#f59e0b',
        content: (
          <span className="text-amber-950">
            <Sun className="mx-auto h-8 w-8 sm:h-9 sm:w-9 drop-shadow-[0_0_10px_rgba(253,224,71,0.85)]" strokeWidth={2} />
          </span>
        ),
      };
  }
});

export const slothDreamWheelDefinition: WheelDefinition = {
  id: 'sloth_dream',
  name: 'Sloth’s Dream',
  outerEdgeColor: 'rgba(30, 27, 75, 0.55)',
  color1: '#1e293b',
  color2: '#0f172a',
  tickerColor: '#fcd34d',
  spinDurationSeconds: 5,
  extraSpinsWhileSpinning: 9,
  outerEdgeWidthPx: 10,
  showSliceDividers: true,
  dividerOpacity: 0.22,
  outcomes: slothDreamOutcomes,
  hub: {
    mode: 'node',
    node: (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-slate-700 bg-slate-900/95 shadow-inner">
        <Moon className="h-6 w-6 text-indigo-200/90" strokeWidth={1.9} />
      </div>
    ),
  },
};

export const fortuneWheelDefinition: WheelDefinition = {
  id: 'wheel_of_fortune',
  name: 'Wheel of Fortune',
  outerEdgeColor: 'rgba(217, 119, 6, 0.6)',
  color1: '#1e293b',
  color2: '#0f172a',
  tickerColor: '#facc15',
  spinDurationSeconds: 2.5,
  extraSpinsWhileSpinning: 10,
  hub: {
    mode: 'text',
    text: 'Wheel',
    className:
      'w-16 h-16 rounded-full bg-amber-700 border-4 border-amber-300 flex items-center justify-center shadow-inner',
    innerClassName: 'text-[10px] font-black text-black uppercase',
  },
  outerEdgeWidthPx: 10,
  showSliceDividers: true,
  dividerOpacity: 0.3,
  outcomes: fortuneOutcomes,
};

const defaultSuits = SUITS;

function suitSlicePalette(suit: Suit): { fill: string; markFill: string } {
  const fill =
    suit === 'Moons'
      ? '#000000'
      : suit === 'Stars'
        ? '#1e1b4b'
        : suit === 'Diamonds' || suit === 'Hearts'
          ? '#0f172a'
          : '#f8fafc';
  const markFill =
    suit === 'Moons'
      ? '#ffffff'
      : suit === 'Stars'
        ? '#facc15'
        : suit === 'Diamonds' || suit === 'Hearts'
          ? '#ef4444'
          : '#0f172a';
  return { fill, markFill };
}

/** Trump dial: equal slices by default; Lust triples Hearts’ weight on the wheel. */
export function buildTargetSuitWheelDefinition(
  availableSuits: readonly Suit[] = defaultSuits,
  opts?: { lustTripleHearts?: boolean; greedHalveBasicSuits?: boolean },
): WheelDefinition {
  const suits = availableSuits.length > 0 ? availableSuits : defaultSuits;
  const lustTriple = Boolean(opts?.lustTripleHearts);
  const greedHalve = Boolean(opts?.greedHalveBasicSuits);
  const outcomes: WheelOutcomeInput[] = suits.map((suit) => {
    const { fill, markFill } = suitSlicePalette(suit);
    let probability = suit === 'Hearts' && lustTriple ? 3 : 1;
    if (greedHalve && (suit === 'Hearts' || suit === 'Clubs' || suit === 'Spades')) {
      probability *= 0.5;
    }
    return {
      id: `suit_${suit}`,
      label: suit,
      display: suit,
      color: fill,
      probability,
      content: (
        <span style={{ color: markFill }}>
          <SuitGlyph suit={suit} className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
        </span>
      ),
      textTone: 'default',
    };
  });

  return {
    id: 'target_suit',
    name: 'Table suit',
    outerEdgeColor: '#0f172a',
    color1: '#064e3b',
    color2: '#022c22',
    tickerColor: '#eab308',
    spinDurationSeconds: 5,
    extraSpinsWhileSpinning: 8,
    outerEdgeWidthPx: 8,
    showSliceDividers: true,
    dividerOpacity: 0.08,
    outcomes,
    hub: {
      mode: 'node',
      node: (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-emerald-800 bg-emerald-900 shadow-inner">
          <Skull className="h-5 w-5 text-emerald-400" />
        </div>
      ),
    },
  };
}
