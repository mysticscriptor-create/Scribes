export type FontFamilyKey =
  | "serif"
  | "serif-medium"
  | "serif-bold"
  | "sans"
  | "sans-medium"
  | "sans-semibold"
  | "sans-bold"
  | "mono"
  | "mono-medium";

export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  accent: string;
  border: string;
  selection: string;
  toolbar: string;
  toolbarText: string;
};

export type Theme = {
  id: string;
  name: string;
  isDark: boolean;
  builtIn: boolean;
  colors: ThemeColors;
  fontFamily: FontFamilyKey;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  paddingHorizontal: number;
  paddingVertical: number;
  maxWidth: number;
  /** URI to a local image used as the editor background (custom themes only) */
  backgroundImageUri?: string;
  /** Opacity of the background image, 0–1 */
  backgroundImageOpacity?: number;
};

export const FONT_FAMILY_MAP: Record<FontFamilyKey, string> = {
  serif: "PlayfairDisplay_400Regular",
  "serif-medium": "PlayfairDisplay_500Medium",
  "serif-bold": "PlayfairDisplay_700Bold",
  sans: "Inter_400Regular",
  "sans-medium": "Inter_500Medium",
  "sans-semibold": "Inter_600SemiBold",
  "sans-bold": "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
  "mono-medium": "JetBrainsMono_500Medium",
};

export const FONT_FAMILY_LABELS: Record<FontFamilyKey, string> = {
  serif: "Playfair Regular",
  "serif-medium": "Playfair Medium",
  "serif-bold": "Playfair Bold",
  sans: "Inter Regular",
  "sans-medium": "Inter Medium",
  "sans-semibold": "Inter SemiBold",
  "sans-bold": "Inter Bold",
  mono: "JetBrains Regular",
  "mono-medium": "JetBrains Medium",
};

/** Group label for font picker UI */
export const FONT_FAMILY_GROUPS: { label: string; keys: FontFamilyKey[] }[] = [
  { label: "Playfair Display (Serif)", keys: ["serif", "serif-medium", "serif-bold"] },
  { label: "Inter (Sans-serif)", keys: ["sans", "sans-medium", "sans-semibold", "sans-bold"] },
  { label: "JetBrains Mono", keys: ["mono", "mono-medium"] },
];

export const DEFAULT_THEMES: Theme[] = [
  {
    id: "paper",
    name: "Paper",
    isDark: false,
    builtIn: true,
    colors: {
      background: "#f5efe4",
      surface: "#ede5d4",
      text: "#2a2622",
      mutedText: "#7a6f5d",
      accent: "#a8651e",
      border: "#d8cfb9",
      selection: "#e8c89c",
      toolbar: "#ede5d4",
      toolbarText: "#2a2622",
    },
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 1.7,
    letterSpacing: 0.2,
    paragraphSpacing: 14,
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxWidth: 720,
  },
  {
    id: "midnight",
    name: "Midnight",
    isDark: true,
    builtIn: true,
    colors: {
      background: "#0f0f12",
      surface: "#16161b",
      text: "#e7e5df",
      mutedText: "#8a8a8f",
      accent: "#7aa2f7",
      border: "#26262d",
      selection: "#3d4a73",
      toolbar: "#16161b",
      toolbarText: "#e7e5df",
    },
    fontFamily: "sans",
    fontSize: 17,
    lineHeight: 1.65,
    letterSpacing: 0,
    paragraphSpacing: 12,
    paddingHorizontal: 22,
    paddingVertical: 18,
    maxWidth: 720,
  },
  {
    id: "sepia",
    name: "Sepia",
    isDark: false,
    builtIn: true,
    colors: {
      background: "#efe2c6",
      surface: "#e6d6b3",
      text: "#3b2e1c",
      mutedText: "#8a7551",
      accent: "#9c5a16",
      border: "#cfbc94",
      selection: "#d4b881",
      toolbar: "#e6d6b3",
      toolbarText: "#3b2e1c",
    },
    fontFamily: "serif",
    fontSize: 19,
    lineHeight: 1.75,
    letterSpacing: 0.3,
    paragraphSpacing: 16,
    paddingHorizontal: 28,
    paddingVertical: 22,
    maxWidth: 680,
  },
  {
    id: "typewriter",
    name: "Typewriter",
    isDark: false,
    builtIn: true,
    colors: {
      background: "#fafaf7",
      surface: "#f0f0ec",
      text: "#1a1a1a",
      mutedText: "#6b6b6b",
      accent: "#1a1a1a",
      border: "#dcdcd8",
      selection: "#cfcfc8",
      toolbar: "#f0f0ec",
      toolbarText: "#1a1a1a",
    },
    fontFamily: "mono",
    fontSize: 16,
    lineHeight: 1.8,
    letterSpacing: 0,
    paragraphSpacing: 14,
    paddingHorizontal: 22,
    paddingVertical: 20,
    maxWidth: 680,
  },
  {
    id: "focus",
    name: "Focus",
    isDark: true,
    builtIn: true,
    colors: {
      background: "#1a1a1a",
      surface: "#222222",
      text: "#d4d4d4",
      mutedText: "#777777",
      accent: "#a8a8a8",
      border: "#2e2e2e",
      selection: "#3a3a3a",
      toolbar: "#222222",
      toolbarText: "#d4d4d4",
    },
    fontFamily: "mono",
    fontSize: 17,
    lineHeight: 1.7,
    letterSpacing: 0,
    paragraphSpacing: 14,
    paddingHorizontal: 26,
    paddingVertical: 22,
    maxWidth: 700,
  },
];
