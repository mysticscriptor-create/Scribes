import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { NoteFile } from "@/contexts/NotesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { exportNote, type ExportFormat } from "@/lib/export";

const FORMATS: { id: ExportFormat; label: string; icon: React.ComponentProps<typeof Feather>["name"]; desc: string }[] = [
  { id: "txt", label: "Plain text", icon: "file-text", desc: ".txt" },
  { id: "md", label: "Markdown", icon: "hash", desc: ".md" },
  { id: "html", label: "HTML", icon: "code", desc: ".html" },
  { id: "pdf", label: "PDF", icon: "file", desc: ".pdf, print-ready" },
  { id: "epub", label: "EPUB", icon: "book-open", desc: ".epub, e-readers" },
  { id: "docx", label: "Word document", icon: "file-plus", desc: ".docx" },
];

export function ExportSheet({
  visible,
  note,
  onClose,
}: {
  visible: boolean;
  note: NoteFile | null;
  onClose: () => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const doExport = async (format: ExportFormat) => {
    if (!note) return;
    setBusy(format);
    try {
      await exportNote(note, format);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Export failed",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setBusy(null);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: c.text }]}>Export "{note?.name}"</Text>
          {FORMATS.map((f) => (
            <Pressable
              key={f.id}
              disabled={busy !== null}
              onPress={() => doExport(f.id)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: pressed ? c.background : "transparent" },
              ]}
            >
              <Feather name={f.icon} size={18} color={c.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: c.text }]}>{f.label}</Text>
                <Text style={[styles.rowDesc, { color: c.mutedText }]}>{f.desc}</Text>
              </View>
              {busy === f.id ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    paddingBottom: 34,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  rowDesc: {
    fontSize: 11,
    marginTop: 1,
  },
});
