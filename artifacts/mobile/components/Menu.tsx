import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilesTab } from "@/components/FilesTab";
import { IconButton } from "@/components/IconButton";
import { useNotes } from "@/contexts/NotesContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countWords, readingTimeMinutes } from "@/lib/markdown";

type MenuView = "main" | "files";

// The left "Macro" panel — vault & project management, folders, file tree,
// and global search all live here, alongside app-level navigation
// (Settings, Characters & Locations, Guide, About). The right "Micro" panel
// (SidePanel.tsx) is reserved for Pinned + Outline only.
export function Menu({ onOpenNote }: { onOpenNote: (id: string) => void }) {
  const {
    leftMenuOpen,
    setLeftMenuOpen,
    closeAllFloating,
    floatingWindows,
    setSearchOpen,
  } = usePanels();
  const { activeTheme, themes, setActiveTheme } = useTheme();
  const { activeNote, vaultName } = useNotes();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = activeTheme.colors;
  const screenWidth = Dimensions.get("window").width;
  const menuWidth = Math.min(360, Math.max(280, screenWidth * 0.84));
  const translateX = useRef(new Animated.Value(-menuWidth)).current;
  const [view, setView] = useState<MenuView>("main");
  const leftMenuOpenRef = useRef(leftMenuOpen);
  leftMenuOpenRef.current = leftMenuOpen;

  // Swipe-to-close: drag the drawer itself back off-screen to the left. This
  // lives on the drawer's own content (as an ancestor of its ScrollView and
  // buttons), which is a safe PanResponder placement -- unlike a sibling
  // overlay, an ancestor only claims the touch once it recognizes a
  // horizontal drag past the threshold, so plain taps and the internal
  // vertical ScrollView are unaffected.
  const closeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (!leftMenuOpenRef.current) return false;
        return (
          gesture.dx < -10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5
        );
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx < -60 || gesture.vx < -0.5) {
          setLeftMenuOpen(false);
        }
      },
    }),
  ).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: leftMenuOpen ? 0 : -menuWidth,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [leftMenuOpen, translateX, menuWidth]);

  useEffect(() => {
    if (!leftMenuOpen) {
      // Reset to the main view a beat after the drawer closes, so it doesn't
      // visibly flash back while sliding away.
      const t = setTimeout(() => setView("main"), 260);
      return () => clearTimeout(t);
    }
  }, [leftMenuOpen]);

  const wordCount = activeNote ? countWords(activeNote.content) : 0;
  const readMin = activeNote ? readingTimeMinutes(activeNote.content) : 0;

  return (
    <>
      {leftMenuOpen ? (
        <Pressable onPress={() => setLeftMenuOpen(false)} style={styles.scrim} />
      ) : null}
      <Animated.View
        pointerEvents={leftMenuOpen ? "auto" : "none"}
        {...closeResponder.panHandlers}
        style={[
          styles.menu,
          {
            width: menuWidth,
            backgroundColor: c.surface,
            borderRightColor: c.border,
            transform: [{ translateX }],
            paddingTop: insets.top + (Platform.OS === "web" ? 8 : 0),
          },
        ]}
      >
        {view === "files" ? (
          <View style={{ flex: 1 }}>
            <View style={[styles.filesHeader, { borderBottomColor: c.border }]}>
              <Pressable onPress={() => setView("main")} hitSlop={8}>
                <Feather name="arrow-left" size={18} color={c.text} />
              </Pressable>
              <Text style={[styles.filesHeaderTitle, { color: c.text }]}>
                Files & Projects
              </Text>
              <IconButton
                icon="x"
                size={30}
                onPress={() => setLeftMenuOpen(false)}
              />
            </View>
            <FilesTab
              onOpenNote={(id) => {
                onOpenNote(id);
                setLeftMenuOpen(false);
              }}
              onClose={() => setLeftMenuOpen(false)}
            />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={[styles.brand, { color: c.text }]}>Scribe</Text>
              <Text style={[styles.brandSub, { color: c.mutedText }]}>
                {vaultName}
              </Text>
            </View>

            {activeNote ? (
              <View
                style={[
                  styles.statsBlock,
                  { backgroundColor: c.background, borderColor: c.border },
                ]}
              >
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: c.mutedText }]}>
                    Words
                  </Text>
                  <Text style={[styles.statValue, { color: c.text }]}>
                    {wordCount}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: c.mutedText }]}>
                    Characters
                  </Text>
                  <Text style={[styles.statValue, { color: c.text }]}>
                    {activeNote.content.length}
                  </Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={[styles.statLabel, { color: c.mutedText }]}>
                    Reading
                  </Text>
                  <Text style={[styles.statValue, { color: c.text }]}>
                    {readMin} min
                  </Text>
                </View>
              </View>
            ) : null}

            <SectionLabel>Browse</SectionLabel>
            <MenuItem
              icon="folder"
              label="Files & Projects"
              onPress={() => setView("files")}
            />
            <MenuItem
              icon="search"
              label="Global search"
              onPress={() => {
                setLeftMenuOpen(false);
                setSearchOpen(true);
              }}
            />

            <SectionLabel>Quick theme</SectionLabel>
            {themes.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setActiveTheme(t.id)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? c.background : "transparent" },
                ]}
              >
                <View
                  style={[
                    styles.themeSwatch,
                    {
                      backgroundColor: t.colors.background,
                      borderColor: c.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeSwatchInner,
                      { backgroundColor: t.colors.accent },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.rowLabel,
                    {
                      color: c.text,
                      fontWeight: activeTheme.id === t.id ? "700" : "400",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {t.name}
                </Text>
                {activeTheme.id === t.id ? (
                  <Feather name="check" size={14} color={c.accent} />
                ) : null}
              </Pressable>
            ))}

            <View style={{ height: 8 }} />

            <SectionLabel>App</SectionLabel>
            <MenuItem
              icon="settings"
              label="Settings"
              onPress={() => {
                setLeftMenuOpen(false);
                router.push("/settings");
              }}
            />
            <MenuItem
              icon="users"
              label="Characters & Locations"
              onPress={() => {
                setLeftMenuOpen(false);
                router.push("/sheets");
              }}
            />
            {activeNote ? (
              <MenuItem
                icon="clock"
                label="Version history"
                onPress={() => {
                  setLeftMenuOpen(false);
                  router.push({
                    pathname: "/history",
                    params: { noteId: activeNote.id },
                  });
                }}
              />
            ) : null}
            {floatingWindows.length > 0 ? (
              <MenuItem
                icon="layers"
                label={`Close all floating (${floatingWindows.length})`}
                onPress={() => closeAllFloating()}
              />
            ) : null}
            <MenuItem
              icon="book-open"
              label="How to use Scribe"
              onPress={() => {
                setLeftMenuOpen(false);
                router.push("/guide");
              }}
            />
            <MenuItem
              icon="info"
              label="About"
              onPress={() => {
                setLeftMenuOpen(false);
                router.push("/about");
              }}
            />
          </ScrollView>
        )}
      </Animated.View>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { activeTheme } = useTheme();
  return (
    <Text style={[styles.sectionLabel, { color: activeTheme.colors.mutedText }]}>
      {children}
    </Text>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  rightLabel,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  rightLabel?: string;
  disabled?: boolean;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.background : "transparent",
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Feather name={icon} size={16} color={c.text} />
      <Text style={[styles.rowLabel, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
      {rightLabel ? (
        <Text style={{ color: c.mutedText, fontSize: 12 }}>{rightLabel}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  menu: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 4, height: 0 },
    shadowRadius: 16,
  },
  filesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filesHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  brandSub: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  statsBlock: {
    marginHorizontal: 14,
    marginVertical: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionLabel: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
  },
  themeSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  themeSwatchInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
