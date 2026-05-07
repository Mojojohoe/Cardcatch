import type { DicePresentation, DiceTestRollPayload } from '../services/gameService';

/** Build a payload for `@3d-dice/dice-box-threejs` forced pip rolls (matches `DiceBoxTestOverlay`). */
export function diceTestRollPayloadFromValues(opts: {
  dice: readonly number[];
  rollId: string;
  uid: string;
  presentation?: DicePresentation;
  startedAt?: number;
}): DiceTestRollPayload {
  const { dice, rollId, uid } = opts;
  const startedAt = opts.startedAt ?? Date.now();
  const presentation = opts.presentation ?? 'hudBottom';
  if (dice.length === 1) {
    const v = dice[0]!;
    return {
      uid,
      rollId,
      notation: `1dpip@${v}`,
      dice: [v],
      total: v,
      startedAt,
      presentation,
    };
  }
  const a = dice[0]!;
  const b = dice[1]!;
  return {
    uid,
    rollId,
    notation: `2dpip@${a},${b}`,
    dice: [a, b],
    total: a + b,
    startedAt,
    presentation,
  };
}
