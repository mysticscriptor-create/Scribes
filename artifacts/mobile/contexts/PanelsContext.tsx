import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const PINNED_KEY = "scribe.pinned.v1";
const FLOATING_KEY = "scribe.floating.v1";
const VIEW_MODE_KEY = "scribe.viewMode.v1";
const WORD_COUNT_KEY = "scribe.showWordCount.v1";
const TYPEWRITER_KEY = "scribe.typewriterMode.v1";
const LINE_SPACING_KEY = "scribe.lineSpacing.v1";
const EDITOR_FONT_SIZE_KEY = "scribe.editorFontSize.v1";

export type LineSpacing = "compact" | "comfortable" | "spacious";
export const LINE_SPACING_MAP: Record<LineSpacing, number> = {
  compact: 1.4,
  comfortable: 1.7,
  spacious: 2.0,
};
export const DEFAULT_EDITOR_FONT_SIZE = 16;

export type FileViewMode = "tree" | "list" | "folders" | "projects";

export type PinnedSlot = "top" | "bottom";

export type PinnedItem = {
  slot: PinnedSlot;
  noteId: string;
};

export type FloatingWindow = {
  id: string;
  noteId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  collapsed: boolean;
};

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 8);

type PanelsContextValue = {
  // Side panel (right swipe)
  rightPanelOpen: boolean;
  setRightPanelOpen: (v: boolean) => void;
  toggleRightPanel: () => void;

  // Left menu
  leftMenuOpen: boolean;
  setLeftMenuOpen: (v: boolean) => void;
  toggleLeftMenu: () => void;

  // Pinned
  pinned: PinnedItem[];
  setPinned: (slot: PinnedSlot, noteId: string | null) => void;
  clearPinned: () => void;

  // Floating windows
  floatingWindows: FloatingWindow[];
  openFloating: (noteId: string) => void;
  closeFloating: (id: string) => void;
  updateFloating: (id: string, partial: Partial<FloatingWindow>) => void;
  bringToFront: (id: string) => void;
  closeAllFloating: () => void;

  // Search overlay
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;

  // File browser view mode
  viewMode: FileViewMode;
  setViewMode: (m: FileViewMode) => void;

  // Editor floating word count toggle
  showWordCount: boolean;
  setShowWordCount: (v: boolean) => void;

  // Typewriter scroll (keeps cursor line centered)
  typewriterMode: boolean;
  setTypewriterMode: (v: boolean) => void;

  // Line spacing override (compact / comfortable / spacious)
  lineSpacing: LineSpacing;
  setLineSpacing: (v: LineSpacing) => void;

  // Editor font size override (14–22 px)
  editorFontSize: number;
  setEditorFontSize: (v: number) => void;
};

const PanelsContext = createContext<PanelsContextValue | null>(null);

export function PanelsProvider({ children }: { children: React.ReactNode }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftMenuOpen, setLeftMenuOpen] = useState(false);
  const [pinned, setPinnedState] = useState<PinnedItem[]>([]);
  const [floatingWindows, setFloatingWindows] = useState<FloatingWindow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewModeState] = useState<FileViewMode>("tree");
  const [showWordCount, setShowWordCountState] = useState(true);
  const [typewriterMode, setTypewriterModeState] = useState(false);
  const [lineSpacing, setLineSpacingState] = useState<LineSpacing>("comfortable");
  const [editorFontSize, setEditorFontSizeState] = useState(DEFAULT_EDITOR_FONT_SIZE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, f, vm, wc, tw, ls, fs] = await Promise.all([
          AsyncStorage.getItem(PINNED_KEY),
          AsyncStorage.getItem(FLOATING_KEY),
          AsyncStorage.getItem(VIEW_MODE_KEY),
          AsyncStorage.getItem(WORD_COUNT_KEY),
          AsyncStorage.getItem(TYPEWRITER_KEY),
          AsyncStorage.getItem(LINE_SPACING_KEY),
          AsyncStorage.getItem(EDITOR_FONT_SIZE_KEY),
        ]);
        if (p) setPinnedState(JSON.parse(p));
        if (f) setFloatingWindows(JSON.parse(f));
        if (vm === "tree" || vm === "list" || vm === "folders" || vm === "projects")
          setViewModeState(vm);
        if (wc !== null) setShowWordCountState(wc === "1");
        if (tw !== null) setTypewriterModeState(tw === "1");
        if (ls === "compact" || ls === "comfortable" || ls === "spacious")
          setLineSpacingState(ls);
        if (fs !== null) {
          const n = Number(fs);
          if (n >= 14 && n <= 22) setEditorFontSizeState(n);
        }
      } catch (err) {
        console.warn("Failed to load panels", err);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setViewMode = useCallback((m: FileViewMode) => {
    setViewModeState(m);
    AsyncStorage.setItem(VIEW_MODE_KEY, m).catch(() => {});
  }, []);

  const setShowWordCount = useCallback((v: boolean) => {
    setShowWordCountState(v);
    AsyncStorage.setItem(WORD_COUNT_KEY, v ? "1" : "0").catch(() => {});
  }, []);

  const setTypewriterMode = useCallback((v: boolean) => {
    setTypewriterModeState(v);
    AsyncStorage.setItem(TYPEWRITER_KEY, v ? "1" : "0").catch(() => {});
  }, []);

  const setLineSpacing = useCallback((v: LineSpacing) => {
    setLineSpacingState(v);
    AsyncStorage.setItem(LINE_SPACING_KEY, v).catch(() => {});
  }, []);

  const setEditorFontSize = useCallback((v: number) => {
    setEditorFontSizeState(v);
    AsyncStorage.setItem(EDITOR_FONT_SIZE_KEY, String(v)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(PINNED_KEY, JSON.stringify(pinned)).catch(() => {});
  }, [pinned, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(FLOATING_KEY, JSON.stringify(floatingWindows)).catch(
      () => {},
    );
  }, [floatingWindows, hydrated]);

  const toggleRightPanel = useCallback(
    () => setRightPanelOpen((v) => !v),
    [],
  );
  const toggleLeftMenu = useCallback(() => setLeftMenuOpen((v) => !v), []);

  const setPinned = useCallback((slot: PinnedSlot, noteId: string | null) => {
    setPinnedState((prev) => {
      const others = prev.filter((p) => p.slot !== slot);
      if (!noteId) return others;
      return [...others, { slot, noteId }];
    });
  }, []);

  const clearPinned = useCallback(() => setPinnedState([]), []);

  const openFloating = useCallback(
    (noteId: string) => {
      setFloatingWindows((prev) => {
        // If already open, just bring to front
        const existing = prev.find((w) => w.noteId === noteId);
        if (existing) {
          const maxZ = Math.max(...prev.map((w) => w.z), 0);
          return prev.map((w) =>
            w.id === existing.id
              ? { ...w, z: maxZ + 1, collapsed: false }
              : w,
          );
        }
        const maxZ = prev.reduce((acc, w) => Math.max(acc, w.z), 0);
        const offset = prev.length * 28;
        const next: FloatingWindow = {
          id: generateId(),
          noteId,
          x: 40 + offset,
          y: 80 + offset,
          width: 320,
          height: 380,
          z: maxZ + 1,
          collapsed: false,
        };
        return [...prev, next];
      });
    },
    [],
  );

  const closeFloating = useCallback((id: string) => {
    setFloatingWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateFloating = useCallback(
    (id: string, partial: Partial<FloatingWindow>) => {
      setFloatingWindows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...partial } : w)),
      );
    },
    [],
  );

  const bringToFront = useCallback((id: string) => {
    setFloatingWindows((prev) => {
      const maxZ = Math.max(...prev.map((w) => w.z), 0);
      return prev.map((w) => (w.id === id ? { ...w, z: maxZ + 1 } : w));
    });
  }, []);

  const closeAllFloating = useCallback(() => setFloatingWindows([]), []);

  const value = useMemo(
    () => ({
      rightPanelOpen,
      setRightPanelOpen,
      toggleRightPanel,
      leftMenuOpen,
      setLeftMenuOpen,
      toggleLeftMenu,
      pinned,
      setPinned,
      clearPinned,
      floatingWindows,
      openFloating,
      closeFloating,
      updateFloating,
      bringToFront,
      closeAllFloating,
      searchOpen,
      setSearchOpen,
      viewMode,
      setViewMode,
      showWordCount,
      setShowWordCount,
      typewriterMode,
      setTypewriterMode,
      lineSpacing,
      setLineSpacing,
      editorFontSize,
      setEditorFontSize,
    }),
    [
      rightPanelOpen,
      toggleRightPanel,
      leftMenuOpen,
      toggleLeftMenu,
      pinned,
      setPinned,
      clearPinned,
      floatingWindows,
      openFloating,
      closeFloating,
      updateFloating,
      bringToFront,
      closeAllFloating,
      searchOpen,
      viewMode,
      setViewMode,
      showWordCount,
      setShowWordCount,
      typewriterMode,
      setTypewriterMode,
      lineSpacing,
      setLineSpacing,
      editorFontSize,
      setEditorFontSize,
    ],
  );

  return (
    <PanelsContext.Provider value={value}>{children}</PanelsContext.Provider>
  );
}

export function usePanels() {
  const ctx = useContext(PanelsContext);
  if (!ctx) throw new Error("usePanels must be used inside PanelsProvider");
  return ctx;
}
