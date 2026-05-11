/**
 * @file Table layout policy — single source of truth for responsive / density work.
 *
 * Product decisions (locked for the responsive overhaul):
 *
 * ## 1) No scrollbars, ever
 * The main game shell and table chrome must not rely on `overflow: auto|scroll` to fit content.
 * Instead: scale and compact until a minimum usable scale; beyond that, **defer UI to contextual
 * menus** (overflowing panels, icon-only rails, “more…” drawers) rather than introducing scrollbars.
 * Modals that are explicitly separate flows (e.g. legal copy) should use **stepped / paged** content
 * or dedicated overlay patterns that do not read as “the table scrolled.”
 *
 * ## 2) Minimum design viewport — iPad Mini class
 * Lay out and test so the **full table experience fits without scroll** at **1024×768** CSS pixels
 * (restrictive floor; intentionally harder than many laptops so mobile-friendly scaling falls out of
 * the same system). Height **768** is the canonical target (common iPad-class minimum; if you see
 * “786” in older notes, treat it as this same floor).
 *
 * ## 3) Auto-engage compaction / contextual UI
 * Density tiers and contextual menus **turn on automatically** from measured viewport (and optional
 * user overrides later). Users should not have to discover a manual “compact mode” to get a
 * playable layout at the minimum viewport — though prefs (card scale, tooltip size) may still
 * fine-tune on top of auto tier.
 *
 * Implementation note: `GameInstance` and related components should import these constants when
 * wiring `ResizeObserver` / container queries so magic numbers converge here.
 *
 * Chip piles (`ChipDropperTest`) use geometry tied to the center column’s max width (`64rem` at xl)
 * so piles do not sit under the bowl / target suit; update those calcs if the center `max-w` ladder
 * in `GameInstance` changes.
 *
 * Dev layout authoring: open `#layout-editor` (see `DevPowerMenu` / `App.tsx`) for the 16×10 grid
 * tool used to capture placement notes and JSON exports across resolutions.
 */

/** Minimum width (CSS px) the table layout must support without scrollbars at full chrome. */
export const TABLE_LAYOUT_MIN_WIDTH_PX = 1024;

/** Minimum height (CSS px) — iPad-class floor (see module doc). */
export const TABLE_LAYOUT_MIN_HEIGHT_PX = 768;

/** Canonical minimum viewport as one object (for ResizeObserver / story fixtures). */
export const TABLE_LAYOUT_MIN_VIEWPORT = {
  width: TABLE_LAYOUT_MIN_WIDTH_PX,
  height: TABLE_LAYOUT_MIN_HEIGHT_PX,
} as const;

/**
 * Returns true when the given viewport is **at or below** the minimum design target in either
 * dimension (useful for auto-engaging compaction). Stricter callers can require both dimensions.
 */
export function isAtOrBelowLayoutMinimumViewport(width: number, height: number): boolean {
  return width <= TABLE_LAYOUT_MIN_WIDTH_PX || height <= TABLE_LAYOUT_MIN_HEIGHT_PX;
}

/**
 * Returns true when the viewport is **strictly inside** the minimum box (both dimensions at or
 * below floor) — for “smallest tier” behaviors.
 */
export function isInsideMinimumLayoutBox(width: number, height: number): boolean {
  return width <= TABLE_LAYOUT_MIN_WIDTH_PX && height <= TABLE_LAYOUT_MIN_HEIGHT_PX;
}
