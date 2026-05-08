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
const ORNATE_BUTTON_BORDER_PX = 22;

export function ornateGoldCompactButtonRasterStyle(): CSSProperties {
  const w = ORNATE_BUTTON_BORDER_PX;
  return {
    color: '#022c22',
    background: 'linear-gradient(180deg, rgba(253, 224, 71, 0.35), rgba(245, 158, 11, 0.55))',
    backgroundClip: 'padding-box',
    border: `${w}px solid transparent`,
    borderImageSource: `url("${assetUrl('assets/images/border-button.png')}")`,
    borderImageSlice: ORNATE_SLICE,
    borderImageRepeat: 'round',
    borderImageWidth: `${w}px`,
    borderImageOutset: 0,
    borderRadius: Math.round(w * 0.72),
  };
}
