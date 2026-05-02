import type { GameSettings } from '../types';
import type { SavedLobbyPreset } from './gameSettingsConstants';
import { CUSTOM_PRESETS_STORAGE_KEY, BUILTIN_CARDCATCH_PRESET_ID } from './gameSettingsConstants';

import builtinCardcatchRaw from './builtin/cardcatch.preset.txt?raw';

export interface PresetListEntry {
  id: string;
  name: string;
  description: string;
  /** When set, applying this preset merges these fields after defaults. */
  partial?: Partial<GameSettings>;
}

function parseBuiltinTextFile(raw: string): { name: string; description: string; json: Record<string, unknown> } {
  const sepIdx = raw.indexOf('\n---\n');
  if (sepIdx < 0) throw new Error('Invalid preset file: missing --- separator');
  const header = raw.slice(0, sepIdx).trim();
  const body = raw.slice(sepIdx + 5).trim();
  let name = 'Preset';
  let description = '';
  for (const line of header.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'name') name = value;
    if (key === 'description') description = value;
  }
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    return { name, description, json };
  } catch {
    throw new Error('Invalid preset JSON body');
  }
}

function builtinEntries(): PresetListEntry[] {
  const parsed = parseBuiltinTextFile(builtinCardcatchRaw);
  return [
    {
      id: BUILTIN_CARDCATCH_PRESET_ID,
      name: parsed.name,
      description: parsed.description,
      partial: parsed.json as Partial<GameSettings>,
    },
  ];
}

export function listStaticBuiltinPresets(): PresetListEntry[] {
  return builtinEntries();
}

export function loadCustomPresets(): SavedLobbyPreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedLobbyPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomPresetList(entries: SavedLobbyPreset[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(entries));
}

export function appendCustomPreset(entry: SavedLobbyPreset) {
  const next = loadCustomPresets().filter((p) => p.id !== entry.id);
  next.push(entry);
  saveCustomPresetList(next);
}
