import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "scribe.shortcuts.v1";

export type ShortcutKind = "insert" | "wrap" | "pair";

export type Shortcut = {
  id: string;
  label: string;
  kind: ShortcutKind;
  payload: string;
  closing?: string;
};

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 8);

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "tab", label: "Tab", kind: "insert", payload: "    " },
  { id: "h1", label: "H1", kind: "insert", payload: "# " },
  { id: "h2", label: "H2", kind: "insert", payload: "## " },
  { id: "bold", label: "B", kind: "wrap", payload: "**", closing: "**" },
  { id: "italic", label: "I", kind: "wrap", payload: "*", closing: "*" },
  { id: "code", label: "‹›", kind: "wrap", payload: "`", closing: "`" },
  { id: "quote", label: "❝ ❞", kind: "pair", payload: "\u201c", closing: "\u201d" },
  { id: "smartquote", label: "\u2018 \u2019", kind: "pair", payload: "\u2018", closing: "\u2019" },
  { id: "paren", label: "( )", kind: "pair", payload: "(", closing: ")" },
  { id: "bracket", label: "[ ]", kind: "pair", payload: "[", closing: "]" },
  { id: "brace", label: "{ }", kind: "pair", payload: "{", closing: "}" },
  { id: "blockquote", label: "Quote", kind: "insert", payload: "\n> " },
  { id: "list", label: "•", kind: "insert", payload: "\n- " },
  { id: "hr", label: "—", kind: "insert", payload: "\n\n---\n\n" },
  { id: "emdash", label: "—", kind: "insert", payload: " — " },
  { id: "ellipsis", label: "…", kind: "insert", payload: "…" },
];

type ShortcutsContextValue = {
  shortcuts: Shortcut[];
  addShortcut: (s: Omit<Shortcut, "id">) => Shortcut;
  updateShortcut: (id: string, s: Omit<Shortcut, "id">) => void;
  deleteShortcut: (id: string) => void;
  reorderShortcuts: (ids: string[]) => void;
  resetShortcuts: () => void;
};

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setShortcuts(JSON.parse(saved));
        }
      } catch (err) {
        console.warn("Failed to load shortcuts", err);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts)).catch(
      () => {},
    );
  }, [shortcuts, hydrated]);

  const addShortcut = useCallback((s: Omit<Shortcut, "id">) => {
    const created: Shortcut = { ...s, id: generateId() };
    setShortcuts((prev) => [...prev, created]);
    return created;
  }, []);

  const updateShortcut = useCallback(
    (id: string, s: Omit<Shortcut, "id">) => {
      setShortcuts((prev) =>
        prev.map((sc) => (sc.id === id ? { ...s, id } : sc)),
      );
    },
    [],
  );

  const deleteShortcut = useCallback((id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const reorderShortcuts = useCallback((ids: string[]) => {
    setShortcuts((prev) => {
      const map = new Map(prev.map((s) => [s.id, s] as const));
      const reordered = ids
        .map((id) => map.get(id))
        .filter((s): s is Shortcut => Boolean(s));
      const remaining = prev.filter((s) => !ids.includes(s.id));
      return [...reordered, ...remaining];
    });
  }, []);

  const resetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
  }, []);

  const value = useMemo(
    () => ({
      shortcuts,
      addShortcut,
      updateShortcut,
      deleteShortcut,
      reorderShortcuts,
      resetShortcuts,
    }),
    [
      shortcuts,
      addShortcut,
      updateShortcut,
      deleteShortcut,
      reorderShortcuts,
      resetShortcuts,
    ],
  );

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts() {
  const ctx = useContext(ShortcutsContext);
  if (!ctx)
    throw new Error("useShortcuts must be used inside ShortcutsProvider");
  return ctx;
}
