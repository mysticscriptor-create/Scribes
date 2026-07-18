import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState } from "react-native";

import {
  createFile as safCreateFile,
  createSubFolder as safCreateSubFolder,
  deleteUri as safDelete,
  isAndroidSafSupported,
  pickFolder,
  readFile as safReadFile,
  readImageAsDataUri,
  scanFolderTree,
  writeFile as safWriteFile,
} from "@/lib/safStorage";

const NOTES_KEY = "scribe.notes.v1";
const FOLDERS_KEY = "scribe.folders.v1";
const ACTIVE_NOTE_KEY = "scribe.activeNote.v1";
const VAULT_NAME_KEY = "scribe.vaultName.v1";
const EXTERNAL_ROOT_KEY = "scribe.externalRoot.v1";

export type NoteFile = {
  id: string;
  name: string;
  folderPath: string;
  ext: "md" | "txt";
  content: string;
  createdAt: number;
  updatedAt: number;
  externalUri?: string;
  loaded?: boolean;
};

export type FolderEntry = {
  path: string;
  externalUri?: string;
};

const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 9);

const SAMPLE_NOTES: NoteFile[] = [
  {
    id: "welcome",
    name: "Welcome",
    folderPath: "/",
    ext: "md",
    content: `# Welcome to Scribe

Your private, on-device writing space — distraction-free and fully offline.

## What you can do here

- Write in Markdown with **bold**, *italic*, \`code\`, and [links](https://example.com)
- Customize fonts, colors, spacing in *Themes*
- Pin notes to the right side for reference while you write
- Open multiple floating windows for side-by-side reading

> The cursor jumps out of quotes when you press Enter. Try it.

Swipe in from the right edge to open the file panel. Tap **Connect folder** to read and write files from your phone.

---

Happy writing.`,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "shortcuts-tip",
    name: "Tips",
    folderPath: "/",
    ext: "md",
    content: `# Tips

## Smart pairs

Type \`"\`, \`(\`, \`[\`, \`{\`, or \`'\` and Scribe inserts the matching close character. Press **Enter** while the cursor sits before a closing pair and the cursor jumps past it instead of breaking the line.

## Custom shortcuts

Open the menu and tap *Shortcuts* to add your own. Each shortcut can:

- Insert plain text (em-dash, ellipsis, signature)
- Wrap selection (markdown bold, italic, code)
- Insert a paired character (smart-pair behavior)

## Pinning

Long-press a note in the file panel to pin it to the top or bottom of the right side. Two pinned notes share the right side half-and-half so you can keep an outline above and references below while you write.`,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12,
  },
  {
    id: "journal-jan",
    name: "January",
    folderPath: "/Journal",
    ext: "md",
    content: `# January

A new year. The page is open.

> "Begin doing what you want to do now." — Marie Beynon Ray

What I want to write about this year:

- Slow mornings
- The light through the kitchen window
- The neighbour's cat
- Letters I never sent`,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    updatedAt: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: "draft-essay",
    name: "On attention",
    folderPath: "/Drafts",
    ext: "md",
    content: `# On attention

The first draft is mostly about getting the shape down. Don't fix the prose yet. Don't pick at the words. Pour it out and then walk away for an hour.

When you come back, read it aloud. The sentences that make you stumble are the sentences that need work.`,
    createdAt: Date.now() - 1000 * 60 * 30,
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
];

const SAMPLE_FOLDERS: FolderEntry[] = [
  { path: "/" },
  { path: "/Journal" },
  { path: "/Drafts" },
];

export type ExternalRoot = { uri: string; name: string };

type NotesContextValue = {
  notes: NoteFile[];
  folders: FolderEntry[];
  activeNoteId: string | null;
  activeNote: NoteFile | null;
  vaultName: string;
  externalRoot: ExternalRoot | null;
  externalLoading: boolean;
  setVaultName: (name: string) => void;
  setActiveNote: (id: string | null) => void;
  createNote: (folderPath?: string, name?: string) => Promise<NoteFile | null>;
  updateNoteContent: (id: string, content: string) => void;
  renameNote: (id: string, name: string) => void;
  moveNote: (id: string, folderPath: string) => void;
  deleteNote: (id: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  deleteFolder: (path: string) => void;
  notesInFolder: (folderPath: string) => NoteFile[];
  childFolders: (folderPath: string) => FolderEntry[];
  getNote: (id: string) => NoteFile | undefined;
  connectExternalFolder: () => Promise<boolean>;
  disconnectExternalFolder: () => void;
  refreshExternalFolder: () => Promise<void>;
  isSafSupported: boolean;
  // Cover images per folder path -> data: URI (or null if none/loading failed)
  covers: Record<string, string | null>;
  requestCover: (folderPath: string) => void;
  // Lazy-load file content (used by search)
  ensureLoaded: (id: string) => Promise<void>;
  // Force-flush all pending disk writes immediately
  flushPendingSaves: () => Promise<void>;
  // True once AsyncStorage hydration has finished
  hydrated: boolean;
};

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  // Vault state (used when not connected)
  const [vaultNotes, setVaultNotes] = useState<NoteFile[]>([]);
  const [vaultFolders, setVaultFolders] = useState<FolderEntry[]>([]);

  // External (SAF) state
  const [externalRoot, setExternalRoot] = useState<ExternalRoot | null>(null);
  const [externalNotes, setExternalNotes] = useState<NoteFile[]>([]);
  const [externalFolders, setExternalFolders] = useState<FolderEntry[]>([]);
  const [externalLoading, setExternalLoading] = useState(false);

  // Cover images: folderPath -> data URI (or null = none)
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  // Map folderPath -> raw cover SAF uri & ext (set during scan)
  const coverSourcesRef = useRef<Record<string, { uri: string; ext: string }>>({});
  const coverInflightRef = useRef<Set<string>>(new Set());

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [vaultName, setVaultNameState] = useState<string>("My Vault");
  const [hydrated, setHydrated] = useState(false);

  const safSupported = isAndroidSafSupported();
  const isExternal = externalRoot !== null;

  const notes = isExternal ? externalNotes : vaultNotes;
  const folders = isExternal ? externalFolders : vaultFolders;

  const writeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // In-memory content cache: keeps the latest typed content without calling
  // setVaultNotes on every 120ms autosave tick, which would re-render every
  // NotesContext subscriber on every keystroke and was the primary cause of
  // typing lag on documents longer than ~3k words.
  const contentCacheRef = useRef<Record<string, string>>({});
  // Stable mirror of vaultNotes for use inside async timer callbacks that
  // cannot safely close over the React state value.
  const vaultNotesRef = useRef<NoteFile[]>([]);
  const contentWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [n, f, a, v, ext] = await Promise.all([
          AsyncStorage.getItem(NOTES_KEY),
          AsyncStorage.getItem(FOLDERS_KEY),
          AsyncStorage.getItem(ACTIVE_NOTE_KEY),
          AsyncStorage.getItem(VAULT_NAME_KEY),
          AsyncStorage.getItem(EXTERNAL_ROOT_KEY),
        ]);
        if (n && f) {
          setVaultNotes(JSON.parse(n));
          setVaultFolders(JSON.parse(f));
        } else {
          setVaultNotes(SAMPLE_NOTES);
          setVaultFolders(SAMPLE_FOLDERS);
        }
        if (a) setActiveNoteId(a);
        else setActiveNoteId("welcome");
        if (v) setVaultNameState(v);
        if (ext) {
          const parsed = JSON.parse(ext) as ExternalRoot;
          setExternalRoot(parsed);
          // Load tree in background
          loadExternalTree(parsed).catch(() => {});
        }
      } catch (err) {
        console.warn("Failed to load notes", err);
        setVaultNotes(SAMPLE_NOTES);
        setVaultFolders(SAMPLE_FOLDERS);
        setActiveNoteId("welcome");
      } finally {
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist vault state.
  //
  // IMPORTANT: this writes the *entire* vault (every note's full content) to
  // AsyncStorage as one JSON blob. updateNoteContent() below calls
  // setVaultNotes() on every debounced autosave tick while the user types
  // (every ~120ms), so writing synchronously here re-serializes and
  // re-persists the whole vault â€” including every other note's content, not
  // just the one being edited â€” on every single autosave tick. As documents
  // (and the vault) grow, that JSON.stringify + disk write grows with them,
  // which is why typing got laggier specifically on longer documents. We
  // debounce the actual disk write here (state updates above stay
  // synchronous so the UI/word count never feels stale) and force an
  // immediate flush when the app backgrounds so nothing is lost.
  const vaultWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep vaultNotesRef in sync so timer callbacks always see the latest
  // structural state without closing over a stale array.
  useEffect(() => {
    vaultNotesRef.current = vaultNotes;
  }, [vaultNotes]);

  // Persist content cache to AsyncStorage without touching React state.
  // Called from updateNoteContent on every autosave tick; because it never
  // calls setVaultNotes, NotesContext subscribers never re-render mid-typing.
  const scheduleContentWrite = useCallback(() => {
    if (contentWriteTimerRef.current) clearTimeout(contentWriteTimerRef.current);
    contentWriteTimerRef.current = setTimeout(() => {
      contentWriteTimerRef.current = null;
      const snapshot = vaultNotesRef.current.map((n) => {
        const cached = contentCacheRef.current[n.id];
        return cached !== undefined
          ? { ...n, content: cached, updatedAt: Date.now() }
          : n;
      });
      AsyncStorage.setItem(NOTES_KEY, JSON.stringify(snapshot)).catch(() => {});
    }, 600);
  }, []);

  const flushVaultNotes = useCallback(() => {
    if (vaultWriteTimerRef.current) {
      clearTimeout(vaultWriteTimerRef.current);
      vaultWriteTimerRef.current = null;
    }
    if (contentWriteTimerRef.current) {
      clearTimeout(contentWriteTimerRef.current);
      contentWriteTimerRef.current = null;
    }
    // Merge cached content so the background flush always includes the
    // latest typed text, even if the user hasn't switched notes since typing.
    const snapshot = vaultNotesRef.current.map((n) => {
      const cached = contentCacheRef.current[n.id];
      return cached !== undefined
        ? { ...n, content: cached, updatedAt: Date.now() }
        : n;
    });
    AsyncStorage.setItem(NOTES_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (vaultWriteTimerRef.current) clearTimeout(vaultWriteTimerRef.current);
    vaultWriteTimerRef.current = setTimeout(() => {
      vaultWriteTimerRef.current = null;
      // Merge the content cache so structural saves (rename, create, delete)
      // don't overwrite content that was updated since the last note switch.
      const snapshot = vaultNotes.map((n) => {
        const cached = contentCacheRef.current[n.id];
        return cached !== undefined
          ? { ...n, content: cached, updatedAt: Date.now() }
          : n;
      });
      AsyncStorage.setItem(NOTES_KEY, JSON.stringify(snapshot)).catch(() => {});
    }, 600);
    return () => {
      if (vaultWriteTimerRef.current) clearTimeout(vaultWriteTimerRef.current);
    };
  }, [vaultNotes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(vaultFolders)).catch(
      () => {},
    );
  }, [vaultFolders, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(ACTIVE_NOTE_KEY, activeNoteId ?? "").catch(() => {});
  }, [activeNoteId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(VAULT_NAME_KEY, vaultName).catch(() => {});
  }, [vaultName, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (externalRoot) {
      AsyncStorage.setItem(
        EXTERNAL_ROOT_KEY,
        JSON.stringify(externalRoot),
      ).catch(() => {});
    } else {
      AsyncStorage.removeItem(EXTERNAL_ROOT_KEY).catch(() => {});
    }
  }, [externalRoot, hydrated]);

  // Load external tree from SAF
  const loadExternalTree = useCallback(
    async (root: ExternalRoot) => {
      if (!safSupported) return;
      setExternalLoading(true);
      try {
        const tree = await scanFolderTree(root.uri);
        // Hide folders that contain no text/markdown files anywhere in their
        // subtree (directly or via descendants) — an empty folder tree is
        // just noise in the explorer.
        const pathsWithFiles = new Set<string>();
        for (const f of tree.files) {
          let p = f.folderPath;
          while (true) {
            pathsWithFiles.add(p);
            if (p === "/" || !p.includes("/")) break;
            const idx = p.lastIndexOf("/");
            p = idx <= 0 ? "/" : p.slice(0, idx);
          }
        }
        const nonEmptyFolders = tree.folders.filter((f) =>
          pathsWithFiles.has(f.relativePath),
        );
        const folderEntries: FolderEntry[] = [
          { path: "/", externalUri: root.uri },
          ...nonEmptyFolders.map((f) => ({
            path: f.relativePath,
            externalUri: f.uri,
          })),
        ];
        const noteEntries: NoteFile[] = tree.files.map((f) => {
          const e = (f.ext || "").toLowerCase();
          const ext: "md" | "txt" =
            e === "md" || e === "mdown" || e === "markdown" ? "md" : "txt";
          return {
            id: `ext::${f.uri}`,
            name: f.name,
            folderPath: f.folderPath,
            ext,
            content: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            externalUri: f.uri,
            loaded: false,
          };
        });
        // Map covers per folder
        const covSrc: Record<string, { uri: string; ext: string }> = {};
        for (const cv of tree.covers) {
          covSrc[cv.folderPath] = { uri: cv.uri, ext: cv.ext || "jpg" };
        }
        coverSourcesRef.current = covSrc;
        // Reset cover state so prior data URIs aren't stale
        setCovers({});
        setExternalFolders(folderEntries);
        setExternalNotes(noteEntries);
      } catch (err) {
        console.warn("Failed to scan external folder", err);
        Alert.alert(
          "Folder error",
          "Couldn't read that folder. The permission may have been revoked — try reconnecting.",
        );
      } finally {
        setExternalLoading(false);
      }
    },
    [safSupported],
  );

  const connectExternalFolder = useCallback(async (): Promise<boolean> => {
    if (!safSupported) {
      Alert.alert(
        "Not supported here",
        "Picking a phone folder needs the Android version of Scribe. The in-app vault is fully usable.",
      );
      return false;
    }
    const result = await pickFolder();
    if (!result) return false;
    setExternalRoot(result);
    await loadExternalTree(result);
    setActiveNoteId(null);
    return true;
  }, [safSupported, loadExternalTree]);

  const disconnectExternalFolder = useCallback(() => {
    setExternalRoot(null);
    setExternalNotes([]);
    setExternalFolders([]);
    setActiveNoteId("welcome");
  }, []);

  const refreshExternalFolder = useCallback(async () => {
    if (externalRoot) await loadExternalTree(externalRoot);
  }, [externalRoot, loadExternalTree]);

  const ensureLoaded = useCallback(
    async (id: string): Promise<void> => {
      if (!isExternal) return;
      const note = externalNotes.find((n) => n.id === id);
      if (!note || !note.externalUri || note.loaded) return;
      try {
        const content = await safReadFile(note.externalUri);
        setExternalNotes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, content, loaded: true } : n,
          ),
        );
      } catch (err) {
        console.warn("Failed to read file", err);
        // Mark as loaded with empty content so we don't retry forever
        setExternalNotes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, loaded: true } : n,
          ),
        );
      }
    },
    [isExternal, externalNotes],
  );

  const setActiveNote = useCallback(
    (id: string | null) => {
      setActiveNoteId(id);
      if (id && isExternal) {
        const note = externalNotes.find((n) => n.id === id);
        if (note && note.externalUri && !note.loaded) {
          ensureLoaded(id).catch((err) => {
            console.warn("ensureLoaded failed", err);
            Alert.alert("Read error", "Couldn't read this file from disk.");
          });
        }
      }
    },
    [isExternal, externalNotes, ensureLoaded],
  );

  const requestCover = useCallback((folderPath: string) => {
    if (covers[folderPath] !== undefined) return;
    const src = coverSourcesRef.current[folderPath];
    if (!src) {
      setCovers((prev) => ({ ...prev, [folderPath]: null }));
      return;
    }
    if (coverInflightRef.current.has(folderPath)) return;
    coverInflightRef.current.add(folderPath);
    readImageAsDataUri(src.uri, src.ext)
      .then((dataUri) => {
        setCovers((prev) => ({ ...prev, [folderPath]: dataUri }));
      })
      .finally(() => {
        coverInflightRef.current.delete(folderPath);
      });
  }, [covers]);

  const flushPendingSaves = useCallback(async (): Promise<void> => {
    const ids = Object.keys(writeTimers.current);
    if (ids.length === 0) return;
    const writes: Promise<unknown>[] = [];
    for (const id of ids) {
      clearTimeout(writeTimers.current[id]);
      delete writeTimers.current[id];
      const note = externalNotes.find((n) => n.id === id);
      if (note?.externalUri) {
        writes.push(
          safWriteFile(note.externalUri, note.content).catch((err) =>
            console.warn("flush write failed", err),
          ),
        );
      }
    }
    await Promise.all(writes);
  }, [externalNotes]);

  // Force-flush on background / inactive
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        flushPendingSaves().catch(() => {});
        flushVaultNotes();
      }
    });
    return () => sub.remove();
  }, [flushPendingSaves, flushVaultNotes]);

  const setVaultName = useCallback((name: string) => {
    setVaultNameState(name);
  }, []);

  const createNote = useCallback(
    async (
      folderPath: string = "/",
      name: string = "Untitled",
    ): Promise<NoteFile | null> => {
      if (isExternal && externalRoot) {
        const target = externalFolders.find((f) => f.path === folderPath);
        const parentUri = target?.externalUri ?? externalRoot.uri;
        try {
          const { uri } = await safCreateFile(parentUri, name, "md");
          const note: NoteFile = {
            id: `ext::${uri}`,
            name,
            folderPath,
            ext: "md",
            content: "",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            externalUri: uri,
            loaded: true,
          };
          setExternalNotes((prev) => [note, ...prev]);
          setActiveNoteId(note.id);
          return note;
        } catch (err) {
          console.warn("Failed to create file", err);
          Alert.alert(
            "Create failed",
            "Couldn't create the file in the connected folder.",
          );
          return null;
        }
      }
      const note: NoteFile = {
        id: generateId(),
        name,
        folderPath,
        ext: "md",
        content: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setVaultNotes((prev) => [note, ...prev]);
      setActiveNoteId(note.id);
      return note;
    },
    [isExternal, externalRoot, externalFolders],
  );

  const updateNoteContent = useCallback(
    (id: string, content: string) => {
      if (isExternal) {
        // Cache content in memory without calling setExternalNotes, so the
        // sidebar and file tree don't re-render on every autosave tick while
        // the user is typing. State is updated once after the debounced disk
        // write completes, which is the right time for the UI to refresh.
        contentCacheRef.current[id] = content;
        const note = externalNotes.find((n) => n.id === id);
        if (note?.externalUri) {
          if (writeTimers.current[id]) clearTimeout(writeTimers.current[id]);
          writeTimers.current[id] = setTimeout(() => {
            const latest = contentCacheRef.current[id] ?? content;
            safWriteFile(note.externalUri!, latest).catch((err) => {
              console.warn("Failed to write file", err);
            });
            setExternalNotes((prev) =>
              prev.map((n) =>
                n.id === id
                  ? { ...n, content: latest, updatedAt: Date.now(), loaded: true }
                  : n,
              ),
            );
          }, 600);
        }
      } else {
        // Write to in-memory cache only — no setState, no context re-render.
        // Subscribers (sidebar, title bar, etc.) don't update on every
        // keystroke; content is flushed to AsyncStorage by scheduleContentWrite
        // and merged into vaultNotes state during structural operations.
        contentCacheRef.current[id] = content;
        scheduleContentWrite();
      }
    },
    [isExternal, externalNotes, scheduleContentWrite],
  );

  const renameNote = useCallback(
    (id: string, name: string) => {
      if (isExternal) {
        // SAF can't rename in place easily; update display only.
        setExternalNotes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, name, updatedAt: Date.now() } : n,
          ),
        );
        Alert.alert(
          "Rename note",
          "Note: renaming in a connected folder only changes the title in Scribe. The file on disk keeps its original filename. (Android limitation.)",
        );
        return;
      }
      setVaultNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, name, updatedAt: Date.now() } : n,
        ),
      );
    },
    [isExternal],
  );

  const moveNote = useCallback((id: string, folderPath: string) => {
    setVaultNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, folderPath, updatedAt: Date.now() } : n,
      ),
    );
  }, []);

  const deleteNote = useCallback(
    async (id: string) => {
      if (isExternal) {
        const note = externalNotes.find((n) => n.id === id);
        if (note?.externalUri) {
          try {
            await safDelete(note.externalUri);
          } catch (err) {
            console.warn("Failed to delete file", err);
            Alert.alert("Delete failed", "Couldn't delete the file on disk.");
            return;
          }
        }
        setExternalNotes((prev) => prev.filter((n) => n.id !== id));
        if (activeNoteId === id) setActiveNoteId(null);
        return;
      }
      setVaultNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeNoteId === id) setActiveNoteId(null);
    },
    [isExternal, externalNotes, activeNoteId],
  );

  const createFolder = useCallback(
    async (path: string) => {
      const cleaned = path.startsWith("/") ? path : `/${path}`;
      if (isExternal && externalRoot) {
        const folderName = cleaned.split("/").pop() ?? "";
        if (!folderName) return;
        try {
          const { uri } = await safCreateSubFolder(
            externalRoot.uri,
            folderName,
          );
          setExternalFolders((prev) => {
            if (prev.some((p) => p.path === cleaned)) return prev;
            return [...prev, { path: cleaned, externalUri: uri }];
          });
        } catch (err) {
          console.warn("Failed to make folder", err);
          Alert.alert(
            "Folder failed",
            "Couldn't create that folder. Try a simpler name.",
          );
        }
        return;
      }
      setVaultFolders((prev) => {
        if (prev.some((p) => p.path === cleaned)) return prev;
        return [...prev, { path: cleaned }];
      });
    },
    [isExternal, externalRoot],
  );

  const deleteFolder = useCallback(
    (path: string) => {
      if (path === "/") return;
      if (isExternal) return;
      setVaultFolders((prev) => prev.filter((f) => f.path !== path));
      setVaultNotes((prev) =>
        prev.map((n) =>
          n.folderPath === path ? { ...n, folderPath: "/" } : n,
        ),
      );
    },
    [isExternal],
  );

  const notesInFolder = useCallback(
    (folderPath: string) =>
      notes
        .filter((n) => n.folderPath === folderPath)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [notes],
  );

  const childFolders = useCallback(
    (folderPath: string): FolderEntry[] => {
      const prefix = folderPath === "/" ? "/" : `${folderPath}/`;
      return folders
        .filter((f) => {
          if (f.path === folderPath) return false;
          if (!f.path.startsWith(prefix)) return false;
          const rest = f.path.slice(prefix.length);
          return rest.length > 0 && !rest.includes("/");
        })
        .sort((a, b) => a.path.localeCompare(b.path));
    },
    [folders],
  );

  const getNote = useCallback(
    (id: string) => notes.find((n) => n.id === id),
    [notes],
  );

  const activeNote = useMemo(() => {
    if (!activeNoteId) return null;
    const note = notes.find((n) => n.id === activeNoteId) ?? null;
    if (!note) return null;
    // Content cache is always fresher than vaultNotes state. We only read
    // this at note-switch time (activeNoteId change) so the Editor can
    // initialize with the latest content; while typing, the Editor owns it.
    const cached = contentCacheRef.current[note.id];
    return cached !== undefined ? { ...note, content: cached } : note;
  }, [activeNoteId, notes]);

  const computedVaultName = isExternal && externalRoot ? externalRoot.name : vaultName;

  const value = useMemo(
    () => ({
      notes,
      folders,
      activeNoteId,
      activeNote,
      vaultName: computedVaultName,
      externalRoot,
      externalLoading,
      setVaultName,
      setActiveNote,
      createNote,
      updateNoteContent,
      renameNote,
      moveNote,
      deleteNote,
      createFolder,
      deleteFolder,
      notesInFolder,
      childFolders,
      getNote,
      connectExternalFolder,
      disconnectExternalFolder,
      refreshExternalFolder,
      isSafSupported: safSupported,
      covers,
      requestCover,
      ensureLoaded,
      flushPendingSaves,
      hydrated,
    }),
    [
      notes,
      folders,
      activeNoteId,
      activeNote,
      computedVaultName,
      externalRoot,
      externalLoading,
      setVaultName,
      setActiveNote,
      createNote,
      updateNoteContent,
      renameNote,
      moveNote,
      deleteNote,
      createFolder,
      deleteFolder,
      notesInFolder,
      childFolders,
      getNote,
      connectExternalFolder,
      disconnectExternalFolder,
      refreshExternalFolder,
      safSupported,
      covers,
      requestCover,
      ensureLoaded,
      flushPendingSaves,
      hydrated,
    ],
  );

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotes must be used inside NotesProvider");
  return ctx;
}
