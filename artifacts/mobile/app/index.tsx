import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Editor, type EditorHandle } from "@/components/Editor";
import { EdgeSwipeArea } from "@/components/EdgeSwipeArea";
import { ExportSheet } from "@/components/ExportSheet";
import { FloatingWindowsLayer } from "@/components/FloatingWindow";
import { IconButton } from "@/components/IconButton";
import { Menu } from "@/components/Menu";
import { SearchOverlay } from "@/components/SearchOverlay";
import { ShortcutBar } from "@/components/ShortcutBar";
import { SidePanel } from "@/components/SidePanel";
import { useNotes } from "@/contexts/NotesContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function HomeScreen() {
  const { activeTheme } = useTheme();
  const { activeNote, renameNote, createNote, hydrated, setActiveNote } =
    useNotes();
  const {
    toggleLeftMenu,
    toggleRightPanel,
    setSearchOpen,
    typewriterMode,
    setTypewriterMode,
  } = usePanels();
  const insets = useSafeAreaInsets();
  const c = activeTheme.colors;

  const editorRef = useRef<EditorHandle | null>(null);
  const [editorFocused, setEditorFocused] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [container, setContainer] = useState({ width: 0, height: 0 });
  const [zenMode, setZenMode] = useState(false);
  const [undoState, setUndoState] = useState({ canUndo: false, canRedo: false });
  const [exportOpen, setExportOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [shortcutBarHeight, setShortcutBarHeight] = useState(56);

  const toggleZen = useCallback(() => setZenMode((z) => !z), []);
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(300)
    .onEnd((_e, success) => {
      if (success) runOnJS(toggleZen)();
    });

  useFocusEffect(
    useCallback(() => {
      if (hydrated && !activeNote) {
        createNote("/", "Untitled");
      }
    }, [hydrated, activeNote, createNote]),
  );

  const onContainerLayout = (e: LayoutChangeEvent) => {
    setContainer({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  };

  const startTitleEdit = () => {
    if (!activeNote) return;
    setTitleDraft(activeNote.name);
    setTitleEditing(true);
  };

  const commitTitleEdit = () => {
    if (activeNote && titleDraft.trim()) {
      renameNote(activeNote.id, titleDraft.trim());
    }
    setTitleEditing(false);
  };

  return (
    <View
      style={[styles.root, { backgroundColor: c.background }]}
      onLayout={onContainerLayout}
    >
      {/* Top bar */}
      {!zenMode ? (
        <View
          style={[
            styles.topBar,
            {
              paddingTop: insets.top + 6,
              backgroundColor: c.toolbar,
              borderBottomColor: c.border,
            },
          ]}
        >
          <IconButton icon="menu" onPress={toggleLeftMenu} accessibilityLabel="Open menu" />
          <Pressable
            style={styles.titleWrap}
            onPress={startTitleEdit}
            disabled={!activeNote}
          >
            {titleEditing ? (
              <TextInput
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={commitTitleEdit}
                onSubmitEditing={commitTitleEdit}
                autoFocus
                returnKeyType="done"
                selectTextOnFocus
                style={[
                  styles.titleInput,
                  { color: c.toolbarText, borderColor: c.border },
                ]}
              />
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text
                  style={[styles.title, { color: c.toolbarText }]}
                  numberOfLines={1}
                >
                  {activeNote?.name ?? "Scribe"}
                </Text>
                <Text style={[styles.subtitle, { color: c.mutedText }]}>
                  {activeNote
                    ? `${activeNote.folderPath === "/" ? "" : activeNote.folderPath + "/"}${activeNote.name}.${activeNote.ext}`
                    : "no note open"}
                </Text>
              </View>
            )}
          </Pressable>
          <IconButton
            icon="search"
            onPress={() => setSearchOpen(true)}
            accessibilityLabel="Search"
          />
          <IconButton
            icon="more-vertical"
            onPress={() => setMoreMenuOpen(true)}
            accessibilityLabel="More options"
          />
          <IconButton
            icon="sidebar"
            onPress={toggleRightPanel}
            accessibilityLabel="Pinned & outline"
          />
        </View>
      ) : (
        <View style={{ height: insets.top }} />
      )}

      {/* Consolidated three-dot overflow menu: typewriter, find & replace, export */}
      <Modal
        visible={moreMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuOpen(false)}
      >
        <Pressable
          style={styles.moreBackdrop}
          onPress={() => setMoreMenuOpen(false)}
        >
          <View
            style={[
              styles.moreSheet,
              {
                top: insets.top + 44,
                backgroundColor: c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Pressable
              style={styles.moreRow}
              onPress={() => {
                setTypewriterMode(!typewriterMode);
                setMoreMenuOpen(false);
              }}
            >
              <Feather
                name="align-center"
                size={16}
                color={typewriterMode ? c.accent : c.text}
              />
              <Text
                style={{
                  color: typewriterMode ? c.accent : c.text,
                  fontSize: 14,
                  flex: 1,
                }}
              >
                Typewriter mode
              </Text>
              {typewriterMode ? (
                <Feather name="check" size={14} color={c.accent} />
              ) : null}
            </Pressable>
            <Pressable
              style={styles.moreRow}
              onPress={() => {
                editorRef.current?.toggleFindReplace();
                setMoreMenuOpen(false);
              }}
            >
              <Feather name="edit-2" size={16} color={c.text} />
              <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>
                Find & replace
              </Text>
            </Pressable>
            <Pressable
              style={[styles.moreRow, { opacity: activeNote ? 1 : 0.4 }]}
              disabled={!activeNote}
              onPress={() => {
                setExportOpen(true);
                setMoreMenuOpen(false);
              }}
            >
              <Feather name="share" size={16} color={c.text} />
              <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>
                Export
              </Text>
            </Pressable>
            <Pressable
              style={styles.moreRow}
              onPress={() => {
                setZenMode(true);
                setMoreMenuOpen(false);
              }}
            >
              <Feather name="eye" size={16} color={c.text} />
              <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>
                Zen mode
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {zenMode ? (
        <Pressable
          onPress={() => setZenMode(false)}
          style={[
            styles.zenExit,
            { top: insets.top + 8, backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Feather name="eye-off" size={14} color={c.text} />
        </Pressable>
      ) : null}

      {/* Editor area */}
      <GestureDetector gesture={doubleTapGesture}>
        <View style={{ flex: 1 }}>
          {activeNote ? (
            <Editor
              key={activeNote.id}
              noteId={activeNote.id}
              initialContent={activeNote.content}
              bottomOffset={zenMode ? insets.bottom + 16 : shortcutBarHeight + 16}
              registerHandle={(h) => {
                editorRef.current = h;
              }}
              onSelectionChange={() => {
                if (!editorFocused) setEditorFocused(true);
              }}
              onUndoRedoChange={setUndoState}
            />
          ) : (
            <View style={styles.emptyState}>
              <Feather name="edit-3" size={32} color={c.mutedText} />
              <Text style={[styles.emptyText, { color: c.mutedText }]}>
                No note selected. Use the files panel to pick or create one.
              </Text>
            </View>
          )}

          {/* Edge swipe handles, scoped to the editor's own box so they can
              never overlap the top bar or shortcut bar, and inset from the
              corners so they don't cover the preview toggle / word count
              widgets. */}
          <EdgeSwipeArea edge="right" topInset={50} bottomInset={60} />
          <EdgeSwipeArea edge="left" topInset={50} bottomInset={60} />
        </View>
      </GestureDetector>

      {/* Shortcut bar above keyboard */}
      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View onLayout={(e) => setShortcutBarHeight(e.nativeEvent.layout.height)}>
          <ShortcutBar
            visible={!zenMode}
            onApply={(s) => editorRef.current?.applyShortcut(s)}
            onUndo={() => editorRef.current?.undo()}
            onRedo={() => editorRef.current?.redo()}
            canUndo={undoState.canUndo}
            canRedo={undoState.canRedo}
          />
        </View>
      </KeyboardStickyView>

      {/* Floating windows layer */}
      <FloatingWindowsLayer
        containerWidth={container.width}
        containerHeight={container.height}
      />

      {/* Drawers */}
      <Menu onOpenNote={(id) => setActiveNote(id)} />
      <SidePanel onJumpToLine={(line) => editorRef.current?.jumpToLine(line)} />

      {/* Search overlay */}
      <SearchOverlay />

      <ExportSheet
        visible={exportOpen}
        note={activeNote}
        onClose={() => setExportOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: "600",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 30,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  zenExit: {
    position: "absolute",
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
    elevation: 8,
  },
  moreBackdrop: {
    flex: 1,
  },
  moreSheet: {
    position: "absolute",
    right: 8,
    width: 220,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
