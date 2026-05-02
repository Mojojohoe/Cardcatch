import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, MessageCircle, SendHorizonal } from 'lucide-react';
import type { ChatMessageEntry, RoomData } from '../types';
import type { GameService } from '../services/gameService';

export const RoomChat: React.FC<{
  room: RoomData;
  myUid: string;
  serviceRef: React.MutableRefObject<GameService>;
}> = ({ room, myUid, serviceRef }) => {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const messages = room.chatMessages ?? [];

  useEffect(() => {
    if (!expanded) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [expanded, messages.length]);

  const send = async () => {
    if (!draft.trim()) return;
    await serviceRef.current.sendChat(draft);
    setDraft('');
  };

  return (
    <div
      className={`
        fixed z-[130] flex flex-col items-end gap-2
        bottom-[max(0.75rem,env(safe-area-inset-bottom))]
        right-[max(0.75rem,env(safe-area-inset-right))]
        pointer-events-none
      `}
    >
      {!expanded ? (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-xl border-2 border-emerald-700/85 bg-emerald-950/95 px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-100 shadow-[0_8px_32px_rgba(0,0,0,0.45)] hover:border-yellow-400/60 hover:bg-emerald-900/98"
        >
          <MessageCircle className="h-4 w-4 text-yellow-400" />
          Chat
        </button>
      ) : (
        <div
          aria-label="Room chat"
          className="
            pointer-events-auto flex flex-col overflow-hidden rounded-2xl border-2 border-emerald-700/85
            bg-emerald-950/97 shadow-[0_14px_50px_rgba(0,0,0,0.55)] backdrop-blur-sm
            w-[min(18rem,calc(100vw-10rem))] sm:w-[min(19rem,calc(100vw-14rem))]
            max-h-[min(32vh,11.5rem)] sm:max-h-[min(30vh,12.5rem)]
          "
        >
          <button
            type="button"
            aria-expanded={true}
            onClick={() => setExpanded(false)}
            className="flex w-full shrink-0 items-center justify-between border-b border-emerald-800/75 bg-emerald-900/85 px-3 py-2 text-left hover:bg-emerald-900"
          >
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-100">
              <MessageCircle className="h-4 w-4 shrink-0 text-yellow-400" />
              Messages
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-emerald-300" />
          </button>

          <div
            ref={listRef}
            className="custom-scrollbar min-h-[5.75rem] max-h-[calc(min(28vh,9.5rem)-0px)] shrink overflow-y-auto overscroll-contain px-2.5 py-2"
          >
            {messages.length === 0 ? (
              <p className="py-3 text-center text-[9px] font-bold uppercase tracking-wide text-emerald-600">
                Say something — opponent sees it instantly
              </p>
            ) : (
              messages.map((m: ChatMessageEntry, i: number) => (
                <p
                  key={`${m.at}-${i}-${m.uid}`}
                  className={`pb-2 text-[11px] leading-snug tracking-tight last:pb-1 ${
                    m.uid === myUid ? 'text-amber-100/95' : 'text-slate-200'
                  }`}
                >
                  <span className="font-black uppercase tracking-wide text-yellow-400/95">{m.name}:</span>{' '}
                  <span className="break-words">{m.text}</span>
                </p>
              ))
            )}
          </div>

          <div className="flex shrink-0 gap-2 border-t border-emerald-800/80 bg-emerald-950/95 p-2">
            <input
              type="text"
              value={draft}
              maxLength={280}
              autoComplete="off"
              aria-label="Message"
              placeholder="Message…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="min-h-[2.375rem] min-w-0 flex-1 rounded-lg border border-emerald-800/70 bg-black/35 px-2.5 text-[11px] text-emerald-50 placeholder:text-emerald-700 focus:border-yellow-400/65 focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim()}
              className="flex h-[2.375rem] shrink-0 items-center justify-center rounded-lg border border-yellow-500/50 bg-yellow-400/15 px-2.5 text-yellow-300 hover:bg-yellow-400/25 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Send message"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
