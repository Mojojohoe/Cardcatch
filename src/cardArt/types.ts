/** Design-time canvas: odd × odd so one cell is the true centre (e.g. col 5 / row 8 for 11×17). */
export const PIP_GRID_COLS = 11;
export const PIP_GRID_ROWS = 17;

/** 0=normal, 1=flip horizontal, 2=flip vertical, 3=flip both (click cycle; 4th → 5th click deletes). */
export type PipOrient = 0 | 1 | 2 | 3;

export type PipSlot = { col: number; row: number; o?: PipOrient };

/** @deprecated alias — use PipSlot */
export type PipGridCell = PipSlot;

/** Logical card id matches game strings, e.g. `Hearts-A`, `Diamonds-10`. */
export type CardArtOverride = {
  customImageFile?: string;
  customDataUrl?: string;
  /** Pip centres + optional flip per pip */
  pipGrid?: PipSlot[];
};

export type CardArtManifest = Record<string, CardArtOverride>;

export type CardArtDisplayMode = 'vector' | 'raster';

/** Global defaults (Card Creator “Defaults” scope). */
export type CardArtGlobalDefaults = {
  /** Optional face background per suit (filename in assets/images; extensions tried automatically). */
  suitBackgroundFile?: Partial<Record<'Hearts' | 'Diamonds' | 'Clubs' | 'Spades', string>>;
  /** Last matching range wins. Ranks use standard VALUES order (2…A). */
  pipScaleRanges?: { from: string; to: string; scale: number }[];
  /**
   * One pip layout for this rank applied to every suit (Hearts-2, Diamonds-2, …).
   * Each card still draws its own suit glyph at each slot.
   */
  sharedPipLayoutByRank?: Record<string, PipSlot[]>;
};
