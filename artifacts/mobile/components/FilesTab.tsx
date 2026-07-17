import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ExportSheet } from "@/components/ExportSheet";
import { FileTree } from "@/components/FileTree";
import { IconButton } from "@/components/IconButton";
import { ProjectsView } from "@/components/ProjectsView";
import { useNotes, type NoteFile } from "@/contexts/NotesContext";
import { usePanels, type FileViewMode } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

// The Files & Projects browser — lives in the left "Macro" menu (vault/project
// management, folders, file tree, settings, global search all belong on the
// left per the v2.0 panel redefinition). The right "Micro" panel is reserved
// for Pinned + Outline only; see SidePanel.tsx.
export function FilesTab({
  onOpenNote,
  onClose,
}: {
  onOpenNote: (id: string) => void;
  onClose: () => void;
}) {
  const {
    activeNoteId,
    createNote,
    createFolder,
    vaultName,
    externalRoot,
    externalLoading,
    isSafSupported,
    connectExternalFolder,
    disconnectExternalFolder,
    refreshExternalFolder,
  } = useNotes();
  const { viewMode, setViewMode } = usePanels();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [folderInput, setFolderInput] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [actionNoteId, setActionNoteId] = useState<string | null>(null);

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect folder",
      `Stop using "${externalRoot?.name}"? Your phone files stay where they are; Scribe just goes back to its built-in vault.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", onPress: disconnectExternalFolder },
      ],
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Folder source bar */}
      <View
        style={[
          styles.sourceBar,
          { backgroundColor: c.background, borderBottomColor: c.border },
        ]}
      >
        <Feather
          name={externalRoot ? "smartphone" : "hard-drive"}
          size={13}
          color={c.accent}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: c.text, fontSize: 13, fontWeight: "600" }}
            numberOfLines={1}
          >
            {externalRoot ? externalRoot.name : vaultName}
          </Text>
          <Text style={{ color: c.mutedText, fontSize: 10, marginTop: 1 }}>
            {externalRoot ? "Phone folder · live" : "Built-in vault"}
          </Text>
        </View>
        {externalRoot ? (
          <>
            <IconButton
              icon="refresh-ccw"
              size={28}
              onPress={refreshExternalFolder}
              accessibilityLabel="Refresh"
            />
            <IconButton
              icon="log-out"
              size={28}
              onPress={handleDisconnect}
              accessibilityLabel="Disconnect"
            />
          </>
        ) : (
          <IconButton
            icon="folder"
            label="Connect"
            variant="solid"
            onPress={async () => {
              if (!isSafSupported) {
                Alert.alert(
                  "Android only",
                  "Picking a phone folder works in the installed Android app. The web preview uses the in-app vault.",
                );
                return;
              }
              await connectExternalFolder();
            }}
          />
        )}
      </View>

      {externalLoading ? (
        <View style={[styles.loadingBar, { borderBottomColor: c.border }]}>
          <Feather name="loader" size={12} color={c.mutedText} />
          <Text style={{ color: c.mutedText, fontSize: 12 }}>
            Reading folder…
          </Text>
        </View>
      ) : null}

      <View style={[styles.actionsRow, { borderBottomColor: c.border }]}>
        {viewMode !== "projects" ? (
          <>
            <IconButton
              icon="file-plus"
              label="New note"
              onPress={async () => {
                await createNote("/", "Untitled");
                onClose();
              }}
            />
            <IconButton
              icon="folder-plus"
              onPress={() => setShowFolderInput((v) => !v)}
              accessibilityLabel="New folder"
            />
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </View>
      {showFolderInput ? (
        <View style={[styles.folderInputRow, { borderBottomColor: c.border }]}>
          <TextInput
            value={folderInput}
            onChangeText={setFolderInput}
            placeholder="Folder name"
            placeholderTextColor={c.mutedText}
            style={[
              styles.folderInput,
              { color: c.text, borderColor: c.border },
            ]}
            onSubmitEditing={async () => {
              if (folderInput.trim()) {
                await createFolder(`/${folderInput.trim()}`);
                setFolderInput("");
                setShowFolderInput(false);
              }
            }}
            returnKeyType="done"
          />
          <IconButton
            icon="check"
            onPress={async () => {
              if (folderInput.trim()) {
                await createFolder(`/${folderInput.trim()}`);
                setFolderInput("");
                setShowFolderInput(false);
              }
            }}
          />
        </View>
      ) : null}

      {viewMode === "projects" ? (
        <ProjectsView onOpenNote={onOpenNote} onClose={onClose} />
      ) : (
        <>
          <FileTree
            activeNoteId={activeNoteId}
            onOpenNote={onOpenNote}
            onLongPressNote={(id) => setActionNoteId(id)}
          />
          <View style={[styles.hintBox, { borderTopColor: c.border }]}>
            <Feather name="info" size={12} color={c.mutedText} />
            <Text style={[styles.hintText, { color: c.mutedText }]}>
              {externalRoot
                ? "Edits save back to your phone. Long-press a file for actions."
                : "Tap Connect to pick a folder on your phone (Documents, Downloads, etc.) and read your real .md and .txt files."}
            </Text>
          </View>
        </>
      )}

      <NoteActionSheet
        noteId={actionNoteId}
        onClose={() => setActionNoteId(null)}
        onOpenNote={onOpenNote}
      />
    </View>
  );
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: FileViewMode;
  onChange: (v: FileViewMode) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const opts: {
    v: FileViewMode;
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
  }[] = [
    { v: "tree", icon: "git-branch", label: "Tree" },
    { v: "list", icon: "list", label: "List" },
    { v: "folders", icon: "grid", label: "Folders" },
    { v: "projects", icon: "book", label: "Projects" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {opts.map((o) => (
        <Pressable
          key={o.v}
          onPress={() => onChange(o.v)}
          style={({ pressed }) => ({
            paddingHorizontal: 8,
            paddingVertical: 6,
            backgroundColor:
              value === o.v
                ? c.accent + "22"
                : pressed
                  ? c.background
                  : "transparent",
          })}
          accessibilityLabel={`View ${o.label}`}
        >
          <Feather
            name={o.icon}
            size={14}
            color={value === o.v ? c.accent : c.mutedText}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function NoteActionSheet({
  noteId,
  onClose,
  onOpenNote,
}: {
  noteId: string | null;
  onClose: () => void;
  onOpenNote: (id: string) => void;
}) {
  const { notes, deleteNote } = useNotes();
  const { setPinned, openFloating } = usePanels();
  const { activeTheme } = useTheme();
  const router = useRouter();
  const c = activeTheme.colors;
  const note = noteId ? notes.find((n) => n.id === noteId) : null;
  const visible = !!note;
  const [exportNote, setExportNote] = useState<NoteFile | null>(null);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.actionBackdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.actionSheet,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[styles.actionTitle, { color: c.text }]}>
              {note?.name}
            </Text>
            <ActionRow
              icon="edit-3"
              label="Open in editor"
              onPress={() => {
                if (!note) return;
                onOpenNote(note.id);
                onClose();
              }}
            />
            <ActionRow
              icon="copy"
              label="Open in floating window"
              onPress={() => {
                if (!note) return;
                openFloating(note.id);
                onClose();
              }}
            />
            <ActionRow
              icon="clock"
              label="Version history"
              onPress={() => {
                if (!note) return;
                onClose();
                router.push({
                  pathname: "/history",
                  params: { noteId: note.id },
                });
              }}
            />
            <ActionRow
              icon="share"
              label="Export file"
              onPress={() => {
                if (!note) return;
                onClose();
                setExportNote(note);
              }}
            />
            <ActionRow
              icon="bookmark"
              label="Pin to top of right panel"
              onPress={() => {
                if (!note) return;
                setPinned("top", note.id);
                onClose();
              }}
            />
            <ActionRow
              icon="bookmark"
              label="Pin to bottom of right panel"
              onPress={() => {
                if (!note) return;
                setPinned("bottom", note.id);
                onClose();
              }}
            />
            <ActionRow
              icon="trash-2"
              label="Delete"
              destructive
              onPress={() => {
                if (!note) return;
                deleteNote(note.id);
                onClose();
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <ExportSheet
        visible={exportNote !== null}
        note={exportNote}
        onClose={() => setExportNote(null)}
      />
    </>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const color = destructive ? "#cc6b5d" : c.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { backgroundColor: pressed ? c.background : "transparent" },
      ]}
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={{ color, fontSize: 15, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sourceBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folderInput: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    fontSize: 14,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hintText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  actionSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.7,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
