import { Feather } from "@expo/vector-icons";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputSelectionChangeEventData,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { FONT_FAMILY_MAP } from "@/constants/defaultThemes";
import { useNotes } from "@/contexts/NotesContext";
import { LINE_SPACING_MAP, usePanels } from "@/contexts/PanelsContext";
import type { Shortcut } from "@/contexts/ShortcutsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countWords, readingTimeMinutes } from "@/lib/markdown";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useWritingStats } from "@/contexts/WritingStatsContext";
import {
  clearRecoveryBuffer,
  getRecoveryBuffer,
  saveRecoveryBuffer,
} from "@/lib/recovery";
import { maybeSnapshot } from "@/lib/history";
import { FindReplaceBar, type FindMatch } from "@/components/FindReplaceBar";

const PAIR_OPEN_TO_CLOSE: Record<string, string> = {
  '"': '"',
  "'": "'",
  "(": ")",
  "[": "]",
  "{": "}",
  "`": "`",
  "\u201c": "\u201d",
  "\u2018": "\u2019",
  "«": "»",
};

const CLOSE_CHARS = new Set(Object.values(PAIR_OPEN_TO_CLOSE));

const HISTORY_LIMIT = 200;
const HISTORY_GROUP_MS = 700;

// A window of characters checked immediately around an anchor guess before
// trusting it as the real diff boundary.
const DIFF_CHECK_WINDOW = 8;
// How far the boundary is allowed to have drifted from the anchor guess
// (e.g. autocomplete nudging a word) before the fast path still counts as a
// hit. Beyond this we assume the guess just doesn't apply and fall back.
const DIFF_LOCAL_SCAN_LIMIT = 200;

// Ordinary typing/deleting/auto-pairing only ever changes text right at the
// caret, but a naive common-prefix scan starting at index 0 has to walk
// every unchanged character before the caret to discover that — on a long
// document with the caret near the end, that's an O(document length) scan
// on *every keystroke*, which is exactly what made typing feel laggy (and
// therefore made typewriter-scroll/cursor tracking visibly desync) on long
// notes. Anchoring the scan at the caret's last known position turns the
// common case into an O(1) check; we only fall back to the full scan when
// the anchor turns out to be wrong (e.g. autocomplete rewriting more than
// just the character at the caret), which is rare and no slower than the
// old behavior.
function commonPrefixLen(
  oldText: string,
  newText: string,
  anchorGuess: number,
): number {
  const minLen = Math.min(oldText.length, newText.length);
  const guess = Math.max(0, Math.min(anchorGuess, minLen));

  const checkFrom = Math.max(0, guess - DIFF_CHECK_WINDOW);
  let guessValid = true;
  for (let i = checkFrom; i < guess; i++) {
    if (oldText.charCodeAt(i) !== newText.charCodeAt(i)) {
      guessValid = false;
      break;
    }
  }

  if (guessValid) {
    let p = guess;
    while (
      p < minLen &&
      p - guess < DIFF_LOCAL_SCAN_LIMIT &&
      oldText.charCodeAt(p) === newText.charCodeAt(p)
    ) {
      p++;
    }
    if (p === minLen || p - guess < DIFF_LOCAL_SCAN_LIMIT) return p;
  }

  // Fallback: full scan from the start. Only reached when the anchor guess
  // didn't hold up, so this is not a regression versus the old behavior.
  let p = 0;
  while (p < minLen && oldText.charCodeAt(p) === newText.charCodeAt(p)) p++;
  return p;
}

// Mirror of commonPrefixLen for the trailing (unchanged tail) side of the
// edit. `maxLen` is the remaining room after the prefix has already been
// excluded; `anchorGuess` is the expected unchanged-tail length assuming
// the edit didn't touch anything after the caret's old selection end.
function commonSuffixLen(
  oldText: string,
  newText: string,
  maxLen: number,
  anchorGuess: number,
): number {
  const guess = Math.max(0, Math.min(anchorGuess, maxLen));

  let guessValid = true;
  for (let i = 0; i < DIFF_CHECK_WINDOW && i < guess; i++) {
    const oi = oldText.length - 1 - i;
    const ni = newText.length - 1 - i;
    if (oldText.charCodeAt(oi) !== newText.charCodeAt(ni)) {
      guessValid = false;
      break;
    }
  }

  if (guessValid) {
    let s = guess;
    while (
      s < maxLen &&
      s - guess < DIFF_LOCAL_SCAN_LIMIT &&
      oldText.charCodeAt(oldText.length - 1 - s) ===
        newText.charCodeAt(newText.length - 1 - s)
    ) {
      s++;
    }
    if (s === maxLen || s - guess < DIFF_LOCAL_SCAN_LIMIT) return s;
  }

  let s = 0;
  while (
    s < maxLen &&
    oldText.charCodeAt(oldText.length - 1 - s) ===
      newText.charCodeAt(newText.length - 1 - s)
  ) {
    s++;
  }
  return s;
}

type Selection = { start: number; end: number };

export type EditorHandle = {
  applyShortcut: (s: Shortcut) => void;
  focus: () => void;
  insertText: (text: string) => void;
  undo: () => void;
  redo: () => void;
  flush: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  toggleFindReplace: () => void;
  jumpToLine: (lineIndex: number) => void;
};

type EditorProps = {
  noteId: string;
  initialContent: string;
  autoFocus?: boolean;
  // Distance to keep between the caret and the keyboard, in px. Should
  // reflect whatever real chrome (e.g. the shortcut bar) sits between this
  // scroll view and the keyboard — the caller measures that and passes it
  // in, rather than us guessing a fixed number that drifts out of sync with
  // the actual layout and produces mis-scrolled/"cursor out of view" jumps.
  bottomOffset?: number;
  onChangeContent?: (content: string) => void;
  onSelectionChange?: (sel: Selection) => void;
  onUndoRedoChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  registerHandle?: (h: EditorHandle | null) => void;
};

export function Editor({
  noteId,
  initialContent,
  autoFocus = false,
  bottomOffset = 120,
  onChangeContent,
  onSelectionChange,
  onUndoRedoChange,
  registerHandle,
}: EditorProps) {
  const { activeTheme } = useTheme();
  const { updateNoteContent } = useNotes();
  const { showWordCount, typewriterMode, lineSpacing, editorFontSize } =
    usePanels();
  const { dailyGoal, todayWords, goalReached, recordWordDelta } =
    useWritingStats();
  const c = activeTheme.colors;

  const [content, setContent] = useState(initialContent);
  const [savedTick, setSavedTick] = useState(0);
  const [collapsedCount, setCollapsedCount] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [recoveryOffer, setRecoveryOffer] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);
  const scrollViewHeightRef = useRef(0);
  const lastWordCountRef = useRef(countWords(initialContent));
  const goalCelebratedRef = useRef(false);
  const goalPulse = useRef(new Animated.Value(0)).current;
  const cursorRef = useRef<Selection>({
    start: initialContent.length,
    end: initialContent.length,
  });
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(
    undefined,
  );
  const inputRef = useRef<TextInput>(null);
  // Tracks whether the TextInput currently holds native focus. The
  // shortcut bar (and the undo/redo buttons) can be tapped without ever
  // focusing the editor first -- e.g. right after opening a note before
  // tapping into the body text. In that state `cursorRef` still holds
  // whatever it was initialized to and there is no visible caret, so an
  // insertion can land somewhere the user never intended (commonly read as
  // "it inserts at the end of the file"). Forcing focus first guarantees a
  // real, visible caret exists before we insert relative to it.
  const isFocusedRef = useRef(false);
  const lastSavedRef = useRef<string>(initialContent);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the mount-reset effect below so it only ever runs once per real
  // note switch, never on our own autosave round-trip re-render.
  const mountedNoteIdRef = useRef<string | null>(null);
  const lastLineIndexRef = useRef<number>(-1);
  const scrollYAnim = useRef(new Animated.Value(0)).current;
  const isAutoScrollingRef = useRef(false);
  // Mirror props in refs so callbacks can read current values without
  // needing to be recreated on every prop change (avoids cascading deps).
  const typewriterModeRef = useRef(typewriterMode);
  const activeThemeRef = useRef(activeTheme);
  useEffect(() => {
    typewriterModeRef.current = typewriterMode;
  }, [typewriterMode]);
  useEffect(() => {
    activeThemeRef.current = activeTheme;
  }, [activeTheme]);
  // Tracks the live soft-keyboard height via real OS show/hide events rather
  // than relying on the container's onLayout height changing. Android is
  // configured with softwareKeyboardLayoutMode="pan" (required for
  // react-native-keyboard-controller to own keyboard-avoidance without the
  // OS double-resizing underneath it) — under "pan" the outer window never
  // resizes, so scrollViewHeightRef stays at the full un-shrunk screen
  // height even while the keyboard covers the bottom portion of it. Without
  // subtracting the real keyboard height here, typewriter mode would center
  // the active line against the *full* screen instead of the visible area
  // above the keyboard, pushing it down behind the keys.
  const keyboardHeightRef = useRef(0);
  const [debouncedStatsContent, setDebouncedStatsContent] = useState(content);

  // Undo / redo history
  const historyRef = useRef<{
    past: string[];
    future: string[];
    lastChangeAt: number;
  }>({
    past: [],
    future: [],
    lastChangeAt: 0,
  });

  const notifyUndoRedo = useCallback(() => {
    onUndoRedoChange?.({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  }, [onUndoRedoChange]);

  // Initialize editor state exactly once per genuine note switch.
  //
  // IMPORTANT: the parent mounts <Editor key={activeNote.id} .../>, so a real
  // note switch already fully remounts this component and re-initializes all
  // useState/useRef initial values above. This effect's only remaining job is
  // the one-time recovery-buffer check. It must NOT depend on `initialContent`
  // (which changes identity after every autosave round-trip as the parent's
  // `activeNote.content` updates) or it re-fires on every keystroke's save
  // cycle, which used to reset the cursor to end-of-text, wipe undo history,
  // and re-trigger the recovery banner while the user was still typing.
  useEffect(() => {
    if (mountedNoteIdRef.current === noteId) return;
    mountedNoteIdRef.current = noteId;

    lastLineIndexRef.current = -1;
    scrollYAnim.setValue(0);
    setFindReplaceOpen(false);
    setRecoveryOffer(null);

    getRecoveryBuffer(noteId).then((buf) => {
      if (
        buf &&
        buf.content !== initialContent &&
        buf.content.trim().length > 0
      ) {
        setRecoveryOffer(buf.content);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Continuously persist a crash-recovery buffer as the user types
  useEffect(() => {
    const t = setTimeout(() => {
      saveRecoveryBuffer(noteId, content).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [noteId, content]);

  // Track net word-count delta against the writing-stats tracker (goal + streak)
  const applyWordDelta = useCallback(
    (savedContent: string) => {
      const newCount = countWords(savedContent);
      const delta = newCount - lastWordCountRef.current;
      lastWordCountRef.current = newCount;
      recordWordDelta(delta);
    },
    [recordWordDelta],
  );

  // Force-save helper
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (lastSavedRef.current !== content) {
      lastSavedRef.current = content;
      updateNoteContent(noteId, content);
      onChangeContent?.(content);
      setSavedTick((t) => t + 1);
      applyWordDelta(content);
      maybeSnapshot(noteId, content).catch(() => {});
    }
  }, [content, noteId, updateNoteContent, onChangeContent, applyWordDelta]);

  // Schedule debounced save on every content change (100ms)
  useEffect(() => {
    if (lastSavedRef.current === content) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSavedRef.current = content;
      updateNoteContent(noteId, content);
      onChangeContent?.(content);
      setSavedTick((t) => t + 1);
      applyWordDelta(content);
      maybeSnapshot(noteId, content).catch(() => {});
    }, 120);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, noteId, updateNoteContent, onChangeContent, applyWordDelta]);

  // Save when component unmounts or note id changes
  useEffect(() => {
    return () => {
      if (lastSavedRef.current !== content) {
        updateNoteContent(noteId, content);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Clear forced selection after one render cycle
  useEffect(() => {
    if (!forcedSelection) return;
    const t = setTimeout(() => setForcedSelection(undefined), 30);
    return () => clearTimeout(t);
  }, [forcedSelection]);

  // Track real keyboard height for typewriter centering (see
  // keyboardHeightRef comment above) — these OS events fire regardless of
  // softwareKeyboardLayoutMode, unlike onLayout.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => {
      keyboardHeightRef.current = e.endCoordinates?.height ?? 0;
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      keyboardHeightRef.current = 0;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Word count / char count / reading time are only cosmetic and don't need
  // to recompute on every keystroke -- on long documents, running
  // countWords/readingTimeMinutes over the *entire* text synchronously in
  // render on every keystroke was adding measurable input lag. Debounce the
  // value they read from instead of the calculation itself, so typing stays
  // on the fast path and the displayed numbers settle a moment after a
  // pause, same cadence as the other secondary-sync work in this file.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedStatsContent(content), 500);
    return () => clearTimeout(t);
  }, [content]);

  // Drives a smooth, spring-eased typewriter scroll. Takes the *authoritative*
  // text and cursor position directly (never reads the `content` state
  // closure) so it can be called synchronously from handleChangeText with
  // data that is guaranteed current, instead of waiting for a React render
  // and a separate onSelectionChange event — that stale-closure race was the
  // cause of the oscillating/jittery scroll in typewriter mode.
  const runTypewriterScroll = useCallback(
    (text: string, pos: number) => {
      if (!typewriterMode || !scrollRef.current) return;
      const lineIndex = text.slice(0, pos).split("\n").length - 1;
      if (lineIndex === lastLineIndexRef.current) return;
      lastLineIndexRef.current = lineIndex;

      const lineHeightPx = activeTheme.fontSize * activeTheme.lineHeight;
      const lineY = lineIndex * lineHeightPx + activeTheme.paddingVertical;
      const visibleHeight = Math.max(
        120,
        scrollViewHeightRef.current - keyboardHeightRef.current,
      );
      const targetY = Math.max(0, lineY - visibleHeight / 2 + lineHeightPx / 2);

      isAutoScrollingRef.current = true;
      scrollYAnim.stopAnimation();
      scrollYAnim.removeAllListeners();
      scrollYAnim.addListener(({ value }) => {
        scrollRef.current?.scrollTo({ y: value, animated: false });
      });
      Animated.spring(scrollYAnim, {
        toValue: targetY,
        speed: 16,
        bounciness: 0,
        useNativeDriver: false,
      }).start(() => {
        isAutoScrollingRef.current = false;
      });
    },
    [typewriterMode, activeTheme, scrollYAnim],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      // Android can fire a final onSelectionChange reporting a
      // reset/collapsed selection (e.g. 0,0 or end-of-text) as part of
      // losing focus -- before the corresponding onBlur has flipped
      // isFocusedRef. Accepting that value into cursorRef would silently
      // corrupt the "last real cursor position" that shortcut-bar inserts
      // rely on, surfacing later as "insert landed at the wrong place" even
      // though the user never touched the shortcut bar while unfocused.
      // Only trust selection updates while the input genuinely has focus.
      if (!isFocusedRef.current) return;
      cursorRef.current = e.nativeEvent.selection;
      onSelectionChange?.(e.nativeEvent.selection);
      // Covers cursor moves that aren't text edits (taps, arrow keys) — edits
      // are handled synchronously inside handleChangeText instead.
      if (!isAutoScrollingRef.current) {
        runTypewriterScroll(content, e.nativeEvent.selection.start);
      }
    },
    [onSelectionChange, content, runTypewriterScroll],
  );

  // Moves the caret both in React state (so re-renders stay consistent) and
  // imperatively via setNativeProps (so the native EditText snaps to the new
  // position on this exact frame instead of waiting a render cycle for the
  // `selection` prop to land). Android paints the raw keystroke immediately;
  // without the synchronous setNativeProps call, any programmatic correction
  // (smart-enter, auto-pair, shortcut-bar insert, undo/redo, etc.) was only
  // visible after React's next render, producing a visible flash/jump. It
  // also closes the race where `forcedSelection` cleared itself (30ms below)
  // before native had applied it, which is what let a busy JS thread on long
  // documents "lose" the correction and leave the OS to default the caret to
  // the end of the text.
  const setCursor = useCallback((position: number) => {
    cursorRef.current = { start: position, end: position };
    setForcedSelection({ start: position, end: position });
    inputRef.current?.setNativeProps({
      selection: { start: position, end: position },
    });
  }, []);

  // Like setCursor, but also imperatively pushes a corrected `text` value to
  // the native view. Used by the smart-pair/smart-enter/skip-over paths in
  // handleChangeText, where we're overriding the exact keystroke Android
  // just rendered a frame ago.
  const correctNative = useCallback((text: string, position: number) => {
    cursorRef.current = { start: position, end: position };
    setForcedSelection({ start: position, end: position });
    inputRef.current?.setNativeProps({
      text,
      selection: { start: position, end: position },
    });
  }, []);

  // Snap the scroll view to keep `position` visible immediately after a
  // programmatic text correction (smart-enter, skip-over, auto-pair).
  // KeyboardAwareScrollView's Reanimated worklet runs on the UI thread and
  // fires *before* our JS correction lands, so it briefly scrolls to the
  // wrong line. Calling this right after correctNative counteracts that
  // pre-correction scroll and returns the viewport to the correct line
  // in the same JS turn, minimising the visible jump to at most one frame.
  // Skipped in typewriter mode where runTypewriterScroll owns scrolling.
  const snapScrollToCursor = useCallback((text: string, position: number) => {
    if (typewriterModeRef.current || !scrollRef.current) return;
    const theme = activeThemeRef.current;
    const lineIndex = text.slice(0, position).split("\n").length - 1;
    const lineHeightPx = theme.fontSize * theme.lineHeight;
    const lineY = lineIndex * lineHeightPx + theme.paddingVertical;
    const visibleH = Math.max(
      120,
      scrollViewHeightRef.current - keyboardHeightRef.current,
    );
    const targetY = Math.max(0, lineY - visibleH * 0.35);
    scrollRef.current.scrollTo({ y: targetY, animated: false });
  }, []);

  const pushHistory = useCallback(
    (prev: string) => {
      const now = Date.now();
      const h = historyRef.current;
      const grouped =
        h.past.length > 0 && now - h.lastChangeAt < HISTORY_GROUP_MS;
      if (!grouped) {
        h.past.push(prev);
        if (h.past.length > HISTORY_LIMIT) h.past.shift();
      }
      h.future = [];
      h.lastChangeAt = now;
      notifyUndoRedo();
    },
    [notifyUndoRedo],
  );

  const handleChangeText = useCallback(
    (newText: string) => {
      const oldText = content;
      const lenDiff = newText.length - oldText.length;

      // Single-char insertion: smart pair / smart enter / skip-over
      if (lenDiff === 1) {
        const diffPos = commonPrefixLen(
          oldText,
          newText,
          cursorRef.current.start,
        );
        const insertedChar = newText[diffPos] ?? "";
        const charAfterCursor = oldText[diffPos] ?? "";

        // Smart enter: cursor sits just before a closing bracket/quote;
        // skip past the close char instead of inserting a newline.
        // snapScrollToCursor fires immediately after the correction to
        // counteract the KAScrollView pre-correction scroll that already
        // moved the viewport one line down before our JS handler ran.
        if (insertedChar === "\n" && CLOSE_CHARS.has(charAfterCursor)) {
          setContent(oldText);
          correctNative(oldText, diffPos + 1);
          runTypewriterScroll(oldText, diffPos + 1);
          snapScrollToCursor(oldText, diffPos + 1);
          return;
        }
        // Auto-pair
        if (PAIR_OPEN_TO_CLOSE[insertedChar]) {
          const closeChar = PAIR_OPEN_TO_CLOSE[insertedChar];
          if (charAfterCursor !== closeChar) {
            pushHistory(oldText);
            const updated =
              newText.slice(0, diffPos + 1) +
              closeChar +
              newText.slice(diffPos + 1);
            setContent(updated);
            correctNative(updated, diffPos + 1);
            runTypewriterScroll(updated, diffPos + 1);
            return;
          }
        }
        // Skip-over: typing a close char when one already follows the cursor.
        // Same snap-scroll treatment as smart-enter.
        if (CLOSE_CHARS.has(insertedChar) && charAfterCursor === insertedChar) {
          setContent(oldText);
          correctNative(oldText, diffPos + 1);
          runTypewriterScroll(oldText, diffPos + 1);
          snapScrollToCursor(oldText, diffPos + 1);
          return;
        }
      }

      pushHistory(oldText);
      // Fix 1 — paste lag: large insertions (pastes) are marked as
      // non-urgent via startTransition so React can yield to the UI
      // thread during the re-render, keeping the app responsive.
      // The threshold (200 chars) is high enough to avoid affecting
      // normal typing and auto-correct but catches any real paste.
      const lenDiffAbs = Math.abs(lenDiff);
      if (lenDiffAbs > 200) {
        startTransition(() => setContent(newText));
      } else {
        setContent(newText);
      }
      // Estimate the post-edit cursor position from the common prefix/suffix
      // between old and new text — the same authoritative newText the input
      // just reported, not a stale `content` closure — so typewriter scroll
      // tracks the real edit instead of chasing a value that's about to
      // change again on the next keystroke. Both scans are anchored near
      // the caret's last known position instead of always starting at index
      // 0 / the very end — see commonPrefixLen/commonSuffixLen for why that
      // matters on long documents.
      const minLen = Math.min(oldText.length, newText.length);
      const prefix = commonPrefixLen(
        oldText,
        newText,
        cursorRef.current.start,
      );
      const maxSuffix = minLen - prefix;
      const suffix = commonSuffixLen(
        oldText,
        newText,
        maxSuffix,
        oldText.length - cursorRef.current.end,
      );
      const estimatedCursor = newText.length - suffix;
      runTypewriterScroll(newText, estimatedCursor);
    },
    [content, correctNative, pushHistory, runTypewriterScroll, snapScrollToCursor],
  );

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Shared guard for shortcut-bar-triggered edits (applyShortcut, insertText):
  // if the editor never had focus this session, `cursorRef` is still sitting
  // at whatever it was initialized to rather than a position the user chose,
  // so force focus first. On Android, focusing a multiline TextInput without
  // an explicit selection places the caret at the end of the text, which
  // matches cursorRef's own initial default -- so this makes the "insert
  // lands at the end when nothing was focused yet" behavior consistent and
  // visible (a blinking caret at the end) rather than a silent surprise.
  const ensureFocused = useCallback(() => {
    if (!isFocusedRef.current) {
      inputRef.current?.focus();
    }
  }, []);

  const applyShortcut = useCallback(
    (s: Shortcut) => {
      ensureFocused();
      const start = cursorRef.current.start;
      const end = cursorRef.current.end;
      const before = content.slice(0, start);
      const middle = content.slice(start, end);
      const after = content.slice(end);

      pushHistory(content);

      if (s.kind === "insert") {
        const updated = before + s.payload + after;
        setContent(updated);
        setCursor(start + s.payload.length);
        return;
      }
      if (s.kind === "wrap" || s.kind === "pair") {
        const open = s.payload;
        const close = s.closing ?? s.payload;
        if (middle.length > 0) {
          const updated = before + open + middle + close + after;
          setContent(updated);
          setCursor(end + open.length + close.length);
        } else {
          const updated = before + open + close + after;
          setContent(updated);
          setCursor(start + open.length);
        }
      }
    },
    [content, setCursor, pushHistory, ensureFocused],
  );

  const insertText = useCallback(
    (text: string) => {
      ensureFocused();
      const start = cursorRef.current.start;
      const end = cursorRef.current.end;
      pushHistory(content);
      const updated = content.slice(0, start) + text + content.slice(end);
      setContent(updated);
      setCursor(start + text.length);
    },
    [content, setCursor, pushHistory, ensureFocused],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(content);
    if (h.future.length > HISTORY_LIMIT) h.future.shift();
    setContent(prev);
    setCursor(prev.length);
    notifyUndoRedo();
  }, [content, setCursor, notifyUndoRedo]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(content);
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    setContent(next);
    setCursor(next.length);
    notifyUndoRedo();
  }, [content, setCursor, notifyUndoRedo]);

  const toggleFindReplace = useCallback(() => {
    setFindReplaceOpen((v) => !v);
  }, []);

  // Jump the cursor + scroll to a given line — used by the Outline tab in the
  // right panel. Unlike runTypewriterScroll (gated on typewriterMode so it
  // doesn't fight manual scrolling while typing), this always scrolls once,
  // since it's an explicit user navigation action.
  const jumpToLine = useCallback(
    (lineIndex: number) => {
      const lines = content.split("\n");
      const clamped = Math.max(0, Math.min(lineIndex, lines.length - 1));
      const pos = lines.slice(0, clamped).reduce((n, l) => n + l.length + 1, 0);
      setCursor(pos);
      focus();

      if (!scrollRef.current) return;
      const lineHeightPx = activeTheme.fontSize * activeTheme.lineHeight;
      const lineY = clamped * lineHeightPx + activeTheme.paddingVertical;
      const targetY = Math.max(0, lineY - 40);
      lastLineIndexRef.current = clamped;
      isAutoScrollingRef.current = true;
      scrollYAnim.stopAnimation();
      scrollYAnim.removeAllListeners();
      scrollYAnim.addListener(({ value }) => {
        scrollRef.current?.scrollTo({ y: value, animated: false });
      });
      Animated.spring(scrollYAnim, {
        toValue: targetY,
        speed: 16,
        bounciness: 0,
        useNativeDriver: false,
      }).start(() => {
        isAutoScrollingRef.current = false;
      });
    },
    [content, setCursor, focus, activeTheme, scrollYAnim],
  );

  // Expose handle to parent
  useEffect(() => {
    registerHandle?.({
      applyShortcut,
      focus,
      insertText,
      undo,
      redo,
      flush: flushSave,
      canUndo: () => historyRef.current.past.length > 0,
      canRedo: () => historyRef.current.future.length > 0,
      toggleFindReplace,
      jumpToLine,
    });
    return () => registerHandle?.(null);
  }, [
    registerHandle,
    applyShortcut,
    focus,
    insertText,
    undo,
    redo,
    flushSave,
    toggleFindReplace,
    jumpToLine,
  ]);

  const handleFindJump = useCallback((match: FindMatch) => {
    cursorRef.current = { start: match.start, end: match.end };
    setForcedSelection({ start: match.start, end: match.end });
  }, []);

  const handleReplaceOne = useCallback(
    (match: FindMatch, replacement: string) => {
      pushHistory(content);
      const updated =
        content.slice(0, match.start) + replacement + content.slice(match.end);
      setContent(updated);
      const pos = match.start + replacement.length;
      setCursor(pos);
    },
    [content, pushHistory, setCursor],
  );

  const handleReplaceAll = useCallback(
    (query: string, replacement: string, caseSensitive: boolean): number => {
      if (!query) return 0;
      const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escapeRe(query), "g" + (caseSensitive ? "" : "i"));
      const matches = content.match(re);
      if (!matches || matches.length === 0) return 0;
      pushHistory(content);
      const updated = content.replace(re, replacement);
      setContent(updated);
      return matches.length;
    },
    [content, pushHistory],
  );

  const acceptRecovery = useCallback(() => {
    if (recoveryOffer === null) return;
    pushHistory(content);
    setContent(recoveryOffer);
    setCursor(recoveryOffer.length);
    setRecoveryOffer(null);
    clearRecoveryBuffer(noteId).catch(() => {});
  }, [recoveryOffer, content, pushHistory, setCursor, noteId]);

  const dismissRecovery = useCallback(() => {
    setRecoveryOffer(null);
    clearRecoveryBuffer(noteId).catch(() => {});
  }, [noteId]);

  const fontFamily = FONT_FAMILY_MAP[activeTheme.fontFamily];
  const effectiveFontSize =
    editorFontSize > 0 ? editorFontSize : activeTheme.fontSize;
  const effectiveLineHeightRatio = LINE_SPACING_MAP[lineSpacing];
  const lineHeightPx = effectiveFontSize * effectiveLineHeightRatio;

  const stats = useMemo(
    () => ({
      words: countWords(debouncedStatsContent),
      chars: debouncedStatsContent.length,
      mins: readingTimeMinutes(debouncedStatsContent),
    }),
    [debouncedStatsContent],
  );

  const goalProgress = dailyGoal > 0 ? Math.min(1, todayWords / dailyGoal) : 0;

  useEffect(() => {
    if (goalReached && !goalCelebratedRef.current) {
      goalCelebratedRef.current = true;
      Animated.sequence([
        Animated.timing(goalPulse, {
          toValue: 1,
          duration: 220,
          useNativeDriver: false,
        }),
        Animated.timing(goalPulse, {
          toValue: 0,
          duration: 420,
          useNativeDriver: false,
        }),
      ]).start();
    }
    if (!goalReached) goalCelebratedRef.current = false;
  }, [goalReached, goalPulse]);

  const goalBarHeight = goalPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 6],
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.goalTrack, { backgroundColor: c.border }]}>
        <Animated.View
          style={[
            styles.goalFill,
            {
              width: `${goalProgress * 100}%`,
              height: goalBarHeight,
              backgroundColor: goalReached ? "#22c55e" : c.accent,
            },
          ]}
        />
      </View>
      {findReplaceOpen ? (
        <FindReplaceBar
          content={content}
          onClose={() => setFindReplaceOpen(false)}
          onJump={handleFindJump}
          onReplaceOne={handleReplaceOne}
          onReplaceAll={handleReplaceAll}
        />
      ) : null}

      {recoveryOffer !== null ? (
        <View
          style={[
            styles.recoveryBanner,
            { backgroundColor: c.surface, borderColor: c.accent },
          ]}
        >
          <Feather name="alert-triangle" size={14} color={c.accent} />
          <Text style={[styles.recoveryText, { color: c.text }]} numberOfLines={2}>
            We found unsaved changes from before. Restore them?
          </Text>
          <Pressable onPress={acceptRecovery} hitSlop={6}>
            <Text style={[styles.recoveryAction, { color: c.accent }]}>
              Restore
            </Text>
          </Pressable>
          <Pressable onPress={dismissRecovery} hitSlop={6}>
            <Feather name="x" size={16} color={c.mutedText} />
          </Pressable>
        </View>
      ) : null}

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: activeTheme.paddingHorizontal,
            paddingVertical: activeTheme.paddingVertical,
            paddingBottom: typewriterMode ? 300 : 80,
          },
        ]}
        onLayout={(e) => {
          scrollViewHeightRef.current = e.nativeEvent.layout.height;
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bottomOffset={bottomOffset}
        // While typewriter mode is active, our own runTypewriterScroll
        // above already drives an authoritative centered-scroll on every
        // line change. Leaving this library's own selection-driven
        // auto-scroll enabled at the same time meant two independent
        // systems raced to scroll to two different target offsets on every
        // keystroke that advanced a line (Enter, and auto-paired
        // quotes/brackets both count) -- that fight was the jitter/jump
        // reported when typing quotes or pressing Enter. Disabling this
        // one while typewriter mode owns the scroll leaves a single
        // authority in charge; the static `paddingBottom: 300` above
        // already reserves enough room for the keyboard in that mode.
        enabled={!typewriterMode}
        // Also lock out manual touch-scrolling in typewriter mode. A user
        // drag that nudges the scroll offset used to fight the very next
        // programmatic re-center on the next line change -- two authorities
        // disagreeing about the scroll position one frame apart is exactly
        // what reads as "bounce"/oscillation. Typewriter mode's whole
        // premise is that scroll position is not manual, so give
        // runTypewriterScroll sole ownership while it's on.
        scrollEnabled={!typewriterMode}
      >
        <View
          style={{
            width: "100%",
            maxWidth: activeTheme.maxWidth,
            alignSelf: "center",
          }}
        >
          {previewMode ? (
            <Pressable onPress={() => setPreviewMode(false)}>
              <MarkdownPreview
                content={content}
                textColor={c.text}
                mutedColor={c.mutedText}
                accentColor={c.accent}
                fontFamily={fontFamily}
                fontSize={activeTheme.fontSize}
                lineHeight={activeTheme.lineHeight}
                letterSpacing={activeTheme.letterSpacing}
              />
            </Pressable>
          ) : (
            <TextInput
              ref={inputRef}
              value={content}
              onChangeText={handleChangeText}
              onSelectionChange={handleSelectionChange}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              selection={forcedSelection}
              autoFocus={autoFocus}
              multiline
              textAlignVertical="top"
              autoCorrect
              autoCapitalize="sentences"
              spellCheck
              placeholder="Begin writing…"
              placeholderTextColor={c.mutedText}
              selectionColor={c.selection}
              underlineColorAndroid="transparent"
              scrollEnabled={false}
              // Stops Android from forcing the input into a full-screen edit
              // overlay on some devices/keyboard combos (notably landscape
              // or small screens), which otherwise briefly tears the editor
              // away from this layout entirely on focus -- read as a jump.
              disableFullscreenUI
              style={[
                styles.input,
                {
                  color: c.text,
                  fontFamily,
                  fontSize: effectiveFontSize,
                  lineHeight: lineHeightPx,
                  letterSpacing: activeTheme.letterSpacing,
                  minHeight: 400,
                  ...(Platform.OS === "web"
                    ? ({
                        outlineWidth: 0,
                        outlineStyle: "none",
                      } as object)
                    : {}),
                },
              ]}
            />
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Write / Read mode toggle */}
      <Pressable
        onPress={() => setPreviewMode((p) => !p)}
        style={[
          styles.previewToggle,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
        accessibilityLabel={previewMode ? "Switch to write mode" : "Switch to preview mode"}
      >
        <Feather
          name={previewMode ? "edit-3" : "eye"}
          size={14}
          color={c.text}
        />
      </Pressable>

      {/* Floating word count */}
      {showWordCount && !collapsedCount ? (
        <Pressable
          onPress={() => setCollapsedCount(true)}
          style={[
            styles.wordCount,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}
        >
          <Feather name="edit-2" size={10} color={c.mutedText} />
          <Text style={[styles.wordCountText, { color: c.text }]}>
            {stats.words.toLocaleString()} words
          </Text>
          <Text style={[styles.wordCountMuted, { color: c.mutedText }]}>
            · {stats.chars.toLocaleString()} ch · {stats.mins} min
          </Text>
          {savedTick > 0 ? (
            <View
              style={[styles.savedDot, { backgroundColor: c.accent }]}
            />
          ) : null}
        </Pressable>
      ) : showWordCount && collapsedCount ? (
        <Pressable
          onPress={() => setCollapsedCount(false)}
          style={[
            styles.wordCountTiny,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[styles.wordCountText, { color: c.mutedText }]}>
            {stats.words}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  goalTrack: {
    width: "100%",
    height: 3,
    overflow: "visible",
  },
  goalFill: {
    borderRadius: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  input: {
    width: "100%",
    padding: 0,
    margin: 0,
    borderWidth: 0,
  },
  previewToggle: {
    position: "absolute",
    top: 10,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  wordCount: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  wordCountTiny: {
    position: "absolute",
    bottom: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.7,
  },
  wordCountText: {
    fontSize: 11,
    fontWeight: "600",
  },
  wordCountMuted: {
    fontSize: 10,
  },
  savedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  recoveryBanner: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 50,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  recoveryText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  recoveryAction: {
    fontSize: 12,
    fontWeight: "700",
  },
});
