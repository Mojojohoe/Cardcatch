import type { PlayerRole } from '../types';
import { cardArtAssetUrl } from '../cardArt/paths';

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
  if (!visible) return null;
  const src = gloveForRole(opponentRole);
  return (
    <div className="pointer-events-none fixed inset-0 z-[190]" aria-hidden>
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute h-14 w-14 max-h-[min(14rem,22vw)] max-w-[min(14rem,22vw)] select-none object-contain transition-[left,top] duration-100 ease-out sm:h-16 sm:w-16"
        style={{
          left: `${nx * 100}%`,
          top: `${ny * 100}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}
