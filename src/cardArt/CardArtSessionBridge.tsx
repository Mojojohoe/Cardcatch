import React, { useEffect, useMemo, useRef } from 'react';
import type { RoomData } from '../types';
import type { GameService } from '../services/gameService';
import { CardArtContext, mergeCardArtWithRoom, useCardArt } from './cardArtContext';
import { buildCardArtSessionPayload } from './syncPayload';

type Props = {
  room: RoomData;
  myUid: string;
  serviceRef: React.MutableRefObject<GameService>;
  children: React.ReactNode;
};

/**
 * **Dev only:** pushes Card Creator + localStorage onto `room.cardArtSession` so a second dev browser matches the host.
 * Production: no-op wrapper — all clients use the same shipped static pack from the site bundle.
 */
export const CardArtSessionBridge: React.FC<Props> = ({ room, myUid, serviceRef, children }) => {
  if (!import.meta.env.DEV) return <>{children}</>;
  const parent = useCardArt();
  const isHost = myUid === room.hostUid;
  const lastSentSig = useRef('');

  const merged = useMemo(() => mergeCardArtWithRoom(parent, room, isHost), [parent, room, isHost]);

  useEffect(() => {
    if (!isHost) return;
    const t = window.setTimeout(() => {
      if (!serviceRef.current.getIsHost() || !serviceRef.current.getState()) return;
      const payload = buildCardArtSessionPayload(parent.mode, parent.manifest, parent.defaults);
      const sig = JSON.stringify({
        mode: payload.mode,
        manifest: payload.manifest,
        defaults: payload.defaults,
      });
      if (sig === lastSentSig.current) return;
      lastSentSig.current = sig;
      serviceRef.current.publishCardArtSession(payload);
    }, 150);
    return () => window.clearTimeout(t);
  }, [isHost, parent.mode, parent.manifestVersion, parent.defaultsVersion, serviceRef]);

  return <CardArtContext.Provider value={merged}>{children}</CardArtContext.Provider>;
};
