import type { ResolutionEvent } from '../types';

export function formatRoundResultEventMessage(evt: ResolutionEvent): string {
  const d = evt.tokenOverkillDetail;
  if (d && d.tokens > 0) {
    const base = evt.message?.trim() ?? '';
    return `${base} (${d.winnerVal} - ${d.loserVal} = ${d.tokens} Overkill)`;
  }
  return evt.message ?? '';
}
