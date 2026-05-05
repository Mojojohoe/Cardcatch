import rawEnglish from './English.txt?raw';

type Dict = Record<string, string>;

function parseLanguageFile(raw: string): Dict {
  const out: Dict = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

const EN = parseLanguageFile(rawEnglish);

function lookup(key: string, fallback: string): string {
  const v = EN[key];
  return v && v.length > 0 ? v : fallback;
}

export function localizedSuitName(suit: string): string {
  return lookup(`suit.${suit}`, suit);
}

export function localizedRankLabel(rank: string): string {
  return lookup(`rank.${rank}`, rank);
}

export function localizedLabel(key: string, fallback: string): string {
  return lookup(`label.${key}`, fallback);
}

export function localizedPowerDescription(cardId: number, fallback: string): string {
  return lookup(`power.${cardId}`, fallback);
}

export function localizedCurseDescription(cardId: number, fallback: string): string {
  return lookup(`curse.${cardId}`, fallback);
}

