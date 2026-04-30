import React from 'react';
import { Check, Copy } from 'lucide-react';

interface RoomCodeBadgeProps {
  roomId: string;
  showCopySuccess: boolean;
  onCopy: () => void;
}

export const RoomCodeBadge: React.FC<RoomCodeBadgeProps> = ({ roomId, showCopySuccess, onCopy }) => {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-bold text-emerald-500 uppercase">{roomId}</span>
        <button onClick={onCopy} className="text-emerald-700 hover:text-yellow-400">
          {showCopySuccess ? <Check className="w-2 h-2" /> : <Copy className="w-2 h-2" />}
        </button>
      </div>
    </div>
  );
};
