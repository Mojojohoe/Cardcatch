import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { RoomData } from '../types';
import type { CardArtDisplayMode, CardArtGlobalDefaults, CardArtManifest, CardArtOverride } from './types';
import {
  loadCardArtDefaults,
  loadCardArtManifest,
  loadDisplayMode,
  saveCardArtDefaults,
  saveCardArtManifest,
  saveDisplayMode,
} from './storage';
import { SHIPPED_CARD_ART_DEFAULTS, SHIPPED_CARD_ART_MANIFEST, SHIPPED_CARD_ART_MODE } from './shippedPack';
import { CARD_ART_TOOLS_ENABLED } from './toolsAccess';

export type CardArtCtx = {
  mode: CardArtDisplayMode;
  setMode: (m: CardArtDisplayMode) => void;
  manifest: CardArtManifest;
  setManifest: (m: CardArtManifest) => void;
  updateOverride: (cardId: string, o: CardArtOverride | null) => void;
  manifestVersion: number;
  bumpManifest: () => void;
  defaults: CardArtGlobalDefaults;
  setDefaults: (d: CardArtGlobalDefaults) => void;
  updateDefaults: (patch: Partial<CardArtGlobalDefaults>) => void;
  defaultsVersion: number;
};

/**
 * When {@link CARD_ART_TOOLS_ENABLED}: merge host `cardArtSession` so a guest browser picks up Card Creator
 * without the host’s localStorage. Otherwise returns `parent` (shipped pack / no P2P art sync).
 */
export function mergeCardArtWithRoom(parent: CardArtCtx, room: RoomData, isHost: boolean): CardArtCtx {
  if (!CARD_ART_TOOLS_ENABLED) return parent;
  const s = room.cardArtSession;
  if (!isHost && s) {
    return {
      ...parent,
      mode: s.mode,
      manifest: s.manifest,
      defaults: s.defaults,
      manifestVersion: s.seq,
      defaultsVersion: s.seq,
    };
  }
  return parent;
}

export const CardArtContext = createContext<CardArtCtx | null>(null);

export const CardArtProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<CardArtDisplayMode>(() =>
    CARD_ART_TOOLS_ENABLED ? loadDisplayMode() : SHIPPED_CARD_ART_MODE,
  );
  const [manifest, setManifestState] = useState<CardArtManifest>(() =>
    CARD_ART_TOOLS_ENABLED
      ? { ...SHIPPED_CARD_ART_MANIFEST, ...loadCardArtManifest() }
      : { ...SHIPPED_CARD_ART_MANIFEST },
  );
  const [manifestVersion, setManifestVersion] = useState(0);
  const [defaults, setDefaultsState] = useState<CardArtGlobalDefaults>(() =>
    CARD_ART_TOOLS_ENABLED
      ? { ...SHIPPED_CARD_ART_DEFAULTS, ...loadCardArtDefaults() }
      : { ...SHIPPED_CARD_ART_DEFAULTS },
  );
  const [defaultsVersion, setDefaultsVersion] = useState(0);

  const setMode = useCallback((m: CardArtDisplayMode) => {
    if (!CARD_ART_TOOLS_ENABLED) return;
    setModeState(m);
    saveDisplayMode(m);
  }, []);

  const setManifest = useCallback((m: CardArtManifest) => {
    if (!CARD_ART_TOOLS_ENABLED) return;
    setManifestState(m);
    saveCardArtManifest(m);
    setManifestVersion((v) => v + 1);
  }, []);

  const updateOverride = useCallback((cardId: string, o: CardArtOverride | null) => {
    if (!CARD_ART_TOOLS_ENABLED) return;
    setManifestState((prev) => {
      const next = { ...prev };
      if (o == null) delete next[cardId];
      else next[cardId] = o;
      saveCardArtManifest(next);
      setManifestVersion((v) => v + 1);
      return next;
    });
  }, []);

  const bumpManifest = useCallback(() => {
    if (CARD_ART_TOOLS_ENABLED) {
      setManifestState({ ...SHIPPED_CARD_ART_MANIFEST, ...loadCardArtManifest() });
    } else {
      setManifestState({ ...SHIPPED_CARD_ART_MANIFEST });
    }
    setManifestVersion((v) => v + 1);
  }, []);

  const setDefaults = useCallback((d: CardArtGlobalDefaults) => {
    if (!CARD_ART_TOOLS_ENABLED) return;
    setDefaultsState(d);
    saveCardArtDefaults(d);
    setDefaultsVersion((v) => v + 1);
  }, []);

  const updateDefaults = useCallback((patch: Partial<CardArtGlobalDefaults>) => {
    if (!CARD_ART_TOOLS_ENABLED) return;
    setDefaultsState((prev) => {
      const next = { ...prev, ...patch };
      saveCardArtDefaults(next);
      setDefaultsVersion((v) => v + 1);
      return next;
    });
  }, []);

  const value = useMemo(
    () =>
      ({
        mode,
        setMode,
        manifest,
        setManifest,
        updateOverride,
        manifestVersion,
        bumpManifest,
        defaults,
        setDefaults,
        updateDefaults,
        defaultsVersion,
      }) satisfies CardArtCtx,
    [
      mode,
      setMode,
      manifest,
      setManifest,
      updateOverride,
      manifestVersion,
      bumpManifest,
      defaults,
      setDefaults,
      updateDefaults,
      defaultsVersion,
    ],
  );

  return <CardArtContext.Provider value={value}>{children}</CardArtContext.Provider>;
};

export function useCardArt(): CardArtCtx {
  const c = useContext(CardArtContext);
  if (!c) throw new Error('useCardArt requires CardArtProvider');
  return c;
}

export function useOptionalCardArt(): CardArtCtx | null {
  return useContext(CardArtContext);
}
