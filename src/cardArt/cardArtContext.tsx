import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CardArtDisplayMode, CardArtGlobalDefaults, CardArtManifest, CardArtOverride } from './types';
import {
  loadCardArtDefaults,
  loadCardArtManifest,
  loadDisplayMode,
  saveCardArtDefaults,
  saveCardArtManifest,
  saveDisplayMode,
} from './storage';

type Ctx = {
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

const CardArtContext = createContext<Ctx | null>(null);

export const CardArtProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<CardArtDisplayMode>(() => loadDisplayMode());
  const [manifest, setManifestState] = useState<CardArtManifest>(() => loadCardArtManifest());
  const [manifestVersion, setManifestVersion] = useState(0);
  const [defaults, setDefaultsState] = useState<CardArtGlobalDefaults>(() => loadCardArtDefaults());
  const [defaultsVersion, setDefaultsVersion] = useState(0);

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

  const setDefaults = useCallback((d: CardArtGlobalDefaults) => {
    setDefaultsState(d);
    saveCardArtDefaults(d);
    setDefaultsVersion((v) => v + 1);
  }, []);

  const updateDefaults = useCallback((patch: Partial<CardArtGlobalDefaults>) => {
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
      }) satisfies Ctx,
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

export function useCardArt(): Ctx {
  const c = useContext(CardArtContext);
  if (!c) throw new Error('useCardArt requires CardArtProvider');
  return c;
}

export function useOptionalCardArt(): Ctx | null {
  return useContext(CardArtContext);
}
