import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "scribe.recovery.";

export type RecoveryBuffer = {
  content: string;
  savedAt: number;
};

export async function saveRecoveryBuffer(
  noteId: string,
  content: string,
): Promise<void> {
  try {
    const buf: RecoveryBuffer = { content, savedAt: Date.now() };
    await AsyncStorage.setItem(PREFIX + noteId, JSON.stringify(buf));
  } catch {
    // best-effort only
  }
}

export async function getRecoveryBuffer(
  noteId: string,
): Promise<RecoveryBuffer | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + noteId);
    if (!raw) return null;
    return JSON.parse(raw) as RecoveryBuffer;
  } catch {
    return null;
  }
}

export async function clearRecoveryBuffer(noteId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + noteId);
  } catch {
    // ignore
  }
}
