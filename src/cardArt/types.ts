/** Design-time canvas: odd × odd so one cell is the true centre (e.g. col 5 / row 8 for 11×17). */
export const PIP_GRID_COLS = 11;
export const PIP_GRID_ROWS = 17;

/** 0=normal, 1=flip horizontal, 2=flip vertical, 3=flip both (click cycle; 4th → 5th click deletes). */
export type PipOrient = 0 | 1 | 2 | 3;

export type PipSlot = { col: number; row: number; o?: PipOrient };

/** @deprecated alias — use PipSlot */
export type PipGridCell = PipSlot;

/** Overlay lines on top of a background-only assembled face (corners/pips hidden). */
export type BackgroundCaptionConfig = {
  text?: string;
  /** Multiplier on default caption size (1 ≈ 12px at 256px card width). */
  scale?: number;
  /** Anchor 0–100 from left edge (50 = horizontal centre). */
  anchorXPct?: number;
  anchorYPct?: number;
  maxWidthPct?: number;
};

/** Corner index (rank + notifier suit) layout. */
export type CornerTextConfig = {
  scale?: number;
  /** Additional offset from the corner anchor toward the card interior. */
  offsetLeftXPct?: number;
  offsetTopYPct?: number;
  /**
   * When true (default), top-left and bottom-right use the same offset sign so both move toward the card centre.
   * When false, uses legacy bottom-corner anchoring (subtract X/Y on the bottom-right).
   */
  symmetricCorners?: boolean;
};

/** Logical card id matches game strings, e.g. `Hearts-A`, `Diamonds-10`. */
export type CardArtOverride = {
  customImageFile?: string;
  customDataUrl?: string;
  /** Pip centres + optional flip per pip */
  pipGrid?: PipSlot[];
  /**
   * Only background + optional full-card upload: hide corner rank/suit and all centre pips/pictures.
   * Use when the face image (suit default or `customImageFile`) already contains the full design.
   */
  backgroundOnly?: boolean;
  /** Shown when `backgroundOnly` is true (merged with global defaults). */
  backgroundCaption?: BackgroundCaptionConfig;
};

export type CardArtManifest = Record<string, CardArtOverride>;

export type CardArtDisplayMode = 'vector' | 'raster';

export type CardArtGlobalDefaults = {
  /**
   * Face background per suit (filename in `public/assets/images/`; extensions auto-tried).
   * Standard suits + any extra (e.g. `Frogs`, `Coins`, `Moons`, `Joker` for a shared joker field).
   */
  suitBackgroundFile?: Partial<Record<string, string>>;
  /**
   * Centre / court pip symbol scale. Last matching range wins. Ranks: 2…A.
   * Does not affect corner “notifier” suit size.
   */
  pipScaleRanges?: { from: string; to: string; scale: number }[];
  /**
   * Corner rank + small suit next to the rank. Independent from centre pip scale.
   * Last matching range wins.
   */
  notifierScaleRanges?: { from: string; to: string; scale: number }[];
  cornerText?: CornerTextConfig;
  /**
   * Shift centre court art (pips, royalty picture, joker centre) as % of the card size.
   * Positive X moves right, positive Y moves down.
   */
  courtCentreOffsetPct?: { x?: number; y?: number };
  /** Default caption for any background-only face unless the card override replaces it. */
  backgroundCaptionDefaults?: BackgroundCaptionConfig;
  /**
   * When true, assembled faces show only the background chain (and optional underlay), no corners or centre art.
   */
  backgroundOnly?: boolean;
  /** Solid underlay behind transparent PNGs or minimal faces (default `#000000`). */
  faceUnderlayColor?: string;
  /**
   * One pip layout for this rank applied to every suit (Hearts-2, Diamonds-2, …).
   * Each card still draws its own suit glyph at each slot.
   */
  sharedPipLayoutByRank?: Record<string, PipSlot[]>;
};
