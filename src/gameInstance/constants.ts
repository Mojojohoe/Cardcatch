/** Amber CTA shared by table HUD actions (e.g. cash chips) and related flows. */
export const HUD_TABLE_ACTION_BTN =
  'rounded-xl border-2 border-amber-500/85 bg-amber-400/95 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow-[0_8px_26px_rgba(0,0,0,0.38)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 sm:px-8 sm:py-3 sm:text-[11px]';

/** Matches {@link CardVisual} deck-pull shorts — reward draw after bowl burns #2. */
export const SACRIFICE_BOWL_REWARD_DRAW_SFX = [
  '/assets/sounds/Card-Draw-Small-1.mp3',
  '/assets/sounds/Card-Draw-Small-2.mp3',
  '/assets/sounds/Card-Draw-Small-3.mp3',
  '/assets/sounds/Card-Draw-Small-4.mp3',
] as const;
