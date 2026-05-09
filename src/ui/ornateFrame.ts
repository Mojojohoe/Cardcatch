import type { CSSProperties } from 'react';

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

/** 9-slice source regions — must match the shipped border PNG artwork. */
const ORNATE_SLICE = '120 100 140 fill';

/** Drawn border thickness for `border-image` (larger = visibly heavier gold frame in raster HUD). */
const ORNATE_GOLD_BORDER_PX = 32;
const ORNATE_PURPLE_BORDER_PX = 36;

/**
 * Golden tooltip / popup frame for **raster (art) mode only**.
 * Uses `round` tiling so tall/wide panels keep corner scale consistent; middles repeat instead of stretching.
 */
/** Soft shadow follows the ornate border silhouette (works with `border-image`); avoid `box-shadow` on the rectangular box. */
const ORNATE_TOOLTIP_DROP_SHADOW =
  'drop-shadow(0 14px 32px rgba(0, 0, 0, 0.55)) drop-shadow(0 4px 14px rgba(0, 0, 0, 0.38))';

export function ornateGreenTooltipRasterStyle(): CSSProperties {
  const w = ORNATE_GOLD_BORDER_PX;
  return {
    color: '#ecfdf5',
    /** Border PNG includes interior fill — avoid double green panel behind it. */
    background: 'transparent',
    backgroundClip: 'padding-box',
    border: `${w}px solid transparent`,
    borderImageSource: `url("${assetUrl('assets/images/border-gold.png')}")`,
    borderImageSlice: ORNATE_SLICE,
    borderImageRepeat: 'round',
    borderImageWidth: `${w}px`,
    borderImageOutset: 0,
    borderRadius: Math.round(w * 0.85),
    filter: ORNATE_TOOLTIP_DROP_SHADOW,
    WebkitFilter: ORNATE_TOOLTIP_DROP_SHADOW,
    willChange: 'filter',
  };
}

/**
 * Same frame as {@link ornateGreenTooltipRasterStyle} but does not clip the sacrificial-bowl flame
 * (blend + tall fire particles). Use on the HUD bowl `HoldDelayTooltip` root only.
 */
export function ornateGreenSacrificialBowlHudWrapStyle(): CSSProperties {
  return {
    ...ornateGreenTooltipRasterStyle(),
    filter: 'none',
    WebkitFilter: 'none',
    overflow: 'visible',
    padding: 0,
    isolation: 'auto',
  };
}

/**
 * Purple panel frame (desperation HUD, wheel shell) for **raster mode only**.
 */
export function ornatePurplePanelRasterStyle(): CSSProperties {
  const w = ORNATE_PURPLE_BORDER_PX;
  return {
    color: '#f8fafc',
    background: '#1a1030',
    backgroundClip: 'padding-box',
    border: `${w}px solid transparent`,
    borderImageSource: `url("${assetUrl('assets/images/border.png')}")`,
    borderImageSlice: ORNATE_SLICE,
    borderImageRepeat: 'round',
    borderImageWidth: `${w}px`,
    borderImageOutset: 0,
    borderRadius: Math.round(w * 0.82),
  };
}

/** Tighter gold frame for primary HUD action buttons (`border-button.png`) in raster mode. */
const ORNATE_BUTTON_BORDER_PX = 16;

export type OrnateHudButtonTone = 'amber' | 'slate';

/**
 * Dock actions (Play / Cash Chips): opaque fill so the PNG frame reads solid; tone tints the raster border via filter.
 */
export function ornateGoldCompactButtonRasterStyle(tone: OrnateHudButtonTone = 'amber'): CSSProperties {
  const w = ORNATE_BUTTON_BORDER_PX;
  const amberFill = 'linear-gradient(180deg, #fde047 0%, #f59e0b 52%, #d97706 100%)';
  const slateFill = 'linear-gradient(180deg, #475569 0%, #334155 48%, #1e293b 100%)';
  const borderTint =
    tone === 'slate'
      ? 'hue-rotate(195deg) saturate(0.55) brightness(0.92) contrast(1.05)'
      : 'none';
  return {
    color: tone === 'amber' ? '#022c22' : '#e2e8f0',
    background: tone === 'amber' ? amberFill : slateFill,
    backgroundClip: 'padding-box',
    border: `${w}px solid transparent`,
    borderImageSource: `url("${assetUrl('assets/images/border-button.png')}")`,
    borderImageSlice: ORNATE_SLICE,
    /** `stretch` keeps left/right edge tiles visible on wide labels; corners still slice cleanly. */
    borderImageRepeat: 'stretch',
    borderImageWidth: `${w}px`,
    borderImageOutset: 0,
    borderRadius: Math.round(w * 0.85),
    filter: borderTint,
    WebkitFilter: borderTint,
  };
}
