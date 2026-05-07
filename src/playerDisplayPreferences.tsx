import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'cardcatch.playerDisplay.v1';

export type PlayerDisplayPreferences = {
  highVisibilityMode: boolean;
  simpleCardFonts: boolean;
  sfxVolume: number;
};

const DEFAULT_PREFS: PlayerDisplayPreferences = {
  highVisibilityMode: false,
  simpleCardFonts: false,
  sfxVolume: 50,
};

function loadPrefs(): PlayerDisplayPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const o = JSON.parse(raw) as Partial<PlayerDisplayPreferences>;
    return {
      highVisibilityMode: Boolean(o.highVisibilityMode),
      simpleCardFonts: Boolean(o.simpleCardFonts),
      sfxVolume:
        typeof o.sfxVolume === 'number' && Number.isFinite(o.sfxVolume)
          ? Math.max(0, Math.min(100, Math.round(o.sfxVolume)))
          : 50,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(p: PlayerDisplayPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

type Ctx = PlayerDisplayPreferences & {
  setHighVisibilityMode: (v: boolean) => void;
  setSimpleCardFonts: (v: boolean) => void;
  setSfxVolume: (v: number) => void;
};

const PlayerDisplayPreferencesContext = createContext<Ctx | null>(null);

export const PlayerDisplayPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [prefs, setPrefs] = useState<PlayerDisplayPreferences>(() => loadPrefs());

  useEffect(() => {
    document.body.classList.toggle('simple-card-fonts', prefs.simpleCardFonts);
    return () => document.body.classList.remove('simple-card-fonts');
  }, [prefs.simpleCardFonts]);

  const setHighVisibilityMode = useCallback((v: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, highVisibilityMode: v };
      savePrefs(next);
      return next;
    });
  }, []);

  const setSimpleCardFonts = useCallback((v: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, simpleCardFonts: v };
      savePrefs(next);
      return next;
    });
  }, []);

  const setSfxVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setPrefs((prev) => {
      const next = { ...prev, sfxVolume: clamped };
      savePrefs(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () =>
      ({
        ...prefs,
        setHighVisibilityMode,
        setSimpleCardFonts,
        setSfxVolume,
      }) satisfies Ctx,
    [prefs, setHighVisibilityMode, setSimpleCardFonts, setSfxVolume],
  );

  return (
    <PlayerDisplayPreferencesContext.Provider value={value}>
      {children}
    </PlayerDisplayPreferencesContext.Provider>
  );
};

export function usePlayerDisplayPreferences(): Ctx {
  const c = useContext(PlayerDisplayPreferencesContext);
  if (!c) throw new Error('usePlayerDisplayPreferences requires PlayerDisplayPreferencesProvider');
  return c;
}
