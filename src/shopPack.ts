/** Hand placeholder until next round resolves Cash Shop purchase (`CardPack.png` UI). */

export const SHOP_PACK_CARD_PREFIX = '__CARD_PACK__:' as const;

export function shopPackCardId(slotId: string): string {
  return `${SHOP_PACK_CARD_PREFIX}${slotId}`;
}

/** @returns inner slot id, or null if not a pack placeholder */
export function parseShopPackSlotId(cardId: string): string | null {
  if (!cardId.startsWith(SHOP_PACK_CARD_PREFIX)) return null;
  const rest = cardId.slice(SHOP_PACK_CARD_PREFIX.length);
  return rest.length > 0 ? rest : null;
}

export function isShopPackPlaceholder(cardId: string): boolean {
  return Boolean(parseShopPackSlotId(cardId));
}
