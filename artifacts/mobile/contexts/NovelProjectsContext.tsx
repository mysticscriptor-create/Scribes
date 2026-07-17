import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const PROJECTS_KEY = "scribe.np.projects.v1";
const CHAPTERS_KEY = "scribe.np.chapters.v1";

export type SceneStatus =
  | "draft"
  | "in-progress"
  | "needs-revision"
  | "final";

export const SCENE_STATUS_LABELS: Record<SceneStatus, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  "needs-revision": "Needs Revision",
  final: "Final",
};

export const SCENE_STATUS_COLORS: Record<SceneStatus, string> = {
  draft: "#9ca3af",
  "in-progress": "#f59e0b",
  "needs-revision": "#f97316",
  final: "#22c55e",
};

export type StructureMode = "scene-wise" | "chapter-wise";

export type SceneInfo = {
  noteId: string;
  name: string;
  status: SceneStatus;
  orderIndex: number;
};

export type Chapter = {
  id: string;
  projectId: string;
  name: string;
  orderIndex: number;
  /** In chapter-wise projects, the chapter itself is the note. noteId holds it. */
  noteId?: string;
  scenes: SceneInfo[];
};

export type Project = {
  id: string;
  name: string;
  coverColor: string;
  dateCreated: number;
  lastModified: number;
  /** Defaults to "scene-wise" for backward compat with existing saved projects. */
  structureMode?: StructureMode;
};

const COVER_COLORS = [
  "#6366f1",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

const genId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const pickColor = (projects: Project[]) =>
  COVER_COLORS[projects.length % COVER_COLORS.length] ?? COVER_COLORS[0]!;

type NovelProjectsContextValue = {
  projects: Project[];
  chapters: Chapter[];
  hydrated: boolean;
  createProject: (name: string, structureMode?: StructureMode) => Project;
  updateProject: (id: string, patch: Partial<Omit<Project, "id">>) => void;
  deleteProject: (id: string) => { sceneNoteIds: string[] };
  createChapter: (projectId: string, name: string, noteId?: string) => Chapter;
  updateChapter: (
    id: string,
    patch: Partial<Omit<Chapter, "id" | "projectId">>,
  ) => void;
  deleteChapter: (id: string) => { sceneNoteIds: string[] };
  addScene: (
    chapterId: string,
    noteId: string,
    name: string,
  ) => void;
  updateScene: (
    chapterId: string,
    noteId: string,
    patch: Partial<Omit<SceneInfo, "noteId">>,
  ) => void;
  removeScene: (chapterId: string, noteId: string) => void;
  chaptersForProject: (projectId: string) => Chapter[];
  /** Convenience: resolves effective structureMode (missing field → "scene-wise") */
  getStructureMode: (projectId: string) => StructureMode;
};

const NovelProjectsContext = createContext<NovelProjectsContextValue | null>(
  null,
);

export function NovelProjectsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, c] = await Promise.all([
          AsyncStorage.getItem(PROJECTS_KEY),
          AsyncStorage.getItem(CHAPTERS_KEY),
        ]);
        if (p) setProjects(JSON.parse(p));
        if (c) setChapters(JSON.parse(c));
      } catch {
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)).catch(() => {});
  }, [projects, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(CHAPTERS_KEY, JSON.stringify(chapters)).catch(() => {});
  }, [chapters, hydrated]);

  const createProject = useCallback(
    (name: string, structureMode: StructureMode = "scene-wise"): Project => {
      const project: Project = {
        id: genId(),
        name: name.trim() || "Untitled Project",
        coverColor: pickColor(projects),
        dateCreated: Date.now(),
        lastModified: Date.now(),
        structureMode,
      };
      setProjects((prev) => [...prev, project]);
      return project;
    },
    [projects],
  );

  const updateProject = useCallback(
    (id: string, patch: Partial<Omit<Project, "id">>) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, ...patch, lastModified: Date.now() } : p,
        ),
      );
    },
    [],
  );

  const deleteProject = useCallback(
    (id: string): { sceneNoteIds: string[] } => {
      let noteIds: string[] = [];
      setChapters((prev) => {
        const toRemove = prev.filter((c) => c.projectId === id);
        // collect both scene noteIds and chapter-wise noteIds
        noteIds = toRemove.flatMap((c) => {
          const sceneIds = c.scenes.map((s) => s.noteId);
          return c.noteId ? [c.noteId, ...sceneIds] : sceneIds;
        });
        return prev.filter((c) => c.projectId !== id);
      });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      return { sceneNoteIds: noteIds };
    },
    [],
  );

  const createChapter = useCallback(
    (projectId: string, name: string, noteId?: string): Chapter => {
      const existingCount = chapters.filter(
        (c) => c.projectId === projectId,
      ).length;
      const chapter: Chapter = {
        id: genId(),
        projectId,
        name: name.trim() || "Untitled Chapter",
        orderIndex: existingCount,
        noteId,
        scenes: [],
      };
      setChapters((prev) => [...prev, chapter]);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, lastModified: Date.now() } : p,
        ),
      );
      return chapter;
    },
    [chapters],
  );

  const updateChapter = useCallback(
    (id: string, patch: Partial<Omit<Chapter, "id" | "projectId">>) => {
      setChapters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const deleteChapter = useCallback(
    (id: string): { sceneNoteIds: string[] } => {
      let noteIds: string[] = [];
      setChapters((prev) => {
        const ch = prev.find((c) => c.id === id);
        if (ch) {
          const sceneIds = ch.scenes.map((s) => s.noteId);
          noteIds = ch.noteId ? [ch.noteId, ...sceneIds] : sceneIds;
        }
        return prev.filter((c) => c.id !== id);
      });
      return { sceneNoteIds: noteIds };
    },
    [],
  );

  const addScene = useCallback(
    (chapterId: string, noteId: string, name: string) => {
      setChapters((prev) =>
        prev.map((c) => {
          if (c.id !== chapterId) return c;
          const scene: SceneInfo = {
            noteId,
            name: name.trim() || "Untitled Scene",
            status: "draft",
            orderIndex: c.scenes.length,
          };
          return { ...c, scenes: [...c.scenes, scene] };
        }),
      );
    },
    [],
  );

  const updateScene = useCallback(
    (
      chapterId: string,
      noteId: string,
      patch: Partial<Omit<SceneInfo, "noteId">>,
    ) => {
      setChapters((prev) =>
        prev.map((c) => {
          if (c.id !== chapterId) return c;
          return {
            ...c,
            scenes: c.scenes.map((s) =>
              s.noteId === noteId ? { ...s, ...patch } : s,
            ),
          };
        }),
      );
    },
    [],
  );

  const removeScene = useCallback((chapterId: string, noteId: string) => {
    setChapters((prev) =>
      prev.map((c) => {
        if (c.id !== chapterId) return c;
        return {
          ...c,
          scenes: c.scenes.filter((s) => s.noteId !== noteId),
        };
      }),
    );
  }, []);

  const chaptersForProject = useCallback(
    (projectId: string) =>
      chapters
        .filter((c) => c.projectId === projectId)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [chapters],
  );

  const getStructureMode = useCallback(
    (projectId: string): StructureMode => {
      const p = projects.find((proj) => proj.id === projectId);
      return p?.structureMode ?? "scene-wise";
    },
    [projects],
  );

  const value = useMemo(
    () => ({
      projects,
      chapters,
      hydrated,
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
    }),
    [
      projects,
      chapters,
      hydrated,
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
    ],
  );

  return (
    <NovelProjectsContext.Provider value={value}>
      {children}
    </NovelProjectsContext.Provider>
  );
}

export function useNovelProjects() {
  const ctx = useContext(NovelProjectsContext);
  if (!ctx)
    throw new Error(
      "useNovelProjects must be used inside NovelProjectsProvider",
    );
  return ctx;
}
