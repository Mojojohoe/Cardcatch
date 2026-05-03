import type { PipGridCell } from './types';
import { PIP_GRID_COLS, PIP_GRID_ROWS } from './types';

function N(x: number, y: number): PipGridCell {
  return {
    col: Math.min(PIP_GRID_COLS - 1, Math.max(0, Math.round(x * PIP_GRID_COLS - 0.5))),
    row: Math.min(PIP_GRID_ROWS - 1, Math.max(0, Math.round(y * PIP_GRID_ROWS - 0.5))),
  };
}

/** Convert grid cell to center position as fraction of full card (0–1). */
export function pipGridCellToFraction(cell: PipGridCell): { x: number; y: number } {
  return {
    x: (cell.col + 0.5) / PIP_GRID_COLS,
    y: (cell.row + 0.5) / PIP_GRID_ROWS,
  };
}

/** Curated layouts (grid indices), symmetric pip courts for ranks 2–10. */
export const DEFAULT_PIP_GRIDS: Record<string, PipGridCell[]> = {
  '2': [N(0.42, 0.28), N(0.42, 0.72)],
  '3': [N(0.42, 0.22), N(0.42, 0.5), N(0.42, 0.78)],
  '4': [N(0.32, 0.26), N(0.52, 0.26), N(0.32, 0.74), N(0.52, 0.74)],
  '5': [N(0.32, 0.26), N(0.52, 0.26), N(0.42, 0.5), N(0.32, 0.74), N(0.52, 0.74)],
  '6': [N(0.32, 0.22), N(0.52, 0.22), N(0.32, 0.5), N(0.52, 0.5), N(0.32, 0.78), N(0.52, 0.78)],
  '7': [N(0.32, 0.2), N(0.52, 0.2), N(0.42, 0.34), N(0.32, 0.5), N(0.52, 0.5), N(0.32, 0.78), N(0.52, 0.78)],
  '8': [
    N(0.32, 0.18),
    N(0.52, 0.18),
    N(0.32, 0.38),
    N(0.52, 0.38),
    N(0.32, 0.62),
    N(0.52, 0.62),
    N(0.32, 0.82),
    N(0.52, 0.82),
  ],
  '9': [
    N(0.32, 0.17),
    N(0.52, 0.17),
    N(0.32, 0.35),
    N(0.52, 0.35),
    N(0.42, 0.5),
    N(0.32, 0.65),
    N(0.52, 0.65),
    N(0.32, 0.83),
    N(0.52, 0.83),
  ],
  '10': [
    N(0.28, 0.16),
    N(0.42, 0.16),
    N(0.56, 0.16),
    N(0.28, 0.38),
    N(0.42, 0.38),
    N(0.56, 0.38),
    N(0.28, 0.62),
    N(0.42, 0.62),
    N(0.56, 0.62),
    N(0.42, 0.84),
  ],
};

export function defaultPipCellsForRank(rank: string): PipGridCell[] | null {
  return DEFAULT_PIP_GRIDS[rank] ?? null;
}
