import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotes, type NoteFile } from "@/contexts/NotesContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

type Match = {
  note: NoteFile;
  inName: boolean;
  contentHits: number;
  snippet: string;
};

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSnippet(content: string, query: string, caseSens: boolean): string {
  if (!query) return "";
  const flags = caseSens ? "" : "i";
  const re = new RegExp(escapeRe(query), flags);
  const m = re.exec(content);
  if (!m) return "";
  const idx = m.index;
  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + query.length + 60);
  let s = content.slice(start, end).replace(/\n/g, " ");
  if (start > 0) s = "…" + s;
  if (end < content.length) s = s + "…";
  return s;
}

function countHits(text: string, query: string, caseSens: boolean, whole: boolean) {
  if (!query) return 0;
  let pattern = escapeRe(query);
  if (whole) pattern = `\\b${pattern}\\b`;
  const flags = "g" + (caseSens ? "" : "i");
  try {
    const re = new RegExp(pattern, flags);
    return (text.match(re) ?? []).length;
  } catch {
    return 0;
  }
}

export function SearchOverlay() {
  const { searchOpen, setSearchOpen, setRightPanelOpen } = usePanels();
  const { notes, setActiveNote, externalRoot, ensureLoaded } = useNotes();
  const { activeTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = activeTheme.colors;

  const [query, setQuery] = useState("");
  const [searchNames, setSearchNames] = useState(true);
  const [searchContent, setSearchContent] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  // When opening, kick off lazy load of all external file contents
  useEffect(() => {
    if (!searchOpen || !externalRoot || !searchContent) return;
    const unloaded = notes.filter((n) => n.externalUri && !n.loaded);
    if (unloaded.length === 0) return;
    setContentLoading(true);
    let cancelled = false;
    (async () => {
      // Load in batches of 8 to be gentle
      for (let i = 0; i < unloaded.length; i += 8) {
        if (cancelled) return;
        await Promise.all(unloaded.slice(i, i + 8).map((n) => ensureLoaded(n.id)));
      }
      if (!cancelled) setContentLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchOpen, externalRoot, searchContent, notes, ensureLoaded]);

  const matches: Match[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim();
    const flags = caseSensitive ? "" : "i";
    const namePattern = wholeWord
      ? new RegExp(`\\b${escapeRe(q)}\\b`, flags)
      : new RegExp(escapeRe(q), flags);
    const out: Match[] = [];
    for (const n of notes) {
      const inName = searchNames && namePattern.test(n.name);
      const hits = searchContent ? countHits(n.content || "", q, caseSensitive, wholeWord) : 0;
      if (inName || hits > 0) {
        out.push({
          note: n,
          inName,
          contentHits: hits,
          snippet: hits > 0 ? buildSnippet(n.content, q, caseSensitive) : "",
        });
      }
    }
    out.sort((a, b) => {
      if (a.inName !== b.inName) return a.inName ? -1 : 1;
      return b.contentHits - a.contentHits;
    });
    return out.slice(0, 100);
  }, [query, notes, searchNames, searchContent, caseSensitive, wholeWord]);

  const close = () => setSearchOpen(false);
  const openMatch = (id: string) => {
    setActiveNote(id);
    setSearchOpen(false);
    setRightPanelOpen(false);
  };

  return (
    <Modal
      visible={searchOpen}
      onRequestClose={close}
      animationType="fade"
      transparent
    >
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + (Platform.OS === "web" ? 12 : 0) },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              marginTop: insets.top + 16,
            },
          ]}
        >
          <View style={[styles.searchRow, { borderBottomColor: c.border }]}>
            <Feather name="search" size={18} color={c.mutedText} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search notes…"
              placeholderTextColor={c.mutedText}
              autoFocus
              style={[styles.input, { color: c.text }]}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Feather name="x-circle" size={16} color={c.mutedText} />
              </Pressable>
            ) : null}
            <Pressable onPress={close} hitSlop={10}>
              <Feather name="x" size={20} color={c.text} />
            </Pressable>
          </View>

          <View
            style={[styles.optionsRow, { borderBottomColor: c.border }]}
          >
            <ToggleChip
              label="Names"
              active={searchNames}
              onPress={() => setSearchNames((v) => !v)}
            />
            <ToggleChip
              label="Content"
              active={searchContent}
              onPress={() => setSearchContent((v) => !v)}
            />
            <ToggleChip
              label="Aa"
              active={caseSensitive}
              onPress={() => setCaseSensitive((v) => !v)}
              accessibilityLabel="Match case"
            />
            <ToggleChip
              label="Word"
              active={wholeWord}
              onPress={() => setWholeWord((v) => !v)}
              accessibilityLabel="Whole word"
            />
          </View>

          {contentLoading && externalRoot && searchContent ? (
            <View style={[styles.loadingRow, { borderBottomColor: c.border }]}>
              <Feather name="loader" size={12} color={c.mutedText} />
              <Text style={{ color: c.mutedText, fontSize: 11 }}>
                Loading file contents from your phone for full-text search…
              </Text>
            </View>
          ) : null}

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {!query.trim() ? (
              <View style={styles.empty}>
                <Feather name="search" size={26} color={c.mutedText} />
                <Text style={[styles.emptyText, { color: c.mutedText }]}>
                  Type to search across all notes
                </Text>
                <Text style={[styles.emptyHint, { color: c.mutedText }]}>
                  Toggle names, content, case sensitivity, or whole-word match.
                </Text>
              </View>
            ) : matches.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: c.mutedText }]}>
                  No matches
                </Text>
              </View>
            ) : (
              matches.map((m) => (
                <Pressable
                  key={m.note.id}
                  onPress={() => openMatch(m.note.id)}
                  style={({ pressed }) => [
                    styles.result,
                    {
                      backgroundColor: pressed ? c.background : "transparent",
                      borderBottomColor: c.border,
                    },
                  ]}
                >
                  <View style={styles.resultHead}>
                    <Feather name="file-text" size={14} color={c.mutedText} />
                    <Text
                      style={[styles.resultName, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {m.note.name}
                    </Text>
                    {m.contentHits > 0 ? (
                      <Text style={[styles.hitBadge, { color: c.accent }]}>
                        {m.contentHits}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.resultPath, { color: c.mutedText }]}
                    numberOfLines={1}
                  >
                    {m.note.folderPath === "/"
                      ? "Root"
                      : m.note.folderPath}{" "}
                    · .{m.note.ext}
                  </Text>
                  {m.snippet ? (
                    <Text
                      style={[styles.resultSnippet, { color: c.text }]}
                      numberOfLines={2}
                    >
                      {m.snippet}
                    </Text>
                  ) : null}
                </Pressable>
              ))
            )}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.accent : pressed ? c.background : "transparent",
          borderColor: active ? c.accent : c.border,
        },
      ]}
    >
      <Text
        style={{
          color: active ? c.toolbar : c.text,
          fontSize: 12,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// Suppress unused-import warning when Switch isn't used; keep import for future toggles.
void Switch;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
  },
  sheet: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    marginBottom: 24,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyHint: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  result: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  resultPath: {
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  resultSnippet: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  hitBadge: {
    fontSize: 12,
    fontWeight: "700",
  },
});
