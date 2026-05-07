import type { CSSProperties } from 'react';

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

/** 9-slice source regions — must match the shipped border PNG artwork. */
const ORNATE_SLICE = '120 100 140 fill';

/**
 * Golden tooltip / popup frame for **raster (art) mode only**.
 * Uses `round` tiling so tall/wide panels keep corner scale consistent; middles repeat instead of stretching.
 */
export function ornateGreenTooltipRasterStyle(): CSSProperties {
  const w = 18;
  return {
    color: '#ecfdf5',
    background: '#081210',
    backgroundClip: 'padding-box',
    border: `${w}px solid transparent`,
    borderImageSource: `url("${assetUrl('assets/images/border-gold.png')}")`,
    borderImageSlice: ORNATE_SLICE,
    borderImageRepeat: 'round',
    borderImageWidth: `${w}px`,
    borderImageOutset: 0,
    borderRadius: 18,
  };
}

/**
 * Purple panel frame (desperation HUD, wheel shell) for **raster mode only**.
 */
export function ornatePurplePanelRasterStyle(): CSSProperties {
  const w = 20;
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
    borderRadius: 22,
  };
}
