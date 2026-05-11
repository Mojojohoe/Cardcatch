/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LAYOUT_GRID_COLS, LAYOUT_GRID_ROWS, cellKey, parseCellKey, type LayoutCellAssignment } from './types';

export type MergedLayoutRegion = {
  col: number;
  row: number;
  w: number;
  h: number;
  assignment: Exclude<LayoutCellAssignment, { kind: 'empty' }>;
};

function sameMergeGroup(a: LayoutCellAssignment, b: LayoutCellAssignment): boolean {
  if (a.kind === 'empty' || b.kind === 'empty') return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'game' && b.kind === 'game') return a.element === b.element;
  if (a.kind === 'ui' && b.kind === 'ui') return a.element === b.element;
  return false;
}

const NEIGHBORS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Merge 4-connected cells with the same game/ui element (notes may differ; first cell wins in export).
 */
export function mergeLayoutRegions(cells: Record<string, LayoutCellAssignment>): MergedLayoutRegion[] {
  const visited = new Set<string>();
  const regions: MergedLayoutRegion[] = [];

  for (let row = 0; row < LAYOUT_GRID_ROWS; row++) {
    for (let col = 0; col < LAYOUT_GRID_COLS; col++) {
      const k = cellKey(col, row);
      const start = cells[k];
      if (!start || start.kind === 'empty' || visited.has(k)) continue;

      const seed = start;
      const queue: [number, number][] = [[col, row]];
      const component = new Set<string>();
      visited.add(k);
      component.add(k);

      while (queue.length) {
        const [c, r] = queue.pop()!;
        for (const [dc, dr] of NEIGHBORS) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nc >= LAYOUT_GRID_COLS || nr < 0 || nr >= LAYOUT_GRID_ROWS) continue;
          const nk = cellKey(nc, nr);
          if (visited.has(nk)) continue;
          const nxt = cells[nk];
          if (!nxt || !sameMergeGroup(seed, nxt)) continue;
          visited.add(nk);
          component.add(nk);
          queue.push([nc, nr]);
        }
      }

      let minC = LAYOUT_GRID_COLS;
      let minR = LAYOUT_GRID_ROWS;
      let maxC = 0;
      let maxR = 0;
      for (const key of component) {
        const p = parseCellKey(key);
        if (!p) continue;
        minC = Math.min(minC, p.col);
        minR = Math.min(minR, p.row);
        maxC = Math.max(maxC, p.col);
        maxR = Math.max(maxR, p.row);
      }
      regions.push({
        col: minC,
        row: minR,
        w: maxC - minC + 1,
        h: maxR - minR + 1,
        assignment: seed as Exclude<LayoutCellAssignment, { kind: 'empty' }>,
      });
    }
  }

  return regions;
}
