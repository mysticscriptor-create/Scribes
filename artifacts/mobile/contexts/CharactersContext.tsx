import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SHEETS_KEY = "scribe.sheets.v1";

export type SheetType = "character" | "location";

export type SheetField = { label: string; value: string };

export type Sheet = {
  id: string;
  type: SheetType;
  name: string;
  summary: string;
  fields: SheetField[];
  tags?: string[];
  imageUri?: string;
  createdAt: number;
  updatedAt: number;
};

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 9);

export const CHARACTER_TEMPLATE: SheetField[] = [
  { label: "Role", value: "" },
  { label: "Age", value: "" },
  { label: "Appearance", value: "" },
  { label: "Personality", value: "" },
  { label: "Goal", value: "" },
  { label: "Backstory", value: "" },
];

export const LOCATION_TEMPLATE: SheetField[] = [
  { label: "Region", value: "" },
  { label: "Atmosphere", value: "" },
  { label: "Key details", value: "" },
  { label: "History", value: "" },
];

type CharactersContextValue = {
  sheets: Sheet[];
  createSheet: (type: SheetType, name: string) => Sheet;
  updateSheet: (id: string, partial: Partial<Sheet>) => void;
  deleteSheet: (id: string) => void;
  duplicateSheet: (id: string) => Sheet | undefined;
  getSheet: (id: string) => Sheet | undefined;
};

const CharactersContext = createContext<CharactersContextValue | null>(null);

export function CharactersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SHEETS_KEY);
        if (raw) setSheets(JSON.parse(raw));
      } catch (err) {
        console.warn("Failed to load sheets", err);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(SHEETS_KEY, JSON.stringify(sheets)).catch(() => {});
  }, [sheets, hydrated]);

  const createSheet = useCallback((type: SheetType, name: string): Sheet => {
    const sheet: Sheet = {
      id: generateId(),
      type,
      name: name || (type === "character" ? "New character" : "New location"),
      summary: "",
      fields: (type === "character" ? CHARACTER_TEMPLATE : LOCATION_TEMPLATE).map(
        (f) => ({ ...f }),
      ),
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSheets((prev) => [sheet, ...prev]);
    return sheet;
  }, []);

  const updateSheet = useCallback((id: string, partial: Partial<Sheet>) => {
    setSheets((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...partial, updatedAt: Date.now() } : s,
      ),
    );
  }, []);

  const deleteSheet = useCallback((id: string) => {
    setSheets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const duplicateSheet = useCallback(
    (id: string): Sheet | undefined => {
      setSheets((prev) => {
        const source = prev.find((s) => s.id === id);
        if (!source) return prev;
        const copy: Sheet = {
          ...source,
          id: generateId(),
          name: `${source.name} (copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return [copy, ...prev];
      });
      // return undefined; the caller can open the list fresh
      return undefined;
    },
    [],
  );

  const getSheet = useCallback(
    (id: string) => sheets.find((s) => s.id === id),
    [sheets],
  );

  const value = useMemo(
    () => ({ sheets, createSheet, updateSheet, deleteSheet, duplicateSheet, getSheet }),
    [sheets, createSheet, updateSheet, deleteSheet, duplicateSheet, getSheet],
  );

  return (
    <CharactersContext.Provider value={value}>
      {children}
    </CharactersContext.Provider>
  );
}

export function useCharacters() {
  const ctx = useContext(CharactersContext);
  if (!ctx)
    throw new Error("useCharacters must be used inside CharactersProvider");
  return ctx;
}
