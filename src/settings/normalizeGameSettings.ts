import type { GameSettings } from '../types';
import {
  CUSTOM_LOBBY_PRESET_ID,
  BUILTIN_CARDCATCH_PRESET_ID,
} from './gameSettingsConstants';
import { standardDeckComposition } from './deckMath';

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

function migrateDifficultyToHands(raw: Record<string, unknown>): {
  predatorStartingCards?: number;
  preyStartingCards?: number;
} {
  if (raw.predatorStartingCards != null || raw.preyStartingCards != null) return {};
  switch (raw.difficulty) {
    case 'Fair':
      return { predatorStartingCards: 10, preyStartingCards: 10 };
    case 'Hard':
      return { predatorStartingCards: 10, preyStartingCards: 6 };
    case 'Impossible':
      return { predatorStartingCards: 10, preyStartingCards: 2 };
    default:
      return { predatorStartingCards: 10, preyStartingCards: 6 };
  }
}

export function balanceStartingHandsAgainstDeck(settings: Omit<GameSettings, 'lobbyPresetId'>): {
  predatorStartingCards: number;
  preyStartingCards: number;
} {
  const cap = standardDeckComposition(settings).total;
  let pred = clampInt(settings.predatorStartingCards, 1, Math.max(1, cap - 1), 10);
  let prey = clampInt(settings.preyStartingCards, 1, Math.max(1, cap - 1), 6);
  if (pred + prey <= cap) return { predatorStartingCards: pred, preyStartingCards: prey };
  prey = Math.max(1, Math.min(prey, cap - pred));
  if (pred + prey <= cap) return { predatorStartingCards: pred, preyStartingCards: prey };
  pred = Math.max(1, cap - prey);
  if (pred + prey > cap) {
    prey = Math.max(1, Math.floor(cap / 2));
    pred = Math.max(1, cap - prey);
  }
  return { predatorStartingCards: pred, preyStartingCards: prey };
}

/** Default lobby bundle (also matches built-in preset file). */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  hostRole: 'Predator',
  predatorStartingCards: 10,
  preyStartingCards: 6,
  deckSizeMultiplier: 1,
  disableJokers: false,
  disablePowerCards: false,
  enableCurseCards: true,
  curseCardsInPowerDeck: false,
  enablePokerChips: true,
  enablePanicDice: true,
  enableDesperation: true,
  desperationStarterTierEnabled: true,
  preydatorDesperationSeats: 'guest',
  tiers: [
    '1 Week Temp',
    '2 Weeks Temp',
    '1 Month Temp',
    '2 Months Temp',
    '6 Months Temp',
    '1 Year Temp',
    'Permanent',
  ],
  lobbyPresetId: BUILTIN_CARDCATCH_PRESET_ID,
};

export function normalizeGameSettings(raw: Partial<GameSettings> | GameSettings): GameSettings {
  const r = raw as Record<string, unknown>;
  const mig = migrateDifficultyToHands(r);

  const hostRole = ((raw.hostRole ?? DEFAULT_GAME_SETTINGS.hostRole) as GameSettings['hostRole']) ?? 'Predator';
  const preydOk =
    hostRole === 'Preydator' &&
    raw.preydatorDesperationSeats !== undefined &&
    (raw.preydatorDesperationSeats === 'host' ||
      raw.preydatorDesperationSeats === 'guest' ||
      raw.preydatorDesperationSeats === 'both');

  let tiers =
    raw.tiers && Array.isArray(raw.tiers) && raw.tiers.length > 0
      ? [...raw.tiers].map(String)
      : [...DEFAULT_GAME_SETTINGS.tiers];

  let draft: Omit<GameSettings, 'lobbyPresetId'> = {
    hostRole,
    predatorStartingCards:
      mig.predatorStartingCards ??
      clampInt(raw.predatorStartingCards, 1, 120, DEFAULT_GAME_SETTINGS.predatorStartingCards),
    preyStartingCards:
      mig.preyStartingCards ?? clampInt(raw.preyStartingCards, 1, 120, DEFAULT_GAME_SETTINGS.preyStartingCards),
    deckSizeMultiplier: clampInt(
      raw.deckSizeMultiplier ?? r.deckSizeMultiplier,
      1,
      24,
      DEFAULT_GAME_SETTINGS.deckSizeMultiplier,
    ),
    disableJokers:
      raw.disableJokers !== undefined ? Boolean(raw.disableJokers) : DEFAULT_GAME_SETTINGS.disableJokers,
    disablePowerCards:
      raw.disablePowerCards !== undefined
        ? Boolean(raw.disablePowerCards)
        : DEFAULT_GAME_SETTINGS.disablePowerCards,
    enableCurseCards: raw.enableCurseCards !== false,
    curseCardsInPowerDeck: Boolean(raw.curseCardsInPowerDeck),
    enablePokerChips: raw.enablePokerChips !== false,
    enablePanicDice: raw.enablePanicDice !== false,
    enableDesperation: raw.enableDesperation !== undefined ? Boolean(raw.enableDesperation) : DEFAULT_GAME_SETTINGS.enableDesperation,
    desperationStarterTierEnabled:
      raw.desperationStarterTierEnabled !== undefined
        ? raw.desperationStarterTierEnabled !== false
        : DEFAULT_GAME_SETTINGS.desperationStarterTierEnabled,
    preydatorDesperationSeats: preydOk ? raw.preydatorDesperationSeats! : 'guest',
    tiers,
  };

  const hands = balanceStartingHandsAgainstDeck(draft);

  draft = {
    ...draft,
    ...hands,
  };

  const lobbyPresetId =
    typeof raw.lobbyPresetId === 'string' && raw.lobbyPresetId.trim().length > 0
      ? raw.lobbyPresetId.trim()
      : DEFAULT_GAME_SETTINGS.lobbyPresetId;

  return {
    ...draft,
    lobbyPresetId,
  };
}

export function persistLobbyDefaults(storageKey: string, settings: GameSettings) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

export function loadPersistedLobbySettings(storageKey: string): GameSettings {
  if (typeof localStorage === 'undefined') return { ...normalizeGameSettings({}) };
  const saved = localStorage.getItem(storageKey);
  if (!saved) return { ...normalizeGameSettings({}) };
  try {
    return normalizeGameSettings(JSON.parse(saved) as Partial<GameSettings>);
  } catch {
    return { ...normalizeGameSettings({}) };
  }
}

export { CUSTOM_LOBBY_PRESET_ID, BUILTIN_CARDCATCH_PRESET_ID };
