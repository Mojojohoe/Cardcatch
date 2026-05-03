/** Design-time canvas: odd × odd so one cell is the true centre (e.g. col 5 / row 8 for 11×17). */
export const PIP_GRID_COLS = 11;
export const PIP_GRID_ROWS = 17;

export type PipGridCell = { col: number; row: number };

/** Logical card id matches game strings, e.g. `Hearts-A`, `Diamonds-10`. */
export type CardArtOverride = {
  /** Filename placed in `public/assets/images/` (or project root `dist/...` when built). */
  customImageFile?: string;
  /** Optional in-browser upload (persists in localStorage). */
  customDataUrl?: string;
  /** When set, pip positions for numeric ranks 2–10 (grid snaps). */
  pipGrid?: PipGridCell[];
};

export type CardArtManifest = Record<string, CardArtOverride>;

export type CardArtDisplayMode = 'vector' | 'raster';
