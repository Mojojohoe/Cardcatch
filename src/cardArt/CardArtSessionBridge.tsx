import React, { useEffect, useMemo, useRef } from 'react';
import type { RoomData } from '../types';
import type { GameService } from '../services/gameService';
import { CardArtContext, mergeCardArtWithRoom, useCardArt } from './cardArtContext';
import { CARD_ART_TOOLS_ENABLED } from './toolsAccess';
import { buildCardArtSessionPayload } from './syncPayload';

type Props = {
  room: RoomData;
  myUid: string;
  serviceRef: React.MutableRefObject<GameService>;
  children: React.ReactNode;
};

/**
 * When {@link CARD_ART_TOOLS_ENABLED}: pushes Card Creator state onto `room.cardArtSession` for guests.
 * Otherwise a no-op wrapper (shipped pack only).
 */
export const CardArtSessionBridge: React.FC<Props> = ({ room, myUid, serviceRef, children }) => {
  if (!CARD_ART_TOOLS_ENABLED) return <>{children}</>;
  const parent = useCardArt();
  /**
   * Prefer room roster, but if `hostUid` is briefly wrong vs PeerJS id while `GameService` still knows we’re
   * hosting, treat as host — otherwise guest merge can replace local manifest with an empty `cardArtSession`.
   */
  const isHost = myUid === room.hostUid || serviceRef.current.getIsHost();
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
