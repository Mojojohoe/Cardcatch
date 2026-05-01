import React from 'react';
import { Skull } from 'lucide-react';
import type { Suit } from '../types';
import { SuitGlyph } from '../components/SuitGlyphs';
import { SUITS } from '../types';
import type { WheelDefinition, WheelOutcomeInput } from './types';
import { DESPERATION_SLICE_ROWS, FORTUNE_SLICE_ROWS } from './presets';

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

/** Equal slice size per suit on the round table trump dial. */
export function buildTargetSuitWheelDefinition(
  availableSuits: readonly Suit[] = defaultSuits,
): WheelDefinition {
  const suits = availableSuits.length > 0 ? availableSuits : defaultSuits;
  const outcomes: WheelOutcomeInput[] = suits.map((suit) => {
    const { fill, markFill } = suitSlicePalette(suit);
    return {
      id: `suit_${suit}`,
      label: suit,
      display: suit,
      color: fill,
      probability: 1,
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
