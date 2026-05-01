/**
 * Data-only wheel outcomes for game logic + UI presets (no React).
 * Import from `gameService` and `wheels/definitions` (React) as needed.
 */

export const DESPERATION_SLICE_ROWS = [
  { id: 'game_over', label: 'GAME OVER', probability: 1 },
  { id: 'g3a', label: 'Gain 3 Cards', probability: 15 },
  { id: 'g2a', label: 'Gain 2 Cards', probability: 6 },
  { id: 'g4a', label: 'Gain 4 Cards', probability: 6 },
  { id: 'g1a', label: 'Gain 1 Cards', probability: 3 },
  { id: 'g3b', label: 'Gain 3 Cards', probability: 15 },
  { id: 'g2b', label: 'Gain 2 Cards', probability: 6 },
  { id: 'g4b', label: 'Gain 4 Cards', probability: 6 },
  { id: 'g1b', label: 'Gain 1 Cards', probability: 3 },
  { id: 'g3c', label: 'Gain 3 Cards', probability: 15 },
  { id: 'g2c', label: 'Gain 2 Cards', probability: 6 },
  { id: 'g4c', label: 'Gain 4 Cards', probability: 6 },
  { id: 'g1c', label: 'Gain 1 Cards', probability: 3 },
  { id: 'g5', label: 'Gain 5 Cards', probability: 5 },
  { id: 'g6', label: 'Gain 6 Cards', probability: 4 },
] as const;

/** Matches legacy `DESPERATION_SLICES` shape for spins + messages */
export const DESPERATION_GAME_SLICES = DESPERATION_SLICE_ROWS.map((r) => ({
  label: r.label,
  weight: r.probability,
}));

export const FORTUNE_SLICE_ROWS = [
  { id: 'lose_round', label: 'LOSE_ROUND', probability: 3 },
  { id: 'win_round', label: 'WIN_ROUND', probability: 3 },
  { id: 'win_2_cards', label: 'WIN_2_CARDS', probability: 5 },
  { id: 'double_joker', label: 'DOUBLE_JOKER', probability: 1 },
  { id: 'jackpot', label: 'JACKPOT', probability: 2 },
  { id: 'power_card', label: 'POWER_CARD', probability: 1 },
  { id: 'lose_2_cards', label: 'LOSE_2_CARDS', probability: 5 },
] as const;

export const FORTUNE_GAME_SLICES = FORTUNE_SLICE_ROWS.map((r) => ({
  label: r.label,
  weight: r.probability,
}));
