import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "scribe.history.";
const MAX_SNAPSHOTS = 20;
const MIN_INTERVAL_MS = 3 * 60 * 1000;
const MIN_DIFF_CHARS = 40;

export type Snapshot = {
  content: string;
  savedAt: number;
};

export async function getSnapshots(noteId: string): Promise<Snapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + noteId);
    if (!raw) return [];
    return JSON.parse(raw) as Snapshot[];
  } catch {
    return [];
  }
}

// In-memory watermark of the last snapshot attempt per note, so most calls
// to maybeSnapshot() can bail out without ever touching AsyncStorage.
//
// maybeSnapshot() is called from the editor's autosave tick (every ~120ms
// while the user types) for every note, including long ones. Before this
// guard, EVERY call read the note's full snapshot list from disk and
// JSON.parse'd it (up to 20 stored snapshots, each up to a full chapter of
// text) just to check the time/diff gate below â€” real disk I/O and parsing
// of potentially large strings on almost every keystroke pause, which is
// most noticeable (and most expensive) on long documents. Since the gate
// only needs the last snapshot's timestamp and length, we cache those
// in memory after the first read/write and use them to skip the round trip
// entirely when neither condition can be met.
const lastSnapshotMeta = new Map<string, { savedAt: number; length: number }>();

export async function maybeSnapshot(
  noteId: string,
  content: string,
): Promise<void> {
  const cached = lastSnapshotMeta.get(noteId);
  if (cached) {
    const timeOk = Date.now() - cached.savedAt >= MIN_INTERVAL_MS;
    const diffOk = Math.abs(content.length - cached.length) >= MIN_DIFF_CHARS;
    if (!timeOk && !diffOk) return;
  }
  try {
    const snaps = await getSnapshots(noteId);
    const last = snaps[snaps.length - 1];
    if (last) {
      const timeOk = Date.now() - last.savedAt >= MIN_INTERVAL_MS;
      const diffOk =
        Math.abs(content.length - last.content.length) >= MIN_DIFF_CHARS;
      if (!timeOk && !diffOk) {
        lastSnapshotMeta.set(noteId, {
          savedAt: last.savedAt,
          length: last.content.length,
        });
        return;
      }
      if (last.content === content) return;
    }
    const savedAt = Date.now();
    const next = [...snaps, { content, savedAt }].slice(-MAX_SNAPSHOTS);
    await AsyncStorage.setItem(PREFIX + noteId, JSON.stringify(next));
    lastSnapshotMeta.set(noteId, { savedAt, length: content.length });
  } catch {
    // best-effort
  }
}

export async function clearSnapshots(noteId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + noteId);
    lastSnapshotMeta.delete(noteId);
  } catch {
    // ignore
  }
}
