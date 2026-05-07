import React, { useState } from 'react';
import type { CardShopSlot, CardShopState, PendingCardShopPurchase } from '../types';
import { baseOfferPrice, slotChargeTokens } from '../cardShop';
import { CardVisual, PowerCardVisual } from './GameVisuals';
import { EMERALD_STRIP_TOOLTIP_PANEL } from '../ui/emeraldTooltipClasses';

const SHOP_HELP_BLACK_FRIDAY =
  'Click to buy — first player to pay takes the shelf immediately (classic race).';
const SHOP_HELP_COIN_FLIP =
  'Reserve with tokens. You get a pack in hand until the trick ends. If you both grabbed the same shelf, a coin flip next round decides who keeps it — the other seat is refunded.';

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
  purchaseMode,
  pendingPurchases,
  myUid,
}: {
  slotId: string;
  slot: CardShopSlot;
  tokenBalance: number;
  onBuy: (id: string) => void;
  compact?: boolean;
  purchaseMode: 'black_friday' | 'coin_flip';
  pendingPurchases?: PendingCardShopPurchase[] | null;
  myUid: string;
}) {
  const [hover, setHover] = useState(false);
  const price = slotChargeTokens(slot);
  const base = baseOfferPrice(slot.offer);
  const discounted = Boolean(slot.discountPercent && slot.discountPercent > 0);
  const canAfford = tokenBalance >= price && !slot.soldOut;
  const interactive = canAfford;
  const pendingMine =
    purchaseMode === 'coin_flip' &&
    Boolean(pendingPurchases?.some((p) => p.uid === myUid && p.slotId === slotId));
  const buyHelp = purchaseMode === 'black_friday' ? SHOP_HELP_BLACK_FRIDAY : SHOP_HELP_COIN_FLIP;

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
          {pendingMine ? (
            <div className="pointer-events-none absolute inset-0 z-[25] flex flex-col items-center justify-center gap-2 rounded-xl bg-black/60 px-2 backdrop-blur-[2px]">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-200"
                aria-hidden
              />
              <span className="text-center text-[10px] font-black uppercase leading-tight tracking-wide text-amber-100 drop-shadow-md">
                Purchase pending
              </span>
            </div>
          ) : null}
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
          {buyHelp}
        </p>
      ) : null}
    </div>
  );
}

function DiscountOfferBlock({
  discountSlot,
  tokenBalance,
  onBuy,
  purchaseMode,
  pendingPurchases,
  myUid,
}: {
  discountSlot: CardShopSlot;
  tokenBalance: number;
  onBuy: () => void;
  purchaseMode: 'black_friday' | 'coin_flip';
  pendingPurchases?: PendingCardShopPurchase[] | null;
  myUid: string;
}) {
  const [hover, setHover] = useState(false);
  const price = slotChargeTokens(discountSlot);
  const affordable = !discountSlot.soldOut && tokenBalance >= price;
  const pendingMine =
    purchaseMode === 'coin_flip' &&
    Boolean(pendingPurchases?.some((p) => p.uid === myUid && p.slotId === 'discount'));
  const buyHelp = purchaseMode === 'black_friday' ? SHOP_HELP_BLACK_FRIDAY : SHOP_HELP_COIN_FLIP;

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
              <div className="relative">
                <OfferFace slot={discountSlot} compact />
                {discountSlot.soldOut ? <SoldOutBand /> : null}
                {pendingMine ? (
                  <div className="pointer-events-none absolute inset-0 z-[25] flex flex-col items-center justify-center gap-2 rounded-lg bg-black/60 px-1 backdrop-blur-[2px]">
                    <div
                      className="h-7 w-7 animate-spin rounded-full border-2 border-rose-400/40 border-t-rose-100"
                      aria-hidden
                    />
                    <span className="text-center text-[9px] font-black uppercase leading-tight text-rose-50">
                      Purchase pending
                    </span>
                  </div>
                ) : null}
              </div>
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
            {buyHelp}
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
  purchaseMode: 'black_friday' | 'coin_flip';
  pendingPurchases?: PendingCardShopPurchase[] | null;
  myUid: string;
}> = ({ cardShop, tokenBalance, onBuy, onClose, purchaseMode, pendingPurchases, myUid }) => {
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
              return (
                <ShopTile
                  key={id}
                  slotId={id}
                  slot={slot}
                  tokenBalance={tokenBalance}
                  onBuy={onBuy}
                  purchaseMode={purchaseMode}
                  pendingPurchases={pendingPurchases}
                  myUid={myUid}
                />
              );
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
          <DiscountOfferBlock
            discountSlot={discountSlot}
            tokenBalance={tokenBalance}
            onBuy={() => onBuy('discount')}
            purchaseMode={purchaseMode}
            pendingPurchases={pendingPurchases}
            myUid={myUid}
          />
        ) : null}
      </footer>
    </div>
  );
};
