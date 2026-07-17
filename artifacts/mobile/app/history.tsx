import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";

import { useNotes } from "@/contexts/NotesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getSnapshots, type Snapshot } from "@/lib/history";
import { countWords } from "@/lib/markdown";

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diffMin = Math.round((now - ts) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h ago`;
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryScreen() {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const { activeNoteId, activeNote, updateNoteContent } = useNotes();
  const router = useRouter();
  const params = useLocalSearchParams<{ noteId?: string }>();
  const noteId = params.noteId ?? activeNoteId ?? "";
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [preview, setPreview] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!noteId) return;
    getSnapshots(noteId).then((s) => setSnapshots(s.slice().reverse()));
  }, [noteId]);

  const restore = (snap: Snapshot) => {
    Alert.alert(
      "Restore this version?",
      "The current note content will be permanently replaced with this older version. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore version",
          style: "destructive",
          onPress: () => {
            if (!noteId) return;
            updateNoteContent(noteId, snap.content);
            router.back();
          },
        },
      ],
    );
  };

  if (preview) {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <View style={[styles.previewHeader, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Pressable onPress={() => setPreview(null)} hitSlop={8} style={styles.previewBack}>
            <Feather name="arrow-left" size={20} color={c.text} />
            <Text style={[styles.previewBackLabel, { color: c.text }]}>History</Text>
          </Pressable>
          <Text style={[styles.previewTitle, { color: c.mutedText }]}>
            Snapshot · {formatWhen(preview.savedAt)}
          </Text>
          <Pressable
            onPress={() => restore(preview)}
            hitSlop={8}
            style={[styles.restoreBtn, { backgroundColor: c.accent }]}
          >
            <Feather name="rotate-ccw" size={14} color={c.toolbar} />
            <Text style={[styles.restoreBtnLabel, { color: c.toolbar }]}>Restore</Text>
          </Pressable>
        </View>
        {/* Muted banner to make it clear this is historical content */}
        <View style={[styles.previewBanner, { backgroundColor: c.accent + "18", borderColor: c.accent + "44" }]}>
          <Feather name="clock" size={13} color={c.accent} />
          <Text style={[styles.previewBannerText, { color: c.accent }]}>
            You are previewing an older version. Tap "Restore this version" below to apply it.
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Historical text is rendered at slightly reduced opacity to signal it's not the live note */}
          <Text style={{ color: c.text, fontSize: 14, lineHeight: 21, opacity: 0.72 }}>
            {preview.content}
          </Text>
        </ScrollView>
        {/* Prominent restore action at the bottom of the preview */}
        <View style={[styles.previewFooter, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Pressable
            onPress={() => restore(preview)}
            style={[styles.restoreFullBtn, { backgroundColor: c.accent }]}
          >
            <Feather name="rotate-ccw" size={16} color={c.toolbar} />
            <Text style={[styles.restoreFullBtnLabel, { color: c.toolbar }]}>
              Restore this version — replaces current note
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {snapshots.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="clock" size={30} color={c.mutedText} />
          <Text style={[styles.emptyText, { color: c.mutedText }]}>
            No saved versions yet for "{activeNote?.name ?? "this note"}".
            Scribe automatically checkpoints your writing every few minutes as
            you edit.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
          <Text style={[styles.listHint, { color: c.mutedText }]}>
            Tap a snapshot to preview it. The latest version is highlighted.
          </Text>
          {snapshots.map((s, i) => {
            const isLatest = i === 0;
            return (
              <Pressable
                key={s.savedAt}
                onPress={() => setPreview(s)}
                style={[
                  styles.card,
                  {
                    backgroundColor: isLatest ? c.surface : c.background,
                    borderColor: isLatest ? c.accent + "88" : c.border,
                    opacity: isLatest ? 1 : 0.62,
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  <View style={styles.cardRowLeft}>
                    {isLatest ? (
                      <View style={[styles.latestDot, { backgroundColor: c.accent }]} />
                    ) : null}
                    <Text
                      style={[
                        styles.cardWhen,
                        { color: isLatest ? c.text : c.mutedText, fontWeight: isLatest ? "700" : "500" },
                      ]}
                    >
                      {formatWhen(s.savedAt)}
                    </Text>
                  </View>
                  {isLatest ? (
                    <View style={[styles.latestBadge, { backgroundColor: c.accent + "22", borderColor: c.accent + "55" }]}>
                      <Text style={[styles.latestBadgeText, { color: c.accent }]}>
                        Latest
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.cardWords, { color: c.mutedText }]}>
                  {countWords(s.content).toLocaleString()} words
                </Text>
                <Text
                  style={[styles.cardSnippet, { color: c.mutedText }]}
                  numberOfLines={2}
                >
                  {s.content.slice(0, 140)}
                </Text>
                {/* Explicit restore button on every card */}
                <View style={{ marginTop: 10 }}>
                  <Pressable
                    onPress={() => restore(s)}
                    style={({ pressed }) => [
                      styles.cardRestoreBtn,
                      {
                        backgroundColor: isLatest
                          ? c.accent + "18"
                          : pressed
                            ? c.border
                            : "transparent",
                        borderColor: isLatest ? c.accent + "55" : c.border,
                      },
                    ]}
                  >
                    <Feather
                      name="rotate-ccw"
                      size={13}
                      color={isLatest ? c.accent : c.mutedText}
                    />
                    <Text
                      style={[
                        styles.cardRestoreBtnLabel,
                        { color: isLatest ? c.accent : c.mutedText },
                      ]}
                    >
                      Restore this version
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 30,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  listHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  latestDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardWhen: {
    fontSize: 14,
  },
  latestBadge: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  latestBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardWords: {
    fontSize: 11,
  },
  cardSnippet: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  cardRestoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardRestoreBtnLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Preview screen
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  previewBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewBackLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    textAlign: "center",
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  restoreBtnLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  previewFooter: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  restoreFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  restoreFullBtnLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
});
