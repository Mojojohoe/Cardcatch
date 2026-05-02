/** Sidebar dot: emphasize upcoming ladder idx while spinning / awaiting resolve; else current ladder position. */
export function desperationSidebarHighlightLadderIdx(
  desperationTier: number,
  isSpinning: boolean,
  unresolvedResult: string | null | undefined,
): number | null {
  if (isSpinning || (unresolvedResult != null && unresolvedResult !== '')) {
    return desperationTier < 0 ? 1 : desperationTier + 1;
  }
  return desperationTier >= 0 ? desperationTier : null;
}

export function desperationLadderLabel(allTierLabels: readonly string[], ladderIdx?: number): string | null {
  if (ladderIdx == null || ladderIdx < 0 || ladderIdx >= allTierLabels.length) return null;
  return allTierLabels[ladderIdx];
}
