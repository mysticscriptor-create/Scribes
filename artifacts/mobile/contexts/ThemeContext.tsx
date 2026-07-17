import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DEFAULT_THEMES, type Theme } from "@/constants/defaultThemes";

const STORAGE_KEY = "scribe.themes.v1";
const ACTIVE_KEY = "scribe.activeTheme.v1";

type ThemeContextValue = {
  themes: Theme[];
  activeTheme: Theme;
  setActiveTheme: (id: string) => void;
  saveTheme: (theme: Theme) => void;
  deleteTheme: (id: string) => void;
  duplicateTheme: (id: string) => Theme | null;
  resetCustomThemes: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 8);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState<string>("paper");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [savedThemes, savedActive] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(ACTIVE_KEY),
        ]);
        if (savedThemes) {
          const parsed = JSON.parse(savedThemes) as Theme[];
          setCustomThemes(parsed);
        }
        if (savedActive) setActiveId(savedActive);
      } catch (err) {
        console.warn("Failed to load themes", err);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(customThemes)).catch(
      () => {},
    );
  }, [customThemes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(ACTIVE_KEY, activeId).catch(() => {});
  }, [activeId, hydrated]);

  const themes = useMemo<Theme[]>(
    () => [...DEFAULT_THEMES, ...customThemes],
    [customThemes],
  );

  const activeTheme = useMemo<Theme>(() => {
    return themes.find((t) => t.id === activeId) ?? DEFAULT_THEMES[0]!;
  }, [themes, activeId]);

  const setActiveTheme = useCallback((id: string) => setActiveId(id), []);

  const saveTheme = useCallback((theme: Theme) => {
    if (theme.builtIn) return;
    setCustomThemes((prev) => {
      const existing = prev.findIndex((t) => t.id === theme.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = theme;
        return next;
      }
      return [...prev, theme];
    });
  }, []);

  const deleteTheme = useCallback(
    (id: string) => {
      setCustomThemes((prev) => prev.filter((t) => t.id !== id));
      if (activeId === id) setActiveId("paper");
    },
    [activeId],
  );

  const duplicateTheme = useCallback(
    (id: string): Theme | null => {
      const source = themes.find((t) => t.id === id);
      if (!source) return null;
      const copy: Theme = {
        ...source,
        id: generateId(),
        name: `${source.name} Copy`,
        builtIn: false,
      };
      setCustomThemes((prev) => [...prev, copy]);
      return copy;
    },
    [themes],
  );

  const resetCustomThemes = useCallback(() => {
    setCustomThemes([]);
    setActiveId("paper");
  }, []);

  const value = useMemo(
    () => ({
      themes,
      activeTheme,
      setActiveTheme,
      saveTheme,
      deleteTheme,
      duplicateTheme,
      resetCustomThemes,
    }),
    [
      themes,
      activeTheme,
      setActiveTheme,
      saveTheme,
      deleteTheme,
      duplicateTheme,
      resetCustomThemes,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
