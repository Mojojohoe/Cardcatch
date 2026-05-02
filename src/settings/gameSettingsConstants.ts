/** Shown when the host tweaks any setting away from the selected preset bundle. */
export const CUSTOM_LOBBY_PRESET_ID = 'custom';

/** Built-in Cardcatch ruleset shipped as a text preset file. */
export const BUILTIN_CARDCATCH_PRESET_ID = 'builtin:cardcatch';

export const CUSTOM_PRESETS_STORAGE_KEY = 'cardcatch_lobby_custom_presets_v1';

export interface SavedLobbyPreset {
  id: string;
  name: string;
  description: string;
  /** Stored snapshot (must normalize when loading). */
  settings: Record<string, unknown>;
}
