/**
 * Card Creator, Vector/Artwork toggle, localStorage manifest, and P2P `cardArtSession` sync.
 *
 * - **Dev server** (`vite`): always enabled (`import.meta.env.DEV`).
 * - **Production bundle** (e.g. `vite preview`, static hosting): off unless you set
 *   `VITE_CARD_ART_TOOLS=1` in `.env.production.local` or the shell when you need the tools.
 */
export const CARD_ART_TOOLS_ENABLED =
  import.meta.env.DEV === true || import.meta.env.VITE_CARD_ART_TOOLS === '1';
