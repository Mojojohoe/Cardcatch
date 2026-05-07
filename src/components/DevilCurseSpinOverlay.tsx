import React, { useEffect, useMemo, useState } from 'react';
import { ConfigurableWheel, devilCurseWheelDefinition, resolveWheelSegments } from '../wheels';
import { CURSES } from '../curses';

/** Shared Devil pact replay — same offset/curse as server outcome. */
export const DevilCurseSpinOverlay: React.FC<{
  offset: number;
  curseId: number;
}> = ({ offset, curseId }) => {
  const [spinning, setSpinning] = useState(true);
  const segments = useMemo(() => resolveWheelSegments(devilCurseWheelDefinition), []);

  useEffect(() => {
    const ms = Math.max(1200, (devilCurseWheelDefinition.spinDurationSeconds ?? 5.5) * 1000 + 180);
    const t = window.setTimeout(() => setSpinning(false), ms);
    return () => window.clearTimeout(t);
  }, []);

  const name = CURSES[curseId]?.name ?? 'Curse';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[10%] z-[320] flex flex-col items-center gap-3 px-3 sm:top-[12%]">
      <span className="max-w-[min(34rem,94vw)] text-center text-[10px] font-black uppercase tracking-[0.28em] text-orange-300/95 sm:text-[11px]">
        The Devil curses the table
      </span>
      <div className="w-[min(19rem,88vw)] max-w-full shrink-0 sm:w-[min(22rem,88vw)]">
        <ConfigurableWheel
          definition={devilCurseWheelDefinition}
          segments={segments}
          offset={offset}
          spinning={spinning}
          sizeClass="h-full w-full"
          labelSizeMultiplier={0.42}
          hubScale={1}
        />
      </div>
      {!spinning && (
        <p className="max-w-[min(36rem,94vw)] text-center text-[11px] font-black uppercase tracking-wide text-orange-100/95">
          {name} claims the board
        </p>
      )}
    </div>
  );
};
