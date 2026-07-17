import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const GOAL_KEY = "scribe.dailyGoal.v1";
const STREAK_KEY = "scribe.streak.v1";
const DAILY_WORDS_PREFIX = "scribe.dailyWords.";

const DEFAULT_GOAL = 500;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastWriteDate: string | null;
};

type WritingStatsValue = {
  dailyGoal: number;
  setDailyGoal: (n: number) => void;
  todayWords: number;
  goalReached: boolean;
  sessionWords: number;
  currentStreak: number;
  longestStreak: number;
  // Call with the net new word delta (can be negative) whenever a save happens.
  recordWordDelta: (delta: number) => void;
};

const WritingStatsContext = createContext<WritingStatsValue | null>(null);

export function WritingStatsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dailyGoal, setDailyGoalState] = useState(DEFAULT_GOAL);
  const [todayWords, setTodayWords] = useState(0);
  const [sessionWords, setSessionWords] = useState(0);
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastWriteDate: null,
  });
  const [hydrated, setHydrated] = useState(false);
  const celebratedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const today = todayStr();
        const [goal, streakRaw, wordsRaw] = await Promise.all([
          AsyncStorage.getItem(GOAL_KEY),
          AsyncStorage.getItem(STREAK_KEY),
          AsyncStorage.getItem(DAILY_WORDS_PREFIX + today),
        ]);
        if (goal) {
          const n = parseInt(goal, 10);
          if (!Number.isNaN(n) && n > 0) setDailyGoalState(n);
        }
        let s: StreakData = {
          currentStreak: 0,
          longestStreak: 0,
          lastWriteDate: null,
        };
        if (streakRaw) {
          try {
            s = { ...s, ...JSON.parse(streakRaw) };
          } catch {
            // ignore malformed data
          }
        }
        // Reconcile streak on launch
        if (s.lastWriteDate === today) {
          // no change
        } else if (s.lastWriteDate === yesterdayStr()) {
          // streak continues, but only increments once real writing happens today
        } else if (s.lastWriteDate !== null) {
          s = { ...s, currentStreak: 0 };
        }
        setStreak(s);
        if (wordsRaw) {
          const n = parseInt(wordsRaw, 10);
          if (!Number.isNaN(n)) setTodayWords(Math.max(0, n));
        }
      } catch (err) {
        console.warn("Failed to load writing stats", err);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setDailyGoal = useCallback((n: number) => {
    const clamped = Math.max(50, Math.round(n));
    setDailyGoalState(clamped);
    AsyncStorage.setItem(GOAL_KEY, String(clamped)).catch(() => {});
  }, []);

  const recordWordDelta = useCallback((delta: number) => {
    if (!delta) return;
    setSessionWords((s) => Math.max(0, s + delta));
    setTodayWords((prev) => {
      const next = Math.max(0, prev + delta);
      const today = todayStr();
      AsyncStorage.setItem(DAILY_WORDS_PREFIX + today, String(next)).catch(
        () => {},
      );
      return next;
    });
    if (delta > 0) {
      setStreak((prev) => {
        const today = todayStr();
        if (prev.lastWriteDate === today) return prev;
        const wasYesterday = prev.lastWriteDate === yesterdayStr();
        const nextCurrent = wasYesterday ? prev.currentStreak + 1 : 1;
        const nextLongest = Math.max(prev.longestStreak, nextCurrent);
        const next: StreakData = {
          currentStreak: nextCurrent,
          longestStreak: nextLongest,
          lastWriteDate: today,
        };
        AsyncStorage.setItem(STREAK_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    }
  }, []);

  const goalReached = todayWords >= dailyGoal;

  useEffect(() => {
    if (goalReached && !celebratedRef.current) {
      celebratedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (!goalReached) celebratedRef.current = false;
  }, [goalReached]);

  const value = useMemo<WritingStatsValue>(
    () => ({
      dailyGoal,
      setDailyGoal,
      todayWords,
      goalReached,
      sessionWords,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      recordWordDelta,
    }),
    [
      dailyGoal,
      setDailyGoal,
      todayWords,
      goalReached,
      sessionWords,
      streak,
      recordWordDelta,
    ],
  );

  if (!hydrated) {
    return (
      <WritingStatsContext.Provider value={value}>
        {children}
      </WritingStatsContext.Provider>
    );
  }

  return (
    <WritingStatsContext.Provider value={value}>
      {children}
    </WritingStatsContext.Provider>
  );
}

export function useWritingStats() {
  const ctx = useContext(WritingStatsContext);
  if (!ctx)
    throw new Error("useWritingStats must be used inside WritingStatsProvider");
  return ctx;
}
