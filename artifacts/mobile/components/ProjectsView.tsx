import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  SCENE_STATUS_COLORS,
  SCENE_STATUS_LABELS,
  useNovelProjects,
  type Chapter,
  type Project,
  type SceneInfo,
  type SceneStatus,
  type StructureMode,
} from "@/contexts/NovelProjectsContext";
import { useNotes } from "@/contexts/NotesContext";
import { usePanels } from "@/contexts/PanelsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countWords } from "@/lib/markdown";

const COVER_COLORS = [
  "#6366f1","#f43f5e","#10b981","#f59e0b",
  "#3b82f6","#8b5cf6","#ec4899","#14b8a6",
];

type CreateModalState = {
  visible: boolean;
  mode: "project" | "chapter" | "scene";
  projectId?: string;
  chapterId?: string;
};

type ActionState =
  | { type: "project"; item: Project }
  | { type: "chapter"; item: Chapter; projectId: string }
  | { type: "scene"; item: SceneInfo; chapter: Chapter }
  | null;

type StatusPickerState = {
  visible: boolean;
  chapterId: string;
  noteId: string;
  current: SceneStatus;
} | null;

type ColorPickerState = {
  visible: boolean;
  projectId: string;
} | null;

type RenameState = {
  visible: boolean;
  initialName: string;
  onSave: (name: string) => void;
} | null;

/** Pin-slot picker for chapters and scenes */
type PinPickerState = {
  visible: boolean;
  noteId: string;
} | null;

export function ProjectsView({
  onOpenNote,
  onClose,
}: {
  onOpenNote: (id: string) => void;
  onClose: () => void;
}) {
  const {
    projects,
    chapters,
    createProject,
    updateProject,
    deleteProject,
    createChapter,
    updateChapter,
    deleteChapter,
    addScene,
    updateScene,
    removeScene,
    chaptersForProject,
    getStructureMode,
  } = useNovelProjects();
  const { createNote, deleteNote, notes } = useNotes();
  const { activeTheme } = useTheme();
  const { setPinned, openFloating } = usePanels();
  const c = activeTheme.colors;

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [createModal, setCreateModal] = useState<CreateModalState>({
    visible: false,
    mode: "project",
  });
  // structureMode chosen during new-project creation
  const [pendingStructureMode, setPendingStructureMode] = useState<StructureMode>("scene-wise");
  const [action, setAction] = useState<ActionState>(null);
  const [statusPicker, setStatusPicker] = useState<StatusPickerState>(null);
  const [colorPicker, setColorPicker] = useState<ColorPickerState>(null);
  const [rename, setRename] = useState<RenameState>(null);
  const [pinPicker, setPinPicker] = useState<PinPickerState>(null);
  const [createName, setCreateName] = useState("");

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleChapter = (id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreateProject = () => {
    setCreateName("");
    setPendingStructureMode("scene-wise");
    setCreateModal({ visible: true, mode: "project" });
  };

  const handleCreateChapter = (projectId: string) => {
    setCreateName("");
    setCreateModal({ visible: true, mode: "chapter", projectId });
  };

  const handleCreateScene = (chapterId: string, projectId: string) => {
    setCreateName("");
    setCreateModal({ visible: true, mode: "scene", chapterId, projectId });
  };

  const confirmCreate = async () => {
    const name = createName.trim() || (
      createModal.mode === "project" ? "Untitled Project" :
      createModal.mode === "chapter" ? "Untitled Chapter" : "Untitled Scene"
    );
    if (createModal.mode === "project") {
      const p = createProject(name, pendingStructureMode);
      setExpandedProjects((prev) => new Set([...prev, p.id]));
    } else if (createModal.mode === "chapter" && createModal.projectId) {
      const structMode = getStructureMode(createModal.projectId);
      if (structMode === "chapter-wise") {
        // Chapter IS the note — create note immediately
        const folderPath = `/novels/${createModal.projectId}`;
        const note = await createNote(folderPath, name);
        if (note) {
          const ch = createChapter(createModal.projectId, name, note.id);
          setCreateModal({ visible: false, mode: "project" });
          onOpenNote(note.id);
          onClose();
          return;
        }
      } else {
        const ch = createChapter(createModal.projectId, name);
        setExpandedChapters((prev) => new Set([...prev, ch.id]));
      }
    } else if (createModal.mode === "scene" && createModal.chapterId && createModal.projectId) {
      const chapter = chapters.find((c) => c.id === createModal.chapterId);
      if (!chapter) return;
      const folderPath = `/novels/${createModal.projectId}`;
      const note = await createNote(folderPath, name);
      if (note) {
        addScene(createModal.chapterId, note.id, name);
        setCreateModal({ visible: false, mode: "project" });
        onOpenNote(note.id);
        onClose();
        return;
      }
    }
    setCreateModal({ visible: false, mode: "project" });
  };

  const handleLongPressProject = (project: Project) => {
    Haptics.selectionAsync();
    setAction({ type: "project", item: project });
  };

  const handleLongPressChapter = (chapter: Chapter, projectId: string) => {
    Haptics.selectionAsync();
    setAction({ type: "chapter", item: chapter, projectId });
  };

  const handleLongPressScene = (scene: SceneInfo, chapter: Chapter) => {
    Haptics.selectionAsync();
    setAction({ type: "scene", item: scene, chapter });
  };

  const handleDeleteProject = (project: Project) => {
    Alert.alert(
      `Delete "${project.name}"?`,
      "This will delete the project, all its chapters, and all scene notes. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const { sceneNoteIds } = deleteProject(project.id);
            sceneNoteIds.forEach((id) => deleteNote(id));
            setAction(null);
          },
        },
      ],
    );
  };

  const handleDeleteChapter = (chapter: Chapter) => {
    Alert.alert(
      `Delete "${chapter.name}"?`,
      "This will delete the chapter and all its scenes. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const { sceneNoteIds } = deleteChapter(chapter.id);
            sceneNoteIds.forEach((id) => deleteNote(id));
            setAction(null);
          },
        },
      ],
    );
  };

  const handleDeleteScene = (scene: SceneInfo, chapter: Chapter) => {
    Alert.alert(
      `Delete "${scene.name}"?`,
      "The note will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            removeScene(chapter.id, scene.noteId);
            deleteNote(scene.noteId);
            setAction(null);
          },
        },
      ],
    );
  };

  const projectWordCount = (project: Project) => {
    const pChapters = chaptersForProject(project.id);
    const structMode = getStructureMode(project.id);
    return pChapters.reduce((total, ch) => {
      if (structMode === "chapter-wise" && ch.noteId) {
        const note = notes.find((n) => n.id === ch.noteId);
        return total + (note ? countWords(note.content) : 0);
      }
      return total + ch.scenes.reduce((t, s) => {
        const note = notes.find((n) => n.id === s.noteId);
        return t + (note ? countWords(note.content) : 0);
      }, 0);
    }, 0);
  };

  const renderScene = (scene: SceneInfo, chapter: Chapter) => {
    const statusColor = SCENE_STATUS_COLORS[scene.status];
    const note = notes.find((n) => n.id === scene.noteId);
    const words = note ? countWords(note.content) : 0;
    return (
      <Pressable
        key={scene.noteId}
        onPress={() => {
          onOpenNote(scene.noteId);
          onClose();
        }}
        onLongPress={() => handleLongPressScene(scene, chapter)}
        style={({ pressed }) => [
          styles.sceneRow,
          {
            backgroundColor: pressed ? c.background : "transparent",
            borderBottomColor: c.border,
          },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.sceneName, { color: c.text }]} numberOfLines={1}>
          {scene.name}
        </Text>
        <Text style={[styles.wordsMeta, { color: c.mutedText }]}>
          {words > 0 ? `${words}w` : "empty"}
        </Text>
        <Feather name="chevron-right" size={12} color={c.mutedText} />
      </Pressable>
    );
  };

  const renderChapterWise = (chapter: Chapter, projectId: string) => {
    // Chapter-wise: chapter IS the note — tap opens note directly, no scene list
    const note = chapter.noteId ? notes.find((n) => n.id === chapter.noteId) : null;
    const words = note ? countWords(note.content) : 0;
    return (
      <View key={chapter.id}>
        <Pressable
          onPress={() => {
            if (chapter.noteId) {
              onOpenNote(chapter.noteId);
              onClose();
            }
          }}
          onLongPress={() => handleLongPressChapter(chapter, projectId)}
          style={({ pressed }) => [
            styles.chapterRow,
            {
              backgroundColor: pressed ? c.border + "55" : "transparent",
              borderBottomColor: c.border,
            },
          ]}
        >
          <Feather name="file-text" size={13} color={c.mutedText} />
          <Text style={[styles.chapterName, { color: c.text }]} numberOfLines={1}>
            {chapter.name}
          </Text>
          <Text style={[styles.chapterMeta, { color: c.mutedText }]}>
            {words > 0 ? `${words}w` : "empty"}
          </Text>
          <Feather name="chevron-right" size={12} color={c.mutedText} />
        </Pressable>
      </View>
    );
  };

  const renderChapterSceneWise = (chapter: Chapter, projectId: string) => {
    const isExpanded = expandedChapters.has(chapter.id);
    const sceneCount = chapter.scenes.length;
    return (
      <View key={chapter.id}>
        <Pressable
          onPress={() => toggleChapter(chapter.id)}
          onLongPress={() => handleLongPressChapter(chapter, projectId)}
          style={({ pressed }) => [
            styles.chapterRow,
            {
              backgroundColor: pressed ? c.border + "55" : "transparent",
              borderBottomColor: c.border,
            },
          ]}
        >
          <Feather
            name={isExpanded ? "chevron-down" : "chevron-right"}
            size={13}
            color={c.mutedText}
          />
          <Text style={[styles.chapterName, { color: c.text }]} numberOfLines={1}>
            {chapter.name}
          </Text>
          <Text style={[styles.chapterMeta, { color: c.mutedText }]}>
            {sceneCount} scene{sceneCount !== 1 ? "s" : ""}
          </Text>
        </Pressable>
        {isExpanded && (
          <View style={[styles.sceneList, { borderLeftColor: c.border }]}>
            {chapter.scenes.length === 0 ? (
              <Text style={[styles.emptyHint, { color: c.mutedText }]}>
                No scenes yet — tap + to add one
              </Text>
            ) : (
              chapter.scenes
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((s) => renderScene(s, chapter))
            )}
            <Pressable
              onPress={() => handleCreateScene(chapter.id, projectId)}
              style={({ pressed }) => [
                styles.addRow,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="plus" size={12} color={c.accent} />
              <Text style={[styles.addLabel, { color: c.accent }]}>
                New Scene
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderProject = ({ item: project }: { item: Project }) => {
    const isExpanded = expandedProjects.has(project.id);
    const pChapters = chaptersForProject(project.id);
    const wc = projectWordCount(project);
    const structMode = getStructureMode(project.id);
    const modifiedDate = new Date(project.lastModified).toLocaleDateString(
      undefined,
      { month: "short", day: "numeric" },
    );
    return (
      <View
        style={[
          styles.projectCard,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Pressable
          onPress={() => toggleProject(project.id)}
          onLongPress={() => handleLongPressProject(project)}
          style={({ pressed }) => [
            styles.projectHeader,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View
            style={[styles.colorDot, { backgroundColor: project.coverColor }]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.projectName, { color: c.text }]} numberOfLines={1}>
              {project.name}
            </Text>
            <Text style={[styles.projectMeta, { color: c.mutedText }]}>
              {wc.toLocaleString()} words · {modifiedDate}
              {structMode === "chapter-wise" ? " · chapter-wise" : ""}
            </Text>
          </View>
          <Feather
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={c.mutedText}
          />
        </Pressable>

        {isExpanded && (
          <View>
            {pChapters.length === 0 ? (
              <Text style={[styles.emptyHint, { color: c.mutedText, paddingHorizontal: 16, paddingVertical: 10 }]}>
                Add your first chapter to get started
              </Text>
            ) : (
              pChapters.map((ch) =>
                structMode === "chapter-wise"
                  ? renderChapterWise(ch, project.id)
                  : renderChapterSceneWise(ch, project.id)
              )
            )}
            <Pressable
              onPress={() => handleCreateChapter(project.id)}
              style={({ pressed }) => [
                styles.addRow,
                { paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="plus" size={12} color={c.accent} />
              <Text style={[styles.addLabel, { color: c.accent }]}>
                New Chapter
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="book" size={32} color={c.mutedText} />
          <Text style={[styles.emptyTitle, { color: c.mutedText }]}>
            No projects yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: c.mutedText }]}>
            Tap + to create your first project
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          renderItem={renderProject}
          contentContainerStyle={{ padding: 12, paddingBottom: 80, gap: 10 }}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          maxToRenderPerBatch={8}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={handleCreateProject}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 },
        ]}
        accessibilityLabel="New project"
      >
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>

      {/* Create modal */}
      <Modal
        visible={createModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModal({ visible: false, mode: "project" })}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCreateModal({ visible: false, mode: "project" })}
        >
          <Pressable
            style={[styles.modalSheet, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {createModal.mode === "project"
                ? "New Project"
                : createModal.mode === "chapter"
                ? "New Chapter"
                : "New Scene"}
            </Text>
            <TextInput
              value={createName}
              onChangeText={setCreateName}
              placeholder={
                createModal.mode === "project"
                  ? "Project title"
                  : createModal.mode === "chapter"
                  ? "Chapter title"
                  : "Scene title"
              }
              placeholderTextColor={c.mutedText}
              style={[styles.modalInput, { color: c.text, borderColor: c.border }]}
              autoFocus
              onSubmitEditing={confirmCreate}
              returnKeyType="done"
            />

            {/* Structure mode picker — only for new projects */}
            {createModal.mode === "project" && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.sectionLabel, { color: c.mutedText }]}>
                  Structure
                </Text>
                <StructureModeOption
                  selected={pendingStructureMode === "scene-wise"}
                  title="Scene-wise"
                  description="Chapters contain multiple scenes as separate files"
                  onPress={() => setPendingStructureMode("scene-wise")}
                  c={c}
                />
                <StructureModeOption
                  selected={pendingStructureMode === "chapter-wise"}
                  title="Chapter-wise"
                  description="Each chapter is a single document — no scene sub-level"
                  onPress={() => setPendingStructureMode("chapter-wise")}
                  c={c}
                />
              </View>
            )}

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setCreateModal({ visible: false, mode: "project" })}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { backgroundColor: c.background, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: c.mutedText, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmCreate}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { backgroundColor: c.accent, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                  Create
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Action sheet */}
      <Modal
        visible={action !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAction(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAction(null)}>
          <Pressable
            style={[styles.actionSheet, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            {action?.type === "project" && (
              <>
                <Text style={[styles.actionTitle, { color: c.mutedText }]}>
                  {action.item.name}
                </Text>
                <ActionRow
                  icon="edit-2"
                  label="Rename"
                  c={c}
                  onPress={() => {
                    setAction(null);
                    setRename({
                      visible: true,
                      initialName: action.item.name,
                      onSave: (name) => updateProject(action.item.id, { name }),
                    });
                  }}
                />
                <ActionRow
                  icon="droplet"
                  label="Change color"
                  c={c}
                  onPress={() => {
                    setAction(null);
                    setColorPicker({ visible: true, projectId: action.item.id });
                  }}
                />
                <ActionRow
                  icon="trash-2"
                  label="Delete project"
                  c={c}
                  destructive
                  onPress={() => handleDeleteProject(action.item)}
                />
              </>
            )}
            {action?.type === "chapter" && (
              <>
                <Text style={[styles.actionTitle, { color: c.mutedText }]}>
                  {action.item.name}
                </Text>
                <ActionRow
                  icon="edit-2"
                  label="Rename"
                  c={c}
                  onPress={() => {
                    setAction(null);
                    setRename({
                      visible: true,
                      initialName: action.item.name,
                      onSave: (name) => updateChapter(action.item.id, { name }),
                    });
                  }}
                />
                {/* Pin / floating only available when the chapter has an underlying note */}
                {action.item.noteId != null && (
                  <>
                    <ActionRow
                      icon="bookmark"
                      label="Pin to panel"
                      c={c}
                      onPress={() => {
                        const noteId = action.item.noteId!;
                        setAction(null);
                        setPinPicker({ visible: true, noteId });
                      }}
                    />
                    <ActionRow
                      icon="copy"
                      label="Open in floating window"
                      c={c}
                      onPress={() => {
                        const noteId = action.item.noteId!;
                        setAction(null);
                        openFloating(noteId);
                      }}
                    />
                  </>
                )}
                <ActionRow
                  icon="trash-2"
                  label="Delete chapter"
                  c={c}
                  destructive
                  onPress={() => handleDeleteChapter(action.item)}
                />
              </>
            )}
            {action?.type === "scene" && (
              <>
                <Text style={[styles.actionTitle, { color: c.mutedText }]}>
                  {action.item.name}
                </Text>
                <ActionRow
                  icon="tag"
                  label="Set status"
                  c={c}
                  onPress={() => {
                    const a = action;
                    setAction(null);
                    setStatusPicker({
                      visible: true,
                      chapterId: a.chapter.id,
                      noteId: a.item.noteId,
                      current: a.item.status,
                    });
                  }}
                />
                <ActionRow
                  icon="edit-2"
                  label="Rename"
                  c={c}
                  onPress={() => {
                    const a = action;
                    setAction(null);
                    setRename({
                      visible: true,
                      initialName: a.item.name,
                      onSave: (name) =>
                        updateScene(a.chapter.id, a.item.noteId, { name }),
                    });
                  }}
                />
                <ActionRow
                  icon="bookmark"
                  label="Pin to panel"
                  c={c}
                  onPress={() => {
                    const noteId = action.item.noteId;
                    setAction(null);
                    setPinPicker({ visible: true, noteId });
                  }}
                />
                <ActionRow
                  icon="copy"
                  label="Open in floating window"
                  c={c}
                  onPress={() => {
                    const noteId = action.item.noteId;
                    setAction(null);
                    openFloating(noteId);
                  }}
                />
                <ActionRow
                  icon="trash-2"
                  label="Delete scene"
                  c={c}
                  destructive
                  onPress={() => {
                    const a = action;
                    setAction(null);
                    handleDeleteScene(a.item, a.chapter);
                  }}
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pin slot picker */}
      <Modal
        visible={pinPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPinPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPinPicker(null)}>
          <Pressable
            style={[styles.actionSheet, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.actionTitle, { color: c.mutedText }]}>
              Pin to Side Panel
            </Text>
            <ActionRow
              icon="bookmark"
              label="Pin to top slot"
              c={c}
              onPress={() => {
                if (pinPicker) setPinned("top", pinPicker.noteId);
                setPinPicker(null);
              }}
            />
            <ActionRow
              icon="bookmark"
              label="Pin to bottom slot"
              c={c}
              onPress={() => {
                if (pinPicker) setPinned("bottom", pinPicker.noteId);
                setPinPicker(null);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Status picker */}
      <Modal
        visible={statusPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusPicker(null)}>
          <Pressable
            style={[styles.actionSheet, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.actionTitle, { color: c.mutedText }]}>
              Scene Status
            </Text>
            {(Object.keys(SCENE_STATUS_LABELS) as SceneStatus[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  if (statusPicker) {
                    updateScene(statusPicker.chapterId, statusPicker.noteId, {
                      status: s,
                    });
                  }
                  setStatusPicker(null);
                }}
                style={({ pressed }) => [
                  styles.statusRow,
                  { backgroundColor: pressed ? c.background : "transparent" },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: SCENE_STATUS_COLORS[s], width: 12, height: 12 },
                  ]}
                />
                <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>
                  {SCENE_STATUS_LABELS[s]}
                </Text>
                {statusPicker?.current === s && (
                  <Feather name="check" size={14} color={c.accent} />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Color picker */}
      <Modal
        visible={colorPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setColorPicker(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setColorPicker(null)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>
              Pick a Color
            </Text>
            <View style={styles.colorGrid}>
              {COVER_COLORS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => {
                    if (colorPicker) {
                      updateProject(colorPicker.projectId, {
                        coverColor: color,
                      });
                    }
                    setColorPicker(null);
                  }}
                  style={({ pressed }) => [
                    styles.colorSwatch,
                    {
                      backgroundColor: color,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={rename !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRename(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRename(null)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>Rename</Text>
            <TextInput
              defaultValue={rename?.initialName}
              onChangeText={setCreateName}
              placeholder="New name"
              placeholderTextColor={c.mutedText}
              style={[styles.modalInput, { color: c.text, borderColor: c.border }]}
              autoFocus
              onSubmitEditing={() => {
                rename?.onSave(createName || rename.initialName);
                setRename(null);
              }}
              returnKeyType="done"
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setRename(null)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { backgroundColor: c.background, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: c.mutedText, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  rename?.onSave(createName || rename.initialName);
                  setRename(null);
                }}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { backgroundColor: c.accent, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Small inline option card for structure mode picker */
function StructureModeOption({
  selected,
  title,
  description,
  onPress,
  c,
}: {
  selected: boolean;
  title: string;
  description: string;
  onPress: () => void;
  c: { text: string; mutedText: string; accent: string; border: string; background: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.structureOption,
        {
          borderColor: selected ? c.accent : c.border,
          backgroundColor: selected ? c.accent + "12" : pressed ? c.background : "transparent",
        },
      ]}
    >
      <View style={styles.structureOptionHeader}>
        <View
          style={[
            styles.structureRadio,
            {
              borderColor: selected ? c.accent : c.border,
              backgroundColor: selected ? c.accent : "transparent",
            },
          ]}
        />
        <Text style={[styles.structureTitle, { color: c.text }]}>{title}</Text>
      </View>
      <Text style={[styles.structureDesc, { color: c.mutedText }]}>{description}</Text>
    </Pressable>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  destructive = false,
  c,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
  c: { text: string; background: string };
}) {
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptySubtitle: { fontSize: 12, textAlign: "center" },
  emptyHint: { fontSize: 12, fontStyle: "italic", paddingLeft: 28 },
  projectCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  projectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  projectName: { fontSize: 15, fontWeight: "700" },
  projectMeta: { fontSize: 11, marginTop: 2 },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chapterName: { flex: 1, fontSize: 14, fontWeight: "600" },
  chapterMeta: { fontSize: 11 },
  sceneList: {
    borderLeftWidth: 2,
    marginLeft: 22,
  },
  sceneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  sceneName: { flex: 1, fontSize: 13 },
  wordsMeta: { fontSize: 11 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addLabel: { fontSize: 13, fontWeight: "600" },
  fab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
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
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  structureOption: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  structureOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  structureRadio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  structureTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  structureDesc: {
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 22,
  },
});
