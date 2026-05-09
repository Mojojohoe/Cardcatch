import React from 'react';
import { motion } from 'motion/react';
import type { ResolutionEvent } from '../types';
import { CURSE_GREED } from '../curses';

export type ResolutionFx =
  | null
  | { kind: 'death_slash'; victimUid: string }
  | { kind: 'wrath_cut'; victimUid: string }
  | { kind: 'clash_shatter'; uid: string; cardId: string }
  | { kind: 'power_tear'; uid: string }
  | { kind: 'fool_swap' }
  | { kind: 'judgement_flash' }
  | { kind: 'temperance_balance' }
  | { kind: 'star_sparkle'; uid: string }
  | { kind: 'frog_curse'; uid: string }
  | { kind: 'emperor_glow'; uid: string }
  | { kind: 'strength_pulse'; uid: string }
  | { kind: 'lovers_hearts' }
  | { kind: 'chariot_zip'; uid: string }
  | { kind: 'hangman_drop'; uid: string }
  | { kind: 'empress_pull'; uid: string }
  | { kind: 'hermit_glow'; uid: string }
  | { kind: 'devil_flame'; uid: string }
  | { kind: 'justice_echo'; uid: string }
  | { kind: 'priestess_glimpse'; uid: string }
  | { kind: 'magician_steal'; uid: string }
  | { kind: 'wheel_chaos'; uid: string }
  | { kind: 'envy_lunge'; uid: string }
  | { kind: 'moon_glow'; uid: string }
  | { kind: 'gluttony_bite'; uid: string; cardId: string }
  | { kind: 'greed_coin_drain'; uid: string; pts: number };

export function deriveResolutionFx(event: ResolutionEvent, hostUid: string, guestUid: string): ResolutionFx {
  const otherUid = (uid: string) => (uid === hostUid ? guestUid : hostUid);

  if (event.type === 'GLUTTONY_DIGEST' && event.uid && event.cardId) {
    return { kind: 'gluttony_bite', uid: event.uid, cardId: event.cardId };
  }

  if (event.type === 'CLASH_DESTROYED' && event.uid && event.cardId) {
    return { kind: 'clash_shatter', uid: event.uid, cardId: event.cardId };
  }
  if (event.type === 'POWER_DESTROYED' && event.uid) {
    return { kind: 'power_tear', uid: event.uid };
  }

  if (event.type === 'POWER_TRIGGER') {
    const id = event.powerCardId;
    const uid = event.uid;
    if (id === CURSE_GREED && uid && (event.greedTaxPts ?? 0) > 0) {
      return { kind: 'greed_coin_drain', uid, pts: event.greedTaxPts! };
    }
    if (id === 13 && uid) return { kind: 'death_slash', victimUid: otherUid(uid) };
    if (id === 0) return { kind: 'fool_swap' };
    if (id === 20) return { kind: 'judgement_flash' };
    if (id === 14) return { kind: 'temperance_balance' };
    if (id === 4 && uid) return { kind: 'emperor_glow', uid };
    if (id === 8 && uid) return { kind: 'strength_pulse', uid };
    if (id === 6) return { kind: 'lovers_hearts' };
    if (id === 7 && uid) return { kind: 'chariot_zip', uid };
    if (id === 12 && uid) return { kind: 'hangman_drop', uid };
    if (id === 3 && uid) return { kind: 'empress_pull', uid };
    if (id === 9 && uid) return { kind: 'hermit_glow', uid };
    if (id === 15 && uid) return { kind: 'devil_flame', uid };
    if (id === 11 && uid) return { kind: 'justice_echo', uid };
    if (id === 2 && uid) return { kind: 'priestess_glimpse', uid };
    if (id === 1 && uid) return { kind: 'magician_steal', uid };
    if (id === 10 && uid) return { kind: 'wheel_chaos', uid };
    return null;
  }

  if (event.type === 'TRANSFORM') {
    if (event.uid && event.powerCardId === 17) return { kind: 'star_sparkle', uid: event.uid };
    if (event.uid && event.powerCardId === 18) return { kind: 'moon_glow', uid: event.uid };
    if (event.uid && (event.powerCardId === 1 || (event.cardId?.startsWith('Frogs') ?? false))) {
      return { kind: 'frog_curse', uid: event.uid };
    }
  }

  if (event.type === 'ENVY_STRIKE' && event.uid) return { kind: 'envy_lunge', uid: event.uid };

  return null;
}

export function resolutionColumnMotion(fx: ResolutionFx, uid: string) {
  if (!fx) return {};
  if (fx.kind === 'fool_swap') return { x: [0, -7, 7, -5, 5, 0], y: [0, 4, -4, 0], rotate: [0, -5, 5, 0] };
  if ((fx.kind === 'death_slash' || fx.kind === 'wrath_cut') && fx.victimUid === uid)
    return { x: [0, -9, 9, -5, 5, 0], scale: [1, 0.94, 1] };
  if (fx.kind === 'strength_pulse' && fx.uid === uid) return { scale: [1, 1.09, 1] };
  if (fx.kind === 'emperor_glow' && fx.uid === uid)
    return { scale: [1, 1.05, 1], filter: ['brightness(1)', 'brightness(1.28)', 'brightness(1)'] };
  if (fx.kind === 'chariot_zip' && fx.uid === uid) return { x: [0, -14, 6, 0], opacity: [1, 0.82, 1] };
  if (fx.kind === 'hangman_drop' && fx.uid === uid) return { y: [0, 18, 0], opacity: [1, 0.55, 1] };
  if (fx.kind === 'empress_pull' && fx.uid === uid) return { scale: [1, 1.06, 1], rotate: [0, 3, 0] };
  if (fx.kind === 'hermit_glow' && fx.uid === uid)
    return { filter: ['brightness(1)', 'brightness(1.18)', 'brightness(1)'] };
  if (fx.kind === 'devil_flame' && fx.uid === uid) return { scale: [1, 1.04, 1], rotate: [0, -2, 2, 0] };
  if (fx.kind === 'justice_echo' && fx.uid === uid) return { scale: [1, 1.06, 1] };
  if (fx.kind === 'priestess_glimpse' && fx.uid === uid) return { scale: [1, 1.04, 1] };
  if (fx.kind === 'magician_steal' && fx.uid === uid) return { rotate: [0, -4, 4, 0] };
  if (fx.kind === 'wheel_chaos' && fx.uid === uid) return { rotate: [0, -7, 7, -4, 0], x: [0, 4, -4, 0] };
  if (fx.kind === 'star_sparkle' && fx.uid === uid) return { scale: [1, 1.07, 1] };
  if (fx.kind === 'frog_curse' && fx.uid === uid) return { scale: [1, 0.96, 1] };
  if (fx.kind === 'envy_lunge' && fx.uid === uid)
    return { y: [0, -34, -8, 0], rotate: [0, -7, 2, 0], scale: [1, 1.08, 1] };
  if (fx.kind === 'moon_glow' && fx.uid === uid)
    return { scale: [1, 1.065, 1], filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1)'] };
  if (fx.kind === 'greed_coin_drain' && fx.uid === uid)
    return {
      scale: [1, 1.048, 1],
      filter: ['brightness(1)', 'brightness(1.12)', 'brightness(1)'],
    };
  return {};
}

const RESOLUTION_TEAR_LEFT_CLIP =
  'polygon(0% 0%, 53% 0%, 49% 12%, 55% 24%, 47% 38%, 56% 50%, 48% 64%, 54% 79%, 50% 100%, 0% 100%)';
const RESOLUTION_TEAR_RIGHT_CLIP =
  'polygon(47% 0%, 100% 0%, 100% 100%, 50% 100%, 54% 82%, 46% 66%, 53% 50%, 45% 34%, 51% 17%)';

export const ResolutionTearOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    key="resolution-tear"
    className="pointer-events-none absolute inset-0 z-[34]"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="absolute inset-0"
      style={{ clipPath: RESOLUTION_TEAR_LEFT_CLIP }}
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: -52, y: 72, rotate: -19, opacity: [1, 1, 0.05] }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{children}</div>
    </motion.div>
    <motion.div
      className="absolute inset-0"
      style={{ clipPath: RESOLUTION_TEAR_RIGHT_CLIP }}
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: 52, y: 72, rotate: 19, opacity: [1, 1, 0.05] }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{children}</div>
    </motion.div>
    <motion.div
      className="absolute inset-y-[10%] left-1/2 z-[36] w-[2px] -translate-x-1/2 bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.65)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.95, 0] }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  </motion.div>
);
