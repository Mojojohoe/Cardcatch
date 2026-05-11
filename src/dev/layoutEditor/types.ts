/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LayoutEditorLayer = 'game' | 'ui';

/** Game-layer semantic slots (table / chrome that participates in the board grid). */
export type GameElementKey =
  | 'opponent_cards'
  | 'opponent_tokens'
  | 'opponent_power_cards'
  | 'play_area'
  | 'fire_bowl'
  | 'deck'
  | 'player_power_cards'
  | 'player_cards'
  | 'panic_dice_image'
  | 'player_tokens'
  | 'curse_zone'
  | 'room_chat'
  | 'tyrant_crown'
  | 'other_game';

/** HUD / chrome (small controls; may float above game layer by z-index). */
export type GameUiElementKey =
  | 'opponent_desperation'
  | 'player_desperation'
  | 'play_card_button'
  | 'cash_chips_button'
  | 'panic_dice_button'
  | 'room_code_copy'
  | 'role_title'
  | 'name_ready'
  | 'settings_button'
  | 'rules_button'
  | 'local_multiplayer_toggle'
  | 'dev_menu_button'
  | 'other_ui';

export type LayoutCellAssignment =
  | { kind: 'empty' }
  | { kind: 'game'; element: GameElementKey; notes: string }
  | { kind: 'ui'; element: GameUiElementKey; notes: string };

export const LAYOUT_GRID_COLS = 16;
export const LAYOUT_GRID_ROWS = 10;

export type LayoutExportV1 = {
  version: 1;
  exportedAt: string;
  /** Viewport this layout was authored against (CSS px). */
  viewport: { width: number; height: number };
  layer: LayoutEditorLayer;
  grid: {
    columns: number;
    rows: number;
    /** CSS grid track templates for a uniform board. */
    columnTemplateFr: string;
    rowTemplateFr: string;
  };
  /** Sparse: only non-empty cells; 0-based col/row. */
  cells: Array<{
    col: number;
    row: number;
    assignment: Exclude<LayoutCellAssignment, { kind: 'empty' }>;
  }>;
  /** Optional merged rectangles (same element + notes) for hand-authoring; may be empty. */
  spans?: Array<{
    col: number;
    row: number;
    colSpan: number;
    rowSpan: number;
    element: string;
    notes: string;
    layer: LayoutEditorLayer;
  }>;
};

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseCellKey(key: string): { col: number; row: number } | null {
  const m = /^(\d+),(\d+)$/.exec(key);
  if (!m) return null;
  return { col: Number(m[1]), row: Number(m[2]) };
}
