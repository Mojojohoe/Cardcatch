import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePowerTooltipPosition } from '../hooks/usePowerTooltipPosition';
import { useOptionalCardArt } from '../cardArt/cardArtContext';
import { ornateGreenTooltipRasterStyle } from '../ui/ornateFrame';

const HOVER_HOLD_MS = 700;

/** Matches hand “hold caption” tooltips: dark slate panel, yellow border. */
export const HUD_HOLD_TOOLTIP_PANEL_CLASS =
  'max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-yellow-500/40 bg-slate-950/98 px-3 py-2.5 text-left text-[11px] font-semibold leading-snug text-slate-100 shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-md sm:max-w-sm sm:text-[12px]';

/** Raster / art mode: ornate border only — no flat border or fill (see {@link ornateGreenTooltipRasterStyle}). */
export const HUD_HOLD_TOOLTIP_RASTER_PANEL_CLASS =
  'max-w-[min(20rem,calc(100vw-2rem))] px-[1.45rem] pb-[1.15rem] pt-[1.05rem] text-left text-[11px] font-semibold leading-snug text-slate-100 shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-md sm:max-w-sm sm:text-[12px]';

/** Same palette for instant hover panels (e.g. panic dice) so they match hold hints. */
export const HUD_INSTANT_TOOLTIP_PANEL_CLASS = HUD_HOLD_TOOLTIP_PANEL_CLASS;

type Props = {
  caption: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Context help that appears after ~700ms hover (same cadence as playing-card hold captions).
 */
export const HoldDelayTooltip: React.FC<Props> = ({ caption, children, className = '', style }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const tooltipStyle = usePowerTooltipPosition(open, rootRef, popRef);
  const cardArt = useOptionalCardArt();
  const ornateRaster = Boolean(cardArt?.mode === 'raster');

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const queueOpen = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), HOVER_HOLD_MS);
  };

  const clearOpen = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      style={style}
      className={`isolate outline-none ${className}`}
      onMouseEnter={queueOpen}
      onMouseLeave={clearOpen}
    >
      {children}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popRef}
              style={ornateRaster ? { ...tooltipStyle, ...ornateGreenTooltipRasterStyle() } : tooltipStyle}
              className={ornateRaster ? HUD_HOLD_TOOLTIP_RASTER_PANEL_CLASS : HUD_HOLD_TOOLTIP_PANEL_CLASS}
            >
              {caption}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};
