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
  };
}

/**
 * Same frame as {@link ornateGreenTooltipRasterStyle} but does not clip the sacrificial-bowl flame
 * (blend + tall fire particles). Use on the HUD bowl `HoldDelayTooltip` root only.
 */
export function ornateGreenSacrificialBowlHudWrapStyle(): CSSProperties {
  return {
    ...ornateGreenTooltipRasterStyle(),
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
