import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const SAF = FileSystem.StorageAccessFramework;

const TEXT_EXTS = new Set([
  "md",
  "mdown",
  "markdown",
  "txt",
  "text",
  "log",
  "rst",
]);
const COVER_RE = /^cover\.(jpe?g|png|webp|gif)$/i;
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export type SafFolder = {
  uri: string;
  relativePath: string;
};

export type SafFile = {
  uri: string;
  name: string;
  ext: string;
  folderPath: string;
};

export type SafCover = {
  folderPath: string;
  uri: string;
  ext: string;
};

export type SafTree = {
  folders: SafFolder[];
  files: SafFile[];
  covers: SafCover[];
};

export const isAndroidSafSupported = (): boolean =>
  Platform.OS === "android" && !!SAF;

function decodeFilename(uri: string): string {
  try {
    const docPart = uri.split("/document/")[1] ?? uri.split("/tree/")[1] ?? uri;
    const decoded = decodeURIComponent(docPart);
    const afterColon = decoded.includes(":")
      ? decoded.slice(decoded.indexOf(":") + 1)
      : decoded;
    const lastSlash = afterColon.lastIndexOf("/");
    const result = lastSlash >= 0 ? afterColon.slice(lastSlash + 1) : afterColon;
    return result || "Untitled";
  } catch {
    return "Untitled";
  }
}

function splitNameExt(filename: string): { name: string; ext: string } {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return { name: filename, ext: "" };
  return {
    name: filename.slice(0, dot),
    ext: filename.slice(dot + 1).toLowerCase(),
  };
}

export async function pickFolder(): Promise<{
  uri: string;
  name: string;
} | null> {
  if (!isAndroidSafSupported()) return null;
  const perms = await SAF.requestDirectoryPermissionsAsync();
  if (!perms.granted) return null;
  const uri = perms.directoryUri;
  const name = decodeFilename(uri);
  return { uri, name };
}

// Extensions we treat as a strong enough signal on their own to skip the
// expensive readDirectoryAsync probe below. This list intentionally covers
// every extension scanFolderTree actually looks at (text notes, covers,
// generic images) plus a handful of very common "obviously a file" types —
// it does not need to be exhaustive, since anything not on this list still
// falls through to the slower but fully correct probe path.
const LIKELY_FILE_EXTS = new Set([
  ...TEXT_EXTS,
  ...IMAGE_EXTS,
  "pdf",
  "doc",
  "docx",
  "zip",
  "json",
  "csv",
  "mp3",
  "mp4",
  "wav",
]);

async function classifyEntry(
  uri: string,
  filename: string,
): Promise<"dir" | "file" | "unknown"> {
  // Real Android SAF directories are identified by the provider reporting
  // MIME type `vnd.android.document/directory`. getInfoAsync's isDirectory
  // is only as good as that MIME type — the "connect phone storage" /
  // external-storage document providers (as opposed to the app's own local
  // SAF tree) frequently do NOT set that MIME type correctly on real
  // folders, so getInfoAsync comes back with isDirectory:false (or
  // undefined) for a folder that is, in fact, a folder. Treating that
  // negative as trustworthy was the bug: real folders from those providers
  // got fabricated into fake .txt files before we ever tried the more
  // reliable directory probe below.
  //
  // So: a *positive* isDirectory is trusted immediately (cheap, and never
  // wrong in practice). A *negative or missing* isDirectory is NOT
  // trusted on its own — we always confirm it with an actual
  // readDirectoryAsync probe, which is the one operation Android SAF
  // guarantees only succeeds on real directories, regardless of what the
  // provider claims via MIME type.
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      const isDir = (info as { isDirectory?: boolean }).isDirectory;
      if (isDir === true) return "dir";
    }
  } catch {
    // Fall through to probe.
  }

  // The readDirectoryAsync probe below is a real content-provider round
  // trip per entry -- on a tree with hundreds of notes/images that adds up
  // to the multi-second "stuck on Reading Folders" delay. A filename with a
  // recognized extension is an extremely strong, essentially-free signal
  // that the entry is a file (real folders showing up from these providers
  // are consistently extension-less in practice), so skip the probe
  // entirely for those and only pay for it on the genuinely ambiguous
  // (extension-less) entries.
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
  if (ext && LIKELY_FILE_EXTS.has(ext)) return "file";

  // Authoritative probe: succeeds only for real directories. Throws for
  // files *and* for some legitimate directories on certain SAF providers
  // (e.g. when the probe itself is denied/flaky) — we can't tell those two
  // cases apart here, so we report "unknown" and let the caller decide
  // based on filename rather than assuming "file" unconditionally, which
  // is what used to fabricate real folders into fake .txt notes.
  try {
    await SAF.readDirectoryAsync(uri);
    return "dir";
  } catch {
    return "unknown";
  }
}

export async function scanFolderTree(rootUri: string): Promise<SafTree> {
  if (!isAndroidSafSupported())
    return { folders: [], files: [], covers: [] };

  const folders: SafFolder[] = [];
  const files: SafFile[] = [];
  const covers: SafCover[] = [];

  async function visit(uri: string, relativePath: string): Promise<void> {
    let entries: string[] = [];
    try {
      entries = await SAF.readDirectoryAsync(uri);
    } catch (err) {
      console.warn("readDirectoryAsync failed for", relativePath, err);
      return;
    }

    // Classify with higher concurrency now that most entries resolve via
    // the cheap extension fast-path in classifyEntry and never touch the
    // network/IPC-bound readDirectoryAsync probe at all. The old BATCH=8
    // throttle existed to be kind to Android when *every* entry paid for a
    // probe; that's no longer the common case, so a larger batch (mainly
    // relevant for the extension-less entries that still need the probe)
    // no longer risks hammering the content provider.
    const BATCH = 24;
    const classified: {
      uri: string;
      filename: string;
      kind: "dir" | "file" | "unknown";
    }[] = [];
    for (let i = 0; i < entries.length; i += BATCH) {
      const slice = entries.slice(i, i + BATCH);
      const r = await Promise.all(
        slice.map(async (entryUri) => {
          const filename = decodeFilename(entryUri);
          return {
            uri: entryUri,
            filename,
            kind: await classifyEntry(entryUri, filename),
          };
        }),
      );
      classified.push(...r);
    }

    // Collect subfolders to recurse into and fire all of that recursion off
    // concurrently rather than one folder at a time — a deep/wide tree used
    // to pay for every subfolder's round trip sequentially before even
    // starting the next sibling, which is most of what made "Reading
    // Folders" feel like it hung on real device trees.
    const subVisits: Promise<void>[] = [];

    for (const { uri: entryUri, filename, kind } of classified) {
      const { name, ext } = splitNameExt(filename);

      const recurseAsFolder = () => {
        const folderName = filename || "Folder";
        const childPath =
          relativePath === "/"
            ? `/${folderName}`
            : `${relativePath}/${folderName}`;
        folders.push({ uri: entryUri, relativePath: childPath });
        subVisits.push(visit(entryUri, childPath));
      };

      if (kind === "dir") {
        recurseAsFolder();
        continue;
      }

      if (kind === "unknown") {
        // Ambiguous entry: the directory probe failed but that also happens
        // for legitimate folders on some SAF providers. An extension is a
        // strong signal it's really a file; extension-less entries are far
        // more likely to be folders, so recurse into them as a folder
        // instead of fabricating a bogus .txt note. Worst case we get an
        // empty folder entry, which is harmless — unlike corrupting a real
        // directory into a fake writable note.
        if (!ext) {
          recurseAsFolder();
          continue;
        }
      }

      if (COVER_RE.test(filename)) {
        covers.push({ folderPath: relativePath, uri: entryUri, ext });
        continue;
      }
      if (TEXT_EXTS.has(ext)) {
        files.push({
          uri: entryUri,
          name,
          ext,
          folderPath: relativePath,
        });
      } else if (!ext && kind === "file") {
        // No extension but confirmed to be a real file (not a probe
        // failure) — treat as text file, useful for plain notes.
        files.push({
          uri: entryUri,
          name: filename,
          ext: "txt",
          folderPath: relativePath,
        });
      }
      // Other binary files (images, pdfs, etc.) are skipped silently
      void IMAGE_EXTS; // eslint-disable-line @typescript-eslint/no-unused-expressions
    }

    await Promise.all(subVisits);
  }

  await visit(rootUri, "/");
  return { folders, files, covers };
}

export async function readFile(uri: string): Promise<string> {
  return await SAF.readAsStringAsync(uri);
}

export async function writeFile(uri: string, content: string): Promise<void> {
  await SAF.writeAsStringAsync(uri, content);
}

export async function readImageAsDataUri(
  uri: string,
  ext: string,
): Promise<string | null> {
  if (!isAndroidSafSupported()) return null;
  try {
    const base64 = await SAF.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.warn("Failed to read cover image", err);
    return null;
  }
}

export async function createFile(
  parentUri: string,
  name: string,
  ext: "md" | "txt",
): Promise<{ uri: string }> {
  const mimeType = ext === "md" ? "text/markdown" : "text/plain";
  const uri = await SAF.createFileAsync(parentUri, name, mimeType);
  return { uri };
}

export async function createSubFolder(
  parentUri: string,
  folderName: string,
): Promise<{ uri: string }> {
  const uri = await SAF.makeDirectoryAsync(parentUri, folderName);
  return { uri };
}

export async function deleteUri(uri: string): Promise<void> {
  await SAF.deleteAsync(uri);
}
