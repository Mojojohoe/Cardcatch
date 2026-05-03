import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CardArtDisplayMode, CardArtManifest, CardArtOverride } from './types';
import { loadCardArtManifest, loadDisplayMode, saveCardArtManifest, saveDisplayMode } from './storage';

type Ctx = {
  mode: CardArtDisplayMode;
  setMode: (m: CardArtDisplayMode) => void;
  manifest: CardArtManifest;
  setManifest: (m: CardArtManifest) => void;
  updateOverride: (cardId: string, o: CardArtOverride | null) => void;
  manifestVersion: number;
  bumpManifest: () => void;
};

const CardArtContext = createContext<Ctx | null>(null);

export const CardArtProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<CardArtDisplayMode>(() => loadDisplayMode());
  const [manifest, setManifestState] = useState<CardArtManifest>(() => loadCardArtManifest());
  const [manifestVersion, setManifestVersion] = useState(0);

  const setMode = useCallback((m: CardArtDisplayMode) => {
    setModeState(m);
    saveDisplayMode(m);
  }, []);

  const setManifest = useCallback((m: CardArtManifest) => {
    setManifestState(m);
    saveCardArtManifest(m);
    setManifestVersion((v) => v + 1);
  }, []);

  const updateOverride = useCallback((cardId: string, o: CardArtOverride | null) => {
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
    setManifestState(loadCardArtManifest());
    setManifestVersion((v) => v + 1);
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
      }) satisfies Ctx,
    [mode, setMode, manifest, setManifest, updateOverride, manifestVersion, bumpManifest],
  );

  return <CardArtContext.Provider value={value}>{children}</CardArtContext.Provider>;
};

export function useCardArt(): Ctx {
  const c = useContext(CardArtContext);
  if (!c) throw new Error('useCardArt requires CardArtProvider');
  return c;
}

export function useOptionalCardArt(): Ctx | null {
  return useContext(CardArtContext);
}
