import type { CSSProperties } from 'react';

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
}

export function ornatePurpleFrameStyle(compact = false): CSSProperties {
  return {
    color: '#f8fafc',
    background: 'conic-gradient(#1b2f4a 0 0), #4c1d95',
    backgroundClip: 'padding-box, border-box',
    border: compact ? '4px double #7f5a0d' : '6px double #7f5a0d',
    borderImageSource: `url("${assetUrl('assets/images/border.png')}")`,
    borderImageSlice: '120 100 140 fill',
    borderImageRepeat: 'repeat stretch',
    borderImageWidth: compact ? '88px 72px 96px' : '120px 100px 140px',
    borderImageOutset: compact ? '18px 16px 24px 14px' : '36px 30px 58px 28px',
    borderRadius: compact ? '24px' : '44px',
  };
}

export function ornateGreenFrameStyle(compact = false): CSSProperties {
  return {
    color: '#ecfdf5',
    background: 'conic-gradient(#11372c 0 0), #064e3b',
    backgroundClip: 'padding-box, border-box',
    border: compact ? '3px double #8f6b21' : '4px double #8f6b21',
    borderImageSource: `url("${assetUrl('assets/images/border-gold.png')}")`,
    borderImageSlice: '120 100 140 fill',
    borderImageRepeat: 'repeat stretch',
    borderImageWidth: compact ? '58px 52px 66px' : '72px 62px 82px',
    borderImageOutset: compact ? '10px 8px 14px 8px' : '14px 12px 18px 10px',
    borderRadius: compact ? '16px' : '22px',
  };
}

