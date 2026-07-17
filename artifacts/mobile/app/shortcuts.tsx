import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { IconButton } from "@/components/IconButton";
import {
  useShortcuts,
  type Shortcut,
  type ShortcutKind,
} from "@/contexts/ShortcutsContext";
import { useTheme } from "@/contexts/ThemeContext";

const KIND_LABELS: Record<ShortcutKind, string> = {
  insert: "Insert text",
  wrap: "Wrap selection",
  pair: "Open / Close pair",
};

const KIND_HINTS: Record<ShortcutKind, string> = {
  insert: "Inserts the payload at the cursor.",
  wrap: "Wraps the selection (or inserts the pair) — like **bold**.",
  pair: "Like wrap, but also auto-closes when you type the open char while editing.",
};

export default function ShortcutsScreen() {
  const router = useRouter();
  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, resetShortcuts } =
    useShortcuts();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [editing, setEditing] = useState<Shortcut | "new" | null>(null);

  const handleDelete = (s: Shortcut) => {
    Alert.alert("Remove shortcut", `Remove "${s.label}" from the bar?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => deleteShortcut(s.id),
      },
    ]);
  };

  const handleReset = () => {
    Alert.alert(
      "Reset shortcuts",
      "Restore the default set of shortcuts? Your custom additions will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetShortcuts },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}>
        <Text style={[styles.intro, { color: c.mutedText }]}>
          The shortcut bar appears just above the keyboard while you write. Tap
          any item to edit, or use the + button to add your own.
        </Text>

        {shortcuts.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => setEditing(s)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? c.background : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <View
              style={[
                styles.chip,
                { backgroundColor: c.background, borderColor: c.border },
              ]}
            >
              <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
                {s.label}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: "500" }}>
                {KIND_LABELS[s.kind]}
              </Text>
              <Text
                style={{ color: c.mutedText, fontSize: 12, marginTop: 2 }}
                numberOfLines={1}
              >
                {previewPayload(s)}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={() => handleDelete(s)}>
              <Feather name="trash-2" size={16} color={c.mutedText} />
            </Pressable>
          </Pressable>
        ))}

        <View style={{ height: 16 }} />
        <Pressable
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetBtn,
            { borderColor: c.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="refresh-ccw" size={14} color={c.mutedText} />
          <Text style={{ color: c.mutedText, fontSize: 13 }}>
            Reset to defaults
          </Text>
        </Pressable>
      </ScrollView>

      <View
        style={[
          styles.fab,
          { backgroundColor: c.accent, shadowColor: "#000" },
        ]}
      >
        <Pressable
          onPress={() => setEditing("new")}
          style={styles.fabInner}
          hitSlop={8}
        >
          <Feather name="plus" size={22} color={c.background} />
        </Pressable>
      </View>

      <ShortcutEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={(payload) => {
          if (editing === "new") {
            addShortcut(payload);
          } else if (editing) {
            updateShortcut(editing.id, payload);
          }
          setEditing(null);
        }}
      />
    </View>
  );
}

function previewPayload(s: Shortcut) {
  if (s.kind === "insert") {
    return `inserts: "${escapeForDisplay(s.payload)}"`;
  }
  return `open: "${escapeForDisplay(s.payload)}"  ·  close: "${escapeForDisplay(
    s.closing ?? s.payload,
  )}"`;
}

function escapeForDisplay(s: string) {
  return s.replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

function ShortcutEditor({
  editing,
  onClose,
  onSave,
}: {
  editing: Shortcut | "new" | null;
  onClose: () => void;
  onSave: (s: Omit<Shortcut, "id">) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const visible = editing !== null;
  const initial: Omit<Shortcut, "id"> =
    editing && editing !== "new"
      ? {
          label: editing.label,
          kind: editing.kind,
          payload: editing.payload,
          closing: editing.closing,
        }
      : { label: "", kind: "insert", payload: "" };
  const [draft, setDraft] = useState(initial);

  React.useEffect(() => {
    if (visible) setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleSave = () => {
    if (!draft.label.trim()) {
      Alert.alert("Label required", "Give your shortcut a short label.");
      return;
    }
    if (!draft.payload) {
      Alert.alert("Payload required", "Provide the text to insert.");
      return;
    }
    onSave({
      label: draft.label.trim(),
      kind: draft.kind,
      payload: draft.payload,
      closing: draft.kind === "insert" ? undefined : draft.closing ?? draft.payload,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: c.text }]}>
            {editing === "new" ? "New shortcut" : "Edit shortcut"}
          </Text>

          <Text style={[styles.fieldLabel, { color: c.mutedText }]}>
            Label (shown on the button)
          </Text>
          <TextInput
            value={draft.label}
            onChangeText={(v) => setDraft((d) => ({ ...d, label: v }))}
            placeholder="e.g. H1, B, ❝ ❞"
            placeholderTextColor={c.mutedText}
            style={[
              styles.input,
              { color: c.text, borderColor: c.border, backgroundColor: c.background },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: c.mutedText }]}>Type</Text>
          <View style={styles.kindRow}>
            {(Object.keys(KIND_LABELS) as ShortcutKind[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => setDraft((d) => ({ ...d, kind: k }))}
                style={[
                  styles.kindBtn,
                  {
                    borderColor: draft.kind === k ? c.accent : c.border,
                    backgroundColor:
                      draft.kind === k ? c.accent : c.background,
                  },
                ]}
              >
                <Text
                  style={{
                    color: draft.kind === k ? c.background : c.text,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {KIND_LABELS[k]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.hint, { color: c.mutedText }]}>
            {KIND_HINTS[draft.kind]}
          </Text>

          <Text style={[styles.fieldLabel, { color: c.mutedText }]}>
            {draft.kind === "insert" ? "Text to insert" : "Opening text"}
          </Text>
          <TextInput
            value={draft.payload}
            onChangeText={(v) => setDraft((d) => ({ ...d, payload: v }))}
            placeholder={draft.kind === "insert" ? "## " : "**"}
            placeholderTextColor={c.mutedText}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: c.text, borderColor: c.border, backgroundColor: c.background },
            ]}
          />

          {draft.kind !== "insert" ? (
            <>
              <Text style={[styles.fieldLabel, { color: c.mutedText }]}>
                Closing text (optional, defaults to opening)
              </Text>
              <TextInput
                value={draft.closing ?? ""}
                onChangeText={(v) => setDraft((d) => ({ ...d, closing: v }))}
                placeholder="**"
                placeholderTextColor={c.mutedText}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  { color: c.text, borderColor: c.border, backgroundColor: c.background },
                ]}
              />
            </>
          ) : null}

          <View style={styles.sheetActions}>
            <IconButton
              icon="x"
              label="Cancel"
              variant="outline"
              onPress={onClose}
            />
            <View style={{ flex: 1 }} />
            <IconButton
              icon="check"
              label="Save"
              variant="solid"
              onPress={handleSave}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    minWidth: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 6,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
  },
  input: {
    height: 40,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    fontSize: 14,
  },
  kindRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  kindBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
  },
});
