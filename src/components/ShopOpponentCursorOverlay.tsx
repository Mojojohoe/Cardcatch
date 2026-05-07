import type { PlayerRole } from '../types';
import { cardArtAssetUrl } from '../cardArt/paths';
import { useEffect, useRef, useState } from 'react';

function gloveForRole(role: PlayerRole): string {
  switch (role) {
    case 'Predator':
      return cardArtAssetUrl('GloveRed.png');
    case 'Prey':
      return cardArtAssetUrl('GloveBlue.png');
    case 'Preydator':
      return cardArtAssetUrl('GlovePurple.png');
    default:
      return cardArtAssetUrl('GloveBlue.png');
  }
}

type Props = {
  nx: number;
  ny: number;
  opponentRole: PlayerRole;
  visible: boolean;
};

/** Full-viewport overlay: opponent’s shop pointer in normalized coords (matches sender’s visual viewport). */
export function ShopOpponentCursorOverlay({ nx, ny, opponentRole, visible }: Props) {
  const [smoothed, setSmoothed] = useState({ x: nx, y: ny });
  const targetRef = useRef({ x: nx, y: ny });

  useEffect(() => {
    targetRef.current = { x: nx, y: ny };
  }, [nx, ny]);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const tick = () => {
      setSmoothed((prev) => {
        const tx = targetRef.current.x;
        const ty = targetRef.current.y;
        const nxL = prev.x + (tx - prev.x) * 0.24;
        const nyL = prev.y + (ty - prev.y) * 0.24;
        return { x: nxL, y: nyL };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;
  const src = gloveForRole(opponentRole);
  return (
    <div className="pointer-events-none fixed inset-0 z-[540]" aria-hidden>
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute h-14 w-14 max-h-[min(14rem,22vw)] max-w-[min(14rem,22vw)] select-none object-contain sm:h-16 sm:w-16"
        style={{
          left: `${smoothed.x * 100}%`,
          top: `${smoothed.y * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}
