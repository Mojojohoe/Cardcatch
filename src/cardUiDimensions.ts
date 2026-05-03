/**
 * Playing-card and power-card layout footprint (≈1.2× prior Tailwind sizes).
 * Centralize so hand rows, backs, and modals stay visually consistent.
 */
export const PC_HAND = 'w-[3.6rem] h-[5.4rem] sm:w-[7.2rem] sm:h-[10.8rem]';
export const PC_HAND_VEC_SM = 'w-[3rem] h-[6.6rem] sm:w-[4.2rem] sm:h-[9.9rem]';
/** Assembled raster faces: width only — height follows {@link ScaledAssembledCardFace} aspect. */
export const PC_ASM_SM = 'w-[3rem] sm:w-[4.2rem]';
export const PC_ASM_MD = 'w-[3.6rem] sm:w-[7.2rem]';
export const PC_BACK_SM = 'w-[2.7rem] h-[5.7rem] sm:w-[3.6rem] sm:h-[8.7rem]';
export const PC_BACK_MD = 'w-[3.6rem] aspect-[24/37] shrink-0 sm:w-[7.2rem]';
export const PC_FACE_MINH = 'min-h-[6.6rem] sm:min-h-[9.9rem]';
export const PC_PWR_PANEL = 'w-[8.25rem] sm:w-[9rem] min-h-[12rem] max-w-[9.6rem]';
export const PC_PWR_PANEL_BACK = 'w-[8.4rem] sm:w-[9.3rem] h-[10.8rem]';
export const PC_PWR_SM = 'w-[5.4rem] h-[8.4rem]';
export const PC_PWR_LG = 'w-[15.6rem] h-[24rem] sm:w-[19.2rem] sm:h-[28.8rem]';
export const PC_PWR_FALLBACK_SM = 'w-[4.2rem] h-[6.6rem]';
export const PC_PWR_FALLBACK_LG = 'w-[9.6rem] h-[15.6rem] sm:w-[12rem] sm:h-[19.2rem]';
