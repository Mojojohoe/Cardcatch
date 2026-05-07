import React, { useState } from 'react';
import type { CardShopSlot, CardShopState } from '../types';
import { baseOfferPrice, slotChargeTokens } from '../cardShop';
import { CardVisual, PowerCardVisual } from './GameVisuals';
import { EMERALD_STRIP_TOOLTIP_PANEL } from '../ui/emeraldTooltipClasses';

const SHOP_PURCHASE_HOVER =
  'Click to purchase this card and add it to your hand immediately.';

const MAIN_GRID_IDS = [
  'curse_random',
  'pow_a',
  'pow_b',
  'joker',
  'ace_Hearts',
  'ace_Diamonds',
  'ace_Clubs',
  'ace_Spades',
  'two_Hearts',
  'two_Diamonds',
  'two_Clubs',
  'two_Spades',
] as const;

function OfferFace({
  slot,
  compact,
}: {
  slot: CardShopSlot;
  compact?: boolean;
}) {
  const { offer } = slot;
  if (offer.type === 'curse') {
    return <PowerCardVisual cardId={offer.curseId} matchHandCard={!compact} small={Boolean(compact)} revealed />;
  }
  if (offer.type === 'major') {
    return <PowerCardVisual cardId={offer.powerId} matchHandCard={!compact} small={Boolean(compact)} revealed />;
  }
  return (
    <CardVisual
      card={offer.cardId}
      revealed
      small={Boolean(compact)}
      presentation="none"
      motionLayout={false}
      noAnimate
    />
  );
}

function SoldOutBand() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-[inherit]">
      <div className="absolute left-[-25%] top-1/2 w-[150%] -translate-y-1/2 rotate-[-24deg] bg-red-600/92 py-2 text-center text-[11px] font-black uppercase tracking-[0.35em] text-white shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
        Sold out
      </div>
    </div>
  );
}

function DiscountSticker({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="shop-disc-stripe" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="116" height="40" rx="8" fill="url(#shop-disc-stripe)" stroke="#7f1d1d" strokeWidth="2" />
      <text
        x="60"
        y="22"
        textAnchor="middle"
        fill="white"
        fontSize="14"
        fontWeight="900"
        fontFamily="system-ui, sans-serif"
      >
        25% OFF
      </text>
      <text
        x="60"
        y="38"
        textAnchor="middle"
        fill="rgba(255,255,255,0.92)"
        fontSize="9"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        TODAY
      </text>
    </svg>
  );
}

function ShopTile({
  slotId,
  slot,
  tokenBalance,
  onBuy,
  compact,
}: {
  slotId: string;
  slot: CardShopSlot;
  tokenBalance: number;
  onBuy: (id: string) => void;
  compact?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const price = slotChargeTokens(slot);
  const base = baseOfferPrice(slot.offer);
  const discounted = Boolean(slot.discountPercent && slot.discountPercent > 0);
  const canAfford = tokenBalance >= price && !slot.soldOut;
  const interactive = canAfford;

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/90 p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)] ${
        slot.soldOut || !canAfford ? 'opacity-[0.42] saturate-[0.35]' : ''
      } ${interactive ? 'transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(250,204,21,0.12)] hover:ring-2 hover:ring-amber-400/45' : ''}`}
      onMouseEnter={() => {
        if (interactive) setHover(true);
      }}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        disabled={!interactive}
        onClick={() => interactive && onBuy(slotId)}
        className={`relative flex flex-col items-center gap-1 outline-none ${interactive ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      >
        <div className="relative">
          <OfferFace slot={slot} compact={compact} />
          {slot.soldOut ? <SoldOutBand /> : null}
        </div>
        <div className="text-center font-mono text-[11px] font-bold tabular-nums text-amber-100/95">
          {discounted ? (
            <>
              <span className="mr-1 text-slate-500 line-through">{base}</span>
              <span>{price}</span>
            </>
          ) : (
            price
          )}{' '}
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">tokens</span>
        </div>
      </button>
      {hover && interactive ? (
        <p
          className={`pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 ${EMERALD_STRIP_TOOLTIP_PANEL}`}
        >
          {SHOP_PURCHASE_HOVER}
        </p>
      ) : null}
    </div>
  );
}

function DiscountOfferBlock({
  discountSlot,
  tokenBalance,
  onBuy,
}: {
  discountSlot: CardShopSlot;
  tokenBalance: number;
  onBuy: () => void;
}) {
  const [hover, setHover] = useState(false);
  const price = slotChargeTokens(discountSlot);
  const affordable = !discountSlot.soldOut && tokenBalance >= price;

  return (
    <div className="flex max-w-full flex-1 flex-wrap items-end gap-4 sm:flex-nowrap">
      <div className="relative">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-rose-300/95">Round special — 25% off</p>
        <div
          className={`relative inline-block origin-bottom-left rotate-[-8deg] ${
            discountSlot.soldOut || tokenBalance < price ? 'opacity-[0.42] saturate-[0.35]' : ''
          }`}
        >
          <DiscountSticker className="pointer-events-none absolute -right-2 -top-3 z-10 h-12 w-28 -rotate-12 drop-shadow-lg sm:h-14 sm:w-32" />
          <div className="relative rounded-xl border border-rose-900/60 bg-black/30 p-2 shadow-xl">
            <button
              type="button"
              disabled={discountSlot.soldOut || tokenBalance < price}
              onClick={() => {
                if (!(discountSlot.soldOut || tokenBalance < price)) onBuy();
              }}
              className={`relative outline-none ${
                discountSlot.soldOut || tokenBalance < price
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer transition-transform hover:scale-[1.02]'
              }`}
              onMouseEnter={() => {
                if (!(discountSlot.soldOut || tokenBalance < price)) setHover(true);
              }}
              onMouseLeave={() => setHover(false)}
            >
              <OfferFace slot={discountSlot} compact />
              {discountSlot.soldOut ? <SoldOutBand /> : null}
            </button>
            <div className="mt-2 text-center font-mono text-[11px] font-bold tabular-nums text-rose-100">
              <span className="mr-1 text-slate-500 line-through">{baseOfferPrice(discountSlot.offer)}</span>
              <span>{price}</span>{' '}
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">tokens</span>
            </div>
          </div>
        </div>
        {hover && affordable ? (
          <p
            className={`pointer-events-none absolute bottom-full left-0 z-30 mb-2 max-w-[min(20rem,calc(100vw-2rem))] ${EMERALD_STRIP_TOOLTIP_PANEL}`}
          >
            {SHOP_PURCHASE_HOVER}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const CardShopModal: React.FC<{
  cardShop: CardShopState;
  tokenBalance: number;
  onBuy: (slotId: string) => void;
  onClose: () => void;
}> = ({ cardShop, tokenBalance, onBuy, onClose }) => {
  const discountSlot = cardShop.slots.discount;

  return (
    <div
      className="fixed inset-0 z-[520] flex flex-col bg-emerald-950/[0.97] backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Cash Chips card shop"
    >
      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-32 pt-6 sm:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center font-black uppercase tracking-[0.28em] text-amber-300/95 sm:text-lg">
            Cash Chips — Card Shop
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[11px] font-semibold text-slate-400">
            Token balance: <span className="font-mono tabular-nums text-amber-100">{tokenBalance}</span>
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {MAIN_GRID_IDS.map((id) => {
              const slot = cardShop.slots[id];
              if (!slot) return null;
              return <ShopTile key={id} slotId={id} slot={slot} tokenBalance={tokenBalance} onBuy={onBuy} />;
            })}
          </div>
        </div>
      </div>

      <footer className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[521] flex flex-wrap items-end gap-6 border-t border-slate-800/90 bg-slate-950/95 px-4 py-5 sm:px-8">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-600 bg-slate-900 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-slate-100 shadow-lg transition-colors hover:bg-slate-800"
        >
          Close
        </button>

        {discountSlot ? (
          <DiscountOfferBlock discountSlot={discountSlot} tokenBalance={tokenBalance} onBuy={() => onBuy('discount')} />
        ) : null}
      </footer>
    </div>
  );
};
