import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useNotes, type NoteFile } from "@/contexts/NotesContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";

type FileTreeProps = {
  onOpenNote: (id: string) => void;
  onLongPressNote: (id: string) => void;
  activeNoteId: string | null;
};

type TreeNode = {
  type: "folder" | "file";
  name: string;
  path: string;
  noteId?: string;
  children?: TreeNode[];
};

function buildTree(
  folderPath: string,
  notes: NoteFile[],
  childFoldersOf: (path: string) => { path: string }[],
): TreeNode[] {
  const folderChildren: TreeNode[] = childFoldersOf(folderPath).map((f) => {
    const name = f.path.split("/").filter(Boolean).pop() ?? "/";
    return {
      type: "folder",
      name,
      path: f.path,
      children: buildTree(f.path, notes, childFoldersOf),
    };
  });
  const fileChildren: TreeNode[] = notes
    .filter((n) => n.folderPath === folderPath)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((n) => ({
      type: "file",
      name: `${n.name}.${n.ext}`,
      path: `${folderPath === "/" ? "" : folderPath}/${n.name}.${n.ext}`,
      noteId: n.id,
    }));
  return [...folderChildren, ...fileChildren];
}

function TreeRow({
  node,
  depth,
  expanded,
  toggleExpand,
  onOpenNote,
  onLongPressNote,
  activeNoteId,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggleExpand: (path: string) => void;
  onOpenNote: (id: string) => void;
  onLongPressNote: (id: string) => void;
  activeNoteId: string | null;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const isFolder = node.type === "folder";
  const isOpen = isFolder && expanded.has(node.path);
  const active = node.noteId && node.noteId === activeNoteId;

  return (
    <>
      <Pressable
        onPress={() => {
          if (isFolder) toggleExpand(node.path);
          else if (node.noteId) onOpenNote(node.noteId);
        }}
        onLongPress={() => {
          if (node.noteId) onLongPressNote(node.noteId);
        }}
        style={({ pressed }) => [
          styles.row,
          {
            paddingLeft: 12 + depth * 16,
            backgroundColor: pressed
              ? c.surface
              : active
                ? c.surface
                : "transparent",
          },
        ]}
      >
        <Feather
          name={
            isFolder
              ? isOpen
                ? "chevron-down"
                : "chevron-right"
              : "file-text"
          }
          size={14}
          color={c.mutedText}
        />
        <Text
          style={[
            styles.rowText,
            {
              color: active ? c.accent : c.text,
              fontWeight: isFolder ? "600" : "400",
            },
          ]}
          numberOfLines={1}
        >
          {node.name}
        </Text>
      </Pressable>
      {isFolder && isOpen && node.children
        ? node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onOpenNote={onOpenNote}
              onLongPressNote={onLongPressNote}
              activeNoteId={activeNoteId}
            />
          ))
        : null}
    </>
  );
}

function ListView({
  notes,
  activeNoteId,
  onOpenNote,
  onLongPressNote,
}: {
  notes: NoteFile[];
  activeNoteId: string | null;
  onOpenNote: (id: string) => void;
  onLongPressNote: (id: string) => void;
}) {
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const sorted = useMemo(
    () => [...notes].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );
  if (sorted.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Feather name="file-text" size={28} color={c.mutedText} />
        <Text style={[styles.emptyText, { color: c.mutedText }]}>
          No notes yet
        </Text>
      </View>
    );
  }
  return (
    <>
      {sorted.map((n) => {
        const active = n.id === activeNoteId;
        const preview = (n.content || "")
          .replace(/[#>*_`]/g, "")
          .replace(/\n+/g, " ")
          .trim()
          .slice(0, 80);
        return (
          <Pressable
            key={n.id}
            onPress={() => onOpenNote(n.id)}
            onLongPress={() => onLongPressNote(n.id)}
            style={({ pressed }) => [
              styles.listItem,
              {
                borderBottomColor: c.border,
                backgroundColor: pressed
                  ? c.surface
                  : active
                    ? c.surface
                    : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.listTitle,
                { color: active ? c.accent : c.text },
              ]}
              numberOfLines={1}
            >
              {n.name}
            </Text>
            {preview ? (
              <Text
                style={[styles.listPreview, { color: c.mutedText }]}
                numberOfLines={2}
              >
                {preview}
              </Text>
            ) : null}
            <Text style={[styles.listMeta, { color: c.mutedText }]}>
              {n.folderPath === "/" ? "Root" : n.folderPath} · .{n.ext}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}

function FoldersView({
  onOpenFolder,
}: {
  onOpenFolder: (path: string) => void;
}) {
  const {
    folders,
    notesInFolder,
    childFolders,
    covers,
    requestCover,
  } = useNotes();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;

  const topLevel = useMemo(() => childFolders("/"), [childFolders, folders]);

  // Lazy-request covers for visible folders
  useEffect(() => {
    topLevel.forEach((f) => {
      if (covers[f.path] === undefined) requestCover(f.path);
    });
  }, [topLevel, covers, requestCover]);

  const screenW = Dimensions.get("window").width;
  const tileSize = Math.max(120, Math.min(160, screenW * 0.4));

  if (topLevel.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Feather name="folder" size={28} color={c.mutedText} />
        <Text style={[styles.emptyText, { color: c.mutedText }]}>
          No subfolders here
        </Text>
        <Text style={[styles.emptyHint, { color: c.mutedText }]}>
          Add a Cover.jpg in any folder to show its image here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.gridWrap}>
      {topLevel.map((f) => {
        const cover = covers[f.path];
        const noteCount = notesInFolder(f.path).length;
        return (
          <Pressable
            key={f.path}
            onPress={() => onOpenFolder(f.path)}
            style={({ pressed }) => [
              styles.tile,
              {
                width: tileSize,
                backgroundColor: c.surface,
                borderColor: c.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.tileImageWrap,
                { height: tileSize * 0.75, backgroundColor: c.background },
              ]}
            >
              {cover ? (
                <Image
                  source={{ uri: cover }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <Feather name="folder" size={32} color={c.mutedText} />
              )}
            </View>
            <View style={styles.tileMeta}>
              <Text
                style={[styles.tileName, { color: c.text }]}
                numberOfLines={1}
              >
                {f.path.split("/").filter(Boolean).pop()}
              </Text>
              <Text style={[styles.tileCount, { color: c.mutedText }]}>
                {noteCount} note{noteCount === 1 ? "" : "s"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FileTree({
  onOpenNote,
  onLongPressNote,
  activeNoteId,
}: FileTreeProps) {
  const { notes, childFolders } = useNotes();
  const { viewMode } = usePanels();
  const { activeTheme } = useTheme();
  const c = activeTheme.colors;
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["/", "/Journal", "/Drafts"]),
  );
  const [folderFilter, setFolderFilter] = useState<string | null>(null);

  const root: TreeNode[] = useMemo(
    () => buildTree("/", notes, childFolders),
    [notes, childFolders],
  );

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const filteredNotes = useMemo(
    () => (folderFilter ? notes.filter((n) => n.folderPath === folderFilter) : notes),
    [folderFilter, notes],
  );

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingVertical: 6, paddingBottom: 30 }}
      showsVerticalScrollIndicator={false}
    >
      {viewMode === "tree" ? (
        root.map((node) => (
          <TreeRow
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            toggleExpand={toggleExpand}
            onOpenNote={onOpenNote}
            onLongPressNote={onLongPressNote}
            activeNoteId={activeNoteId}
          />
        ))
      ) : viewMode === "list" ? (
        <>
          {folderFilter ? (
            <Pressable
              onPress={() => setFolderFilter(null)}
              style={[styles.crumb, { borderBottomColor: c.border }]}
            >
              <Feather name="arrow-left" size={14} color={c.accent} />
              <Text style={{ color: c.accent, fontSize: 13 }}>
                Back to all notes
              </Text>
            </Pressable>
          ) : null}
          <ListView
            notes={filteredNotes}
            activeNoteId={activeNoteId}
            onOpenNote={onOpenNote}
            onLongPressNote={onLongPressNote}
          />
        </>
      ) : (
        <>
          {folderFilter ? (
            <>
              <Pressable
                onPress={() => setFolderFilter(null)}
                style={[styles.crumb, { borderBottomColor: c.border }]}
              >
                <Feather name="arrow-left" size={14} color={c.accent} />
                <Text style={{ color: c.accent, fontSize: 13 }}>
                  Back to folders
                </Text>
              </Pressable>
              <ListView
                notes={filteredNotes}
                activeNoteId={activeNoteId}
                onOpenNote={onOpenNote}
                onLongPressNote={onLongPressNote}
              />
            </>
          ) : (
            <FoldersView onOpenFolder={(p) => setFolderFilter(p)} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingRight: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 14,
  },
  listItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  listPreview: {
    fontSize: 12,
    lineHeight: 16,
  },
  listMeta: {
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
  },
  emptyHint: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    gap: 10,
    justifyContent: "center",
  },
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: "hidden",
  },
  tileImageWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tileMeta: {
    padding: 8,
    gap: 2,
  },
  tileName: {
    fontSize: 13,
    fontWeight: "600",
  },
  tileCount: {
    fontSize: 11,
  },
  crumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
