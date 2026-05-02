import type { Transition } from 'motion/react';

export type CardPresentationMode = 'default' | 'deckPull' | 'none';
export type DeckPullSide = 'left' | 'right';
export type PresentationPace = 'normal' | 'slow';

export type PlayingCardEntranceMotion = {
  initial?: Record<string, number>;
  animate?: Record<string, number>;
  transition?: Transition;
};

/** Shared entrance timing for playing cards (table deals, resolution pulls, default spring-in). */
export function playingCardEntranceMotion(opts: {
  noAnimate: boolean;
  presentation: CardPresentationMode;
  deckPullSide: DeckPullSide;
  presentationPace: PresentationPace;
  delay: number;
}): PlayingCardEntranceMotion {
  const { noAnimate, presentation, deckPullSide, presentationPace, delay } = opts;
  if (noAnimate || presentation === 'none') {
    return {};
  }
  if (presentation === 'deckPull') {
    const deckSlow = presentationPace === 'slow';
    return {
      initial: {
        y: deckSlow ? 168 : 130,
        opacity: 0,
        rotateX: 22,
        rotateZ: deckPullSide === 'left' ? -6 : 6,
        scale: 0.82,
      },
      animate: { y: 0, opacity: 1, rotateX: 0, rotateZ: 0, scale: 1 },
      transition: {
        duration: deckSlow ? 1.35 : 0.58,
        delay: deckSlow ? delay * 1.25 : delay,
        ease: [0.22, 1, 0.36, 1],
      },
    };
  }
  return {
    initial: { x: 300, y: -100, opacity: 0, rotate: 45, scale: 0.5 },
    animate: { x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 },
    transition: { type: 'spring', damping: 20, stiffness: 100, delay },
  };
}
