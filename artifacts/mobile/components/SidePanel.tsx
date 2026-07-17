import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { MarkdownView } from "@/components/MarkdownView";
import { useNotes, type NoteFile } from "@/contexts/NotesContext";
import { usePanels, type PinnedSlot } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

type SidePanelTab = "pinned" | "outline";

// The right "Micro" panel — quick-reference only: Pinned notes plus a
// document Outline for the note currently open in the editor. Everything
// else (files, folders, projects, vault management, settings, search) lives
// in the left "Macro" menu — see Menu.tsx / FilesTab.tsx.
export function SidePanel({
  onJumpToLine,
}: {
  onJumpToLine?: (lineIndex: number) => void;
}) {
  const { rightPanelOpen, setRightPanelOpen } = usePanels();
  const { activeTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = activeTheme.colors;
  const screenWidth = Dimensions.get("window").width;
  const panelWidth = Math.min(360, Math.max(280, screenWidth * 0.82));
  const translateX = useRef(new Animated.Value(panelWidth)).current;
  const [tab, setTab] = useState<SidePanelTab>("pinned");
  const rightPanelOpenRef = useRef(rightPanelOpen);
  rightPanelOpenRef.current = rightPanelOpen;

  // Swipe-to-close: drag the drawer itself back off-screen to the right (see
  // Menu.tsx for why an ancestor PanResponder here is safe for its own
  // ScrollView/buttons, unlike a sibling overlay).
  const closeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (!rightPanelOpenRef.current) return false;
        return (
          gesture.dx > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5
        );
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > 60 || gesture.vx > 0.5) {
          setRightPanelOpen(false);
        }
      },
    }),
  ).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: rightPanelOpen ? 0 : panelWidth,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [rightPanelOpen, translateX, panelWidth]);

  return (
    <>
      {rightPanelOpen ? (
        <Pressable
          onPress={() => setRightPanelOpen(false)}
          style={styles.scrim}
        />
      ) : null}
      <Animated.View
        pointerEvents={rightPanelOpen ? "auto" : "none"}
        {...closeResponder.panHandlers}
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: c.surface,
            borderLeftColor: c.border,
            transform: [{ translateX }],
            paddingTop: insets.top + (Platform.OS === "web" ? 8 : 0),
          },
        ]}
      >
        <View style={[styles.tabs, { borderBottomColor: c.border }]}>
          <PanelTab
            label="Pinned"
            icon="bookmark"
            active={tab === "pinned"}
            onPress={() => setTab("pinned")}
          />
          <PanelTab
            label="Outline"
            icon="align-left"
            active={tab === "outline"}
            onPress={() => setTab("outline")}
          />
          <View style={{ flex: 1 }} />
          <IconButton
            icon="x"
            size={32}
            onPress={() => setRightPanelOpen(false)}
          />
        </View>

        {tab === "pinned" ? (
          <PinnedTab />
        ) : (
          <OutlineTab
            onJumpToLine={(line) => {
              onJumpToLine?.(line);
              setRightPanelOpen(false);
            }}
          />
        )}
      </Animated.View>
    </>
  );
}

function PanelTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  active: boolean;
  onPress: () => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        {
          borderBottomColor: active ? c.accent : "transparent",
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Feather name={icon} size={14} color={active ? c.accent : c.mutedText} />
      <Text
        style={{
          color: active ? c.accent : c.mutedText,
          fontSize: 13,
          fontWeight: "600",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type Heading = { text: string; level: number; lineIndex: number };

function extractHeadings(content: string): Heading[] {
  const lines = content.split("\n");
  const headings: Heading[] = [];
  lines.forEach((line, i) => {
    const m = /^(#{1,6})\s+(.+)/.exec(line.trim());
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim(), lineIndex: i });
    }
  });
  return headings;
}

function OutlineTab({
  onJumpToLine,
}: {
  onJumpToLine: (lineIndex: number) => void;
}) {
  const { activeNote } = useNotes();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const headings = useMemo(
    () => (activeNote ? extractHeadings(activeNote.content) : []),
    [activeNote],
  );

  if (!activeNote) {
    return (
      <View style={[styles.emptySlot, { backgroundColor: c.background }]}>
        <Feather name="align-left" size={20} color={c.mutedText} />
        <Text style={[styles.emptySlotText, { color: c.mutedText }]}>
          No note open.
        </Text>
      </View>
    );
  }

  if (headings.length === 0) {
    return (
      <View style={[styles.emptySlot, { backgroundColor: c.background }]}>
        <Feather name="align-left" size={20} color={c.mutedText} />
        <Text style={[styles.emptySlotText, { color: c.mutedText }]}>
          No headings yet.{"\n"}Start a line with # to build an outline.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingVertical: 8 }}
    >
      {headings.map((h, i) => (
        <Pressable
          key={`${h.lineIndex}-${i}`}
          onPress={() => onJumpToLine(h.lineIndex)}
          style={({ pressed }) => [
            styles.outlineRow,
            {
              paddingLeft: 14 + (h.level - 1) * 14,
              backgroundColor: pressed ? c.surface : "transparent",
            },
          ]}
        >
          <Text
            style={{
              color: h.level <= 2 ? c.text : c.mutedText,
              fontSize: h.level === 1 ? 15 : 13,
              fontWeight: h.level <= 2 ? "700" : "500",
            }}
            numberOfLines={1}
          >
            {h.text}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function PinnedTab() {
  const { pinned, setPinned } = usePanels();
  const { notes, setActiveNote } = useNotes();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  const top = pinned.find((p) => p.slot === "top");
  const bottom = pinned.find((p) => p.slot === "bottom");
  const topNote = top ? notes.find((n) => n.id === top.noteId) : null;
  const bottomNote = bottom ? notes.find((n) => n.id === bottom.noteId) : null;

  return (
    <View style={{ flex: 1 }}>
      <PinnedSlotView
        slot="top"
        note={topNote ?? null}
        onUnpin={() => setPinned("top", null)}
        onPick={(id) => setPinned("top", id)}
        onOpenInEditor={(id) => setActiveNote(id)}
      />
      <View style={{ height: 1, backgroundColor: c.border }} />
      <PinnedSlotView
        slot="bottom"
        note={bottomNote ?? null}
        onUnpin={() => setPinned("bottom", null)}
        onPick={(id) => setPinned("bottom", id)}
        onOpenInEditor={(id) => setActiveNote(id)}
      />
    </View>
  );
}

function PinnedSlotView({
  slot,
  note,
  onUnpin,
  onPick,
  onOpenInEditor,
}: {
  slot: PinnedSlot;
  note: NoteFile | null;
  onUnpin: () => void;
  onPick: (noteId: string) => void;
  onOpenInEditor: (id: string) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!note) {
    return (
      <View style={[styles.emptySlot, { backgroundColor: c.background }]}>
        <Feather name="bookmark" size={20} color={c.mutedText} />
        <Text style={[styles.emptySlotText, { color: c.mutedText }]}>
          No note pinned to {slot}.
        </Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.pickBtn, { borderColor: c.accent }]}
        >
          <Feather name="plus" size={13} color={c.accent} />
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: "600" }}>
            Pick a note to pin
          </Text>
        </Pressable>
        <NotePickerModal
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(id) => {
            onPick(id);
            setPickerOpen(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.pinnedHeader, { borderBottomColor: c.border }]}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Feather name="bookmark" size={12} color={c.accent} />
          <Text
            style={{ color: c.text, fontSize: 13, fontWeight: "600" }}
            numberOfLines={1}
          >
            {note.name}
          </Text>
        </View>
        <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
          <Feather name="repeat" size={14} color={c.mutedText} />
        </Pressable>
        <Pressable onPress={() => onOpenInEditor(note.id)} hitSlop={8}>
          <Feather name="edit-2" size={14} color={c.mutedText} />
        </Pressable>
        <Pressable onPress={onUnpin} hitSlop={8}>
          <Feather name="x" size={14} color={c.mutedText} />
        </Pressable>
      </View>
      <MarkdownView
        source={note.content}
        theme={{
          ...activeTheme,
          fontSize: Math.max(13, activeTheme.fontSize - 3),
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      />
      <NotePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => {
          onPick(id);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

// Lets the user add/replace a pinned slot directly from the right panel via a
// "+" button, instead of requiring a long-press in the (now left-side) file
// tree — addresses the request for a direct pin affordance in the Micro panel.
function NotePickerModal({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (noteId: string) => void;
}) {
  const { notes } = useNotes();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const sorted = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.actionBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.pickerSheet,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.actionTitle, { color: c.text }]}>
            Pin a note
          </Text>
          <ScrollView style={{ maxHeight: 340 }}>
            {sorted.length === 0 ? (
              <Text
                style={{
                  color: c.mutedText,
                  fontSize: 13,
                  padding: 16,
                }}
              >
                No notes yet.
              </Text>
            ) : (
              sorted.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => onPick(n.id)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    { backgroundColor: pressed ? c.background : "transparent" },
                  ]}
                >
                  <Feather name="file-text" size={14} color={c.mutedText} />
                  <Text
                    style={{ color: c.text, fontSize: 14, flex: 1 }}
                    numberOfLines={1}
                  >
                    {n.name}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: -4, height: 0 },
    shadowRadius: 16,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  outlineRow: {
    paddingVertical: 10,
    paddingRight: 14,
  },
  emptySlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  emptySlotText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pinnedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.7,
  },
  pickerSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
