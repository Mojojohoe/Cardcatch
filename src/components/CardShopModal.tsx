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
  'discount',
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
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <path fill="#ef4444" d="M255.999,512c-2.954,0-5.737-1.144-7.835-3.221l-47.332-46.876l-64.437,16.927c-0.946,0.25-1.903,0.376-2.857,0.376c-4.984,0-9.387-3.374-10.709-8.205l-17.559-64.27L41,389.171c-5.86-1.601-9.372-7.687-7.829-13.566l16.927-64.436L3.222,263.836c-4.272-4.319-4.272-11.349,0.002-15.67l46.875-47.331l-16.927-64.437c-1.544-5.878,1.969-11.964,7.829-13.566l64.27-17.559l17.56-64.27c1.32-4.828,5.728-8.201,10.717-8.201c0.952,0,1.909,0.125,2.843,0.371l64.442,16.927l47.333-46.877C250.265,1.145,253.048,0,255.999,0s5.734,1.145,7.835,3.223l47.332,46.876l64.437-16.927c0.939-0.247,1.9-0.372,2.854-0.372c4.99,0,9.394,3.371,10.711,8.199l17.56,64.272l64.27,17.56c5.86,1.601,9.372,7.687,7.829,13.566l-16.927,64.436l46.877,47.333c4.272,4.319,4.272,11.349-0.002,15.67L461.9,311.168l16.927,64.437c1.544,5.878-1.969,11.964-7.829,13.566l-64.27,17.56l-17.56,64.27c-1.318,4.832-5.719,8.205-10.703,8.205c-0.955,0-1.916-0.126-2.854-0.374l-64.445-16.928l-47.333,46.877C261.736,510.857,258.953,512,255.999,512z"/>
      <path fill="#b91c1c" d="M461.902,200.834l16.927-64.436c1.544-5.879-1.969-11.965-7.829-13.566l-64.27-17.56L389.169,41c-1.317-4.827-5.721-8.199-10.711-8.199c-0.954,0-1.914,0.125-2.854,0.372L311.167,50.1L263.835,3.223C261.735,1.145,259.34,0,256.001,0v512c3.339,0,5.736-1.144,7.834-3.221l47.333-46.877l64.445,16.928c0.939,0.248,1.899,0.374,2.854,0.374c4.984,0,9.385-3.374,10.703-8.205l17.56-64.27l64.27-17.56c5.86-1.601,9.372-7.687,7.829-13.566l-16.927-64.437l46.875-47.331c4.274-4.321,4.274-11.352,0.002-15.67L461.902,200.834z"/>
      <text x="256" y="230" textAnchor="middle" fill="#fff" fontSize="96" fontWeight="900" fontFamily="system-ui, sans-serif">25%</text>
      <text x="256" y="300" textAnchor="middle" fill="#fff" fontSize="66" fontWeight="900" fontFamily="system-ui, sans-serif">OFF</text>
    </svg>
  );
}

const ShopTile: React.FC<{
  slotId: string;
  slot: CardShopSlot;
  tokenBalance: number;
  onBuy: (id: string) => void;
  compact?: boolean;
  purchaseMode: 'black_friday' | 'coin_flip';
  pendingPurchases?: PendingCardShopPurchase[] | null;
  myUid: string;
}> = ({
  slotId,
  slot,
  tokenBalance,
  onBuy,
  compact,
  purchaseMode,
  pendingPurchases,
  myUid,
}) => {
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
      className={`relative flex flex-col items-center gap-2 rounded-2xl border border-slate-700/80 ${slotId === 'discount' ? 'bg-violet-950/85' : 'bg-slate-950/90'} p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)] ${
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
      {slotId === 'discount' ? (
        <DiscountSticker className="pointer-events-none absolute -right-2 -top-2 z-[30] h-10 w-10 drop-shadow-[0_8px_20px_rgba(239,68,68,0.45)]" />
      ) : null}
      {hover && interactive ? (
        <p
          className={`pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 ${EMERALD_STRIP_TOOLTIP_PANEL}`}
        >
          {buyHelp}
        </p>
      ) : null}
    </div>
  );
};

export const CardShopModal: React.FC<{
  cardShop: CardShopState;
  tokenBalance: number;
  onBuy: (slotId: string) => void;
  onClose: () => void;
  purchaseMode: 'black_friday' | 'coin_flip';
  pendingPurchases?: PendingCardShopPurchase[] | null;
  myUid: string;
}> = ({ cardShop, tokenBalance, onBuy, onClose, purchaseMode, pendingPurchases, myUid }) => {
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

      </footer>
    </div>
  );
};
