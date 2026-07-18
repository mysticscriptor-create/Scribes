import { Feather } from "@expo/vector-icons";
import React, {
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
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  cancelAnimation,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

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
  // Height of the shortcut bar so scroll calculations can subtract it from
  // the visible area. Without this, centering logic thinks the visible area
  // is larger than it is and places the cursor behind the bar.
  shortcutBarHeight?: number;
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
  shortcutBarHeight: shortcutBarHeightProp = 0,
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

  // `content` state is used ONLY for:
  //   - MarkdownPreview (synced when entering preview mode)
  //   - FindReplaceBar search (synced when opening find/replace)
  //   - Programmatic corrections (auto-pair, smart-enter, undo/redo,
  //     applyShortcut, insertText, find/replace replacements)
  //
  // It is NOT updated on every normal keystroke. The TextInput is
  // uncontrolled (no `value` prop), so the native layer manages its own
  // display during typing. This eliminates the per-keystroke JS→native
  // bridge round-trip of the full document string, which was the primary
  // cause of typing lag on documents longer than ~3 k words.
  const [content, setContent] = useState(initialContent);
  // contentRef is the single source of truth during typing — always current,
  // no bridge round-trip, accessible from any callback without closures.
  const contentRef = useRef(initialContent);
  const [savedTick, setSavedTick] = useState(0);
  const [collapsedCount, setCollapsedCount] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [recoveryOffer, setRecoveryOffer] = useState<string | null>(null);
  // debouncedStatsContent drives the word-count / reading-time display.
  // Updated in scheduleSave (~500 ms after the last keystroke) so heavy
  // countWords() calls don't run synchronously on every keystroke.
  const [debouncedStatsContent, setDebouncedStatsContent] = useState(initialContent);
  const scrollRef = useAnimatedRef<any>();
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
  // Shared value drives the typewriter / jumpToLine scroll entirely on the
  // Reanimated UI thread, so JS-thread pressure during fast typing cannot
  // cause animation frame drops that leave the cursor out of view.
  const scrollTargetY = useSharedValue(0);
  const isAutoScrollingRef = useRef(false);
  // Mirror props in refs so callbacks can read current values without
  // needing to be recreated on every prop change (avoids cascading deps).
  const typewriterModeRef = useRef(typewriterMode);
  const activeThemeRef = useRef(activeTheme);
  // Shortcut bar height in a ref so scroll calculations can subtract it from
  // the visible area without the callbacks needing to be recreated on resize.
  const shortcutBarHeightRef = useRef(shortcutBarHeightProp);
  // iOS Enter-key interception flag: set by onKeyPress when the cursor sits
  // before a close char, cleared by handleChangeText after it reverts the
  // newline. This allows the correction to be pre-signalled before the
  // onChangeText event fires, reducing the one-frame cursor flicker on iOS.
  const pendingEnterSkipRef = useRef(false);

  useEffect(() => {
    typewriterModeRef.current = typewriterMode;
  }, [typewriterMode]);
  useEffect(() => {
    activeThemeRef.current = activeTheme;
  }, [activeTheme]);
  useEffect(() => {
    shortcutBarHeightRef.current = shortcutBarHeightProp;
  }, [shortcutBarHeightProp]);
  // Effective font-size and line-height ratio: mirror the panel overrides so
  // all scroll calculations (typewriter centering, snapScrollToCursor,
  // jumpToLine) use the values the TextInput actually renders at, not the
  // raw theme defaults. Without these refs the centering drifts whenever the
  // user picks a custom font size or line spacing.
  const effectiveFontSizeRef = useRef(
    editorFontSize > 0 ? editorFontSize : activeTheme.fontSize,
  );
  const effectiveLineHeightRatioRef = useRef(LINE_SPACING_MAP[lineSpacing]);
  useEffect(() => {
    effectiveFontSizeRef.current =
      editorFontSize > 0 ? editorFontSize : activeTheme.fontSize;
  }, [editorFontSize, activeTheme.fontSize]);
  useEffect(() => {
    effectiveLineHeightRatioRef.current = LINE_SPACING_MAP[lineSpacing];
  }, [lineSpacing]);

  // Bridge: called from the Reanimated UI thread via runOnJS after a spring
  // animation completes, to reset the JS-side auto-scroll guard.
  const setNotAutoScrolling = useCallback(() => {
    isAutoScrollingRef.current = false;
  }, []);

  // Drive the scroll view from scrollTargetY on the UI thread. withSpring
  // sets the target; this reaction fires on every interpolated frame without
  // touching the JS thread, so fast typing can never stall the animation.
  useAnimatedReaction(
    () => scrollTargetY.value,
    (y) => {
      scrollTo(scrollRef, 0, y, false);
    },
  );

  // Tracks the live soft-keyboard height via real OS show/hide events.
  const keyboardHeightRef = useRef(0);

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
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

  // Undo / redo history
  const historyRef = useRef<{
    past: { text: string; cursor: number }[];
    future: { text: string; cursor: number }[];
    lastChangeAt: number;
  }>({
    past: [],
    future: [],
    lastChangeAt: 0,
  });

  // Track last-sent undo/redo booleans so we only call onUndoRedoChange when
  // the values actually change. Without this, pushHistory (called on every
  // normal keystroke) triggers a HomeScreen re-render on every key press even
  // when canUndo/canRedo haven't changed — re-rendering the toolbar, shortcut
  // bar, and all buttons each time.
  const lastUndoRedoRef = useRef({ canUndo: false, canRedo: false });

  const notifyUndoRedo = useCallback(() => {
    const canUndo = historyRef.current.past.length > 0;
    const canRedo = historyRef.current.future.length > 0;
    if (
      lastUndoRedoRef.current.canUndo === canUndo &&
      lastUndoRedoRef.current.canRedo === canRedo
    ) {
      return;
    }
    lastUndoRedoRef.current = { canUndo, canRedo };
    onUndoRedoChange?.({ canUndo, canRedo });
  }, [onUndoRedoChange]);

  // Initialize editor state exactly once per genuine note switch.
  useEffect(() => {
    if (mountedNoteIdRef.current === noteId) return;
    mountedNoteIdRef.current = noteId;

    lastLineIndexRef.current = -1;
    scrollTargetY.value = 0;
    setFindReplaceOpen(false);
    setRecoveryOffer(null);

    getRecoveryBuffer(noteId).then((buf) => {
      if (
        buf &&
        buf.content !== initialContent &&
        buf.content.trim().length > 0 &&
        buf.content.length >= initialContent.length
      ) {
        setRecoveryOffer(buf.content);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Track net word-count delta against the writing-stats tracker.
  const applyWordDelta = useCallback(
    (savedContent: string) => {
      const newCount = countWords(savedContent);
      const delta = newCount - lastWordCountRef.current;
      lastWordCountRef.current = newCount;
      recordWordDelta(delta);
    },
    [recordWordDelta],
  );

  // Debounced save — replaces the old content-state-driven useEffect.
  // Called from handleChangeText (normal typing) and all programmatic edits
  // (undo, redo, applyShortcut, insertText, find/replace). Reads from
  // contentRef.current at fire time so it always saves the latest text even
  // if rapid edits happened during the debounce window.
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const current = contentRef.current;
      if (lastSavedRef.current === current) return;
      lastSavedRef.current = current;
      updateNoteContent(noteId, current);
      onChangeContent?.(current);
      setSavedTick((t) => t + 1);
      applyWordDelta(current);
      maybeSnapshot(noteId, current).catch(() => {});
      saveRecoveryBuffer(noteId, current).catch(() => {});
      // Update stats display at the same cadence as the save. Previously
      // driven by a separate useEffect watching content state, which no
      // longer fires every keystroke with the uncontrolled TextInput.
      setDebouncedStatsContent(current);
    }, 500);
  }, [noteId, updateNoteContent, onChangeContent, applyWordDelta]);

  // Force-save helper exposed via EditorHandle.flush()
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const current = contentRef.current;
    if (lastSavedRef.current !== current) {
      lastSavedRef.current = current;
      updateNoteContent(noteId, current);
      onChangeContent?.(current);
      setSavedTick((t) => t + 1);
      applyWordDelta(current);
      maybeSnapshot(noteId, current).catch(() => {});
    }
  }, [noteId, updateNoteContent, onChangeContent, applyWordDelta]);

  // Save on unmount / note switch (catches unsaved changes when the user
  // navigates away before the debounce fires).
  useEffect(() => {
    return () => {
      if (lastSavedRef.current !== contentRef.current) {
        updateNoteContent(noteId, contentRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Clear forced selection after one render cycle so it doesn't permanently
  // override the user's next tap position.
  useEffect(() => {
    if (!forcedSelection) return;
    const t = setTimeout(() => setForcedSelection(undefined), 30);
    return () => clearTimeout(t);
  }, [forcedSelection]);

  // Drives a smooth, spring-eased typewriter scroll that keeps the active
  // line vertically centred in the visible area above the keyboard.
  const runTypewriterScroll = useCallback(
    (text: string, pos: number) => {
      if (!typewriterMode || !scrollRef.current) return;
      const lineIndex = text.slice(0, pos).split("\n").length - 1;
      if (lineIndex === lastLineIndexRef.current) return;
      lastLineIndexRef.current = lineIndex;

      const lineHeightPx =
        effectiveFontSizeRef.current * effectiveLineHeightRatioRef.current;
      const lineY =
        lineIndex * lineHeightPx + activeThemeRef.current.paddingVertical;
      // Subtract both the keyboard AND the shortcut bar from the available
      // height. The shortcut bar lives above the keyboard via KeyboardStickyView
      // but below the scroll view, so without subtracting it the centering
      // calculation thinks there's more visible room than there actually is,
      // pushing the active line behind the bar.
      const visibleHeight = Math.max(
        120,
        scrollViewHeightRef.current -
          keyboardHeightRef.current -
          shortcutBarHeightRef.current,
      );
      const targetY = Math.max(
        0,
        lineY - visibleHeight / 2 + lineHeightPx / 2,
      );

      isAutoScrollingRef.current = true;
      cancelAnimation(scrollTargetY);
      scrollTargetY.value = withSpring(
        targetY,
        { mass: 0.4, damping: 22, stiffness: 200 },
        () => {
          "worklet";
          runOnJS(setNotAutoScrolling)();
        },
      );
    },
    [typewriterMode, setNotAutoScrolling],
  );

  const handleSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      if (!isFocusedRef.current) return;
      cursorRef.current = e.nativeEvent.selection;
      onSelectionChange?.(e.nativeEvent.selection);
      // Read from contentRef instead of the `content` state closure so this
      // callback is not recreated on every keystroke. contentRef is always
      // current regardless of whether React state has caught up.
      runTypewriterScroll(contentRef.current, e.nativeEvent.selection.start);
    },
    [onSelectionChange, runTypewriterScroll],
  );

  // Moves the caret both in React state (so re-renders stay consistent) and
  // imperatively via setNativeProps (so the native text view snaps to the new
  // position on this exact frame instead of waiting a render cycle).
  const setCursor = useCallback((position: number) => {
    cursorRef.current = { start: position, end: position };
    setForcedSelection({ start: position, end: position });
    inputRef.current?.setNativeProps({
      selection: { start: position, end: position },
    });
  }, []);

  // Like setCursor, but also imperatively pushes a corrected `text` value to
  // the native view. Used by the smart-pair/smart-enter/skip-over paths and
  // all programmatic edits (undo, redo, applyShortcut, insertText).
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
  // Skipped in typewriter mode where runTypewriterScroll owns scrolling.
  const snapScrollToCursor = useCallback((text: string, position: number) => {
    if (typewriterModeRef.current || !scrollRef.current) return;
    const lineIndex = text.slice(0, position).split("\n").length - 1;
    const lineHeightPx =
      effectiveFontSizeRef.current * effectiveLineHeightRatioRef.current;
    const lineY =
      lineIndex * lineHeightPx + activeThemeRef.current.paddingVertical;
    // Subtract shortcut bar so the cursor lands in the truly visible area.
    const visibleH = Math.max(
      120,
      scrollViewHeightRef.current -
        keyboardHeightRef.current -
        shortcutBarHeightRef.current,
    );
    const targetY = Math.max(0, lineY - visibleH * 0.4);
    scrollRef.current.scrollTo({ y: targetY, animated: false });
  }, []);

  const pushHistory = useCallback(
    (prev: string) => {
      const now = Date.now();
      const h = historyRef.current;
      const grouped =
        h.past.length > 0 && now - h.lastChangeAt < HISTORY_GROUP_MS;
      if (!grouped) {
        h.past.push({ text: prev, cursor: cursorRef.current.start });
        if (h.past.length > HISTORY_LIMIT) h.past.shift();
      }
      h.future = [];
      h.lastChangeAt = now;
      notifyUndoRedo();
    },
    [notifyUndoRedo],
  );

  // iOS Enter-key interception — fires BEFORE onChangeText on iOS soft
  // keyboards. When the cursor sits before a closing bracket/quote, we
  // pre-signal the smart-enter correction so handleChangeText can revert the
  // newline as early as possible in the event pipeline, reducing the
  // one-frame cursor flicker. On Android the soft keyboard does not fire
  // onKeyPress reliably for Enter, so we rely on onChangeText there.
  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (Platform.OS !== "ios") return;
      if (e.nativeEvent.key !== "Enter") return;
      const pos = cursorRef.current.start;
      // Only act on a collapsed cursor — a selection should produce a normal
      // newline replacing the selected text.
      if (pos !== cursorRef.current.end) return;
      const charAfterCursor = contentRef.current[pos] ?? "";
      if (!CLOSE_CHARS.has(charAfterCursor)) return;
      // Pre-position the cursor past the close char. The native text view
      // will still insert the newline (we can't preventDefault in RN), but
      // handleChangeText reverts it in the same JS turn, minimising the
      // visible flash.
      pendingEnterSkipRef.current = true;
      setCursor(pos + 1);
    },
    [setCursor],
  );

  const handleChangeText = useCallback(
    (newText: string) => {
      const oldText = contentRef.current;
      const lenDiff = newText.length - oldText.length;

      // ── Single-character insertion ────────────────────────────────────────
      if (lenDiff === 1) {
        const diffPos = commonPrefixLen(
          oldText,
          newText,
          cursorRef.current.start,
        );
        const insertedChar = newText[diffPos] ?? "";
        const charAfterCursor = oldText[diffPos] ?? "";

        // Smart enter: cursor sits just before a closing bracket/quote.
        // pendingEnterSkipRef may already be set by onKeyPress (iOS).
        if (insertedChar === "\n" && CLOSE_CHARS.has(charAfterCursor)) {
          pendingEnterSkipRef.current = false;
          // contentRef stays unchanged (revert to oldText).
          correctNative(oldText, diffPos + 1);
          runTypewriterScroll(oldText, diffPos + 1);
          snapScrollToCursor(oldText, diffPos + 1);
          return;
        }
        pendingEnterSkipRef.current = false;

        // Auto-pair: insert matching close char after the open char.
        if (PAIR_OPEN_TO_CLOSE[insertedChar]) {
          const closeChar = PAIR_OPEN_TO_CLOSE[insertedChar];
          if (charAfterCursor !== closeChar) {
            pushHistory(oldText);
            const updated =
              newText.slice(0, diffPos + 1) +
              closeChar +
              newText.slice(diffPos + 1);
            contentRef.current = updated;
            // Reset lastLineIndexRef so runTypewriterScroll always fires on
            // pair insertion even when the line number hasn't changed.
            // Without this the early-exit guard short-circuits and the view
            // is left un-centred after the pair is inserted.
            if (typewriterModeRef.current) {
              lastLineIndexRef.current = -1;
            }
            correctNative(updated, diffPos + 1);
            runTypewriterScroll(updated, diffPos + 1);
            snapScrollToCursor(updated, diffPos + 1);
            scheduleSave();
            return;
          }
        }

        // Skip-over: typing a close char when one already follows the cursor.
        if (CLOSE_CHARS.has(insertedChar) && charAfterCursor === insertedChar) {
          if (typewriterModeRef.current) {
            lastLineIndexRef.current = -1;
          }
          correctNative(oldText, diffPos + 1);
          runTypewriterScroll(oldText, diffPos + 1);
          snapScrollToCursor(oldText, diffPos + 1);
          return;
        }
      } else {
        pendingEnterSkipRef.current = false;
      }

      // ── Paired backspace: delete both halves of an empty auto-pair ────────
      if (lenDiff === -1) {
        const bpDiffPos = commonPrefixLen(
          oldText,
          newText,
          cursorRef.current.start,
        );
        const deletedChar = oldText[bpDiffPos] ?? "";
        const charAfterDeletion = oldText[bpDiffPos + 1] ?? "";
        if (
          PAIR_OPEN_TO_CLOSE[deletedChar] !== undefined &&
          PAIR_OPEN_TO_CLOSE[deletedChar] === charAfterDeletion
        ) {
          const paired =
            oldText.slice(0, bpDiffPos) + oldText.slice(bpDiffPos + 2);
          pushHistory(oldText);
          contentRef.current = paired;
          correctNative(paired, bpDiffPos);
          snapScrollToCursor(paired, bpDiffPos);
          scheduleSave();
          return;
        }
      }

      pushHistory(oldText);

      // Update the content ref synchronously. This is now the source of truth
      // for all subsequent operations (save, undo history, typewriter scroll).
      // We do NOT call setContent here because the TextInput is uncontrolled:
      // there is no `value` prop, so React never re-pushes the full document
      // string across the JS-native bridge on every keystroke. This is the
      // primary fix for typing lag on long documents.
      contentRef.current = newText;
      scheduleSave();

      // Estimate the post-edit cursor position for typewriter scroll.
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
    [
      correctNative,
      pushHistory,
      runTypewriterScroll,
      snapScrollToCursor,
      scheduleSave,
    ],
  );

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

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
      const before = contentRef.current.slice(0, start);
      const middle = contentRef.current.slice(start, end);
      const after = contentRef.current.slice(end);

      pushHistory(contentRef.current);

      if (s.kind === "insert") {
        const updated = before + s.payload + after;
        contentRef.current = updated;
        // With an uncontrolled TextInput we must push text via setNativeProps;
        // setContent alone would not update the native view.
        correctNative(updated, start + s.payload.length);
        scheduleSave();
        return;
      }
      if (s.kind === "wrap" || s.kind === "pair") {
        const open = s.payload;
        const close = s.closing ?? s.payload;
        if (middle.length > 0) {
          const updated = before + open + middle + close + after;
          contentRef.current = updated;
          correctNative(updated, end + open.length + close.length);
          scheduleSave();
        } else {
          const updated = before + open + close + after;
          contentRef.current = updated;
          correctNative(updated, start + open.length);
          scheduleSave();
        }
      }
    },
    [correctNative, pushHistory, ensureFocused, scheduleSave],
  );

  const insertText = useCallback(
    (text: string) => {
      ensureFocused();
      const start = cursorRef.current.start;
      const end = cursorRef.current.end;
      pushHistory(contentRef.current);
      const updated =
        contentRef.current.slice(0, start) +
        text +
        contentRef.current.slice(end);
      contentRef.current = updated;
      correctNative(updated, start + text.length);
      scheduleSave();
    },
    [correctNative, pushHistory, ensureFocused, scheduleSave],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const { text: prev, cursor } = h.past.pop()!;
    h.future.push({
      text: contentRef.current,
      cursor: cursorRef.current.start,
    });
    if (h.future.length > HISTORY_LIMIT) h.future.shift();
    contentRef.current = prev;
    // Push the reverted text to the native layer. With an uncontrolled
    // TextInput, setContent alone would not update the view.
    correctNative(prev, cursor);
    scheduleSave();
    notifyUndoRedo();
  }, [correctNative, scheduleSave, notifyUndoRedo]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const { text: next, cursor } = h.future.pop()!;
    h.past.push({ text: contentRef.current, cursor: cursorRef.current.start });
    if (h.past.length > HISTORY_LIMIT) h.past.shift();
    contentRef.current = next;
    correctNative(next, cursor);
    scheduleSave();
    notifyUndoRedo();
  }, [correctNative, scheduleSave, notifyUndoRedo]);

  const toggleFindReplace = useCallback(() => {
    setFindReplaceOpen((v) => {
      if (!v) {
        // Sync contentRef into React state so FindReplaceBar searches the
        // latest text — content state may be behind contentRef since normal
        // typing no longer calls setContent on every keystroke.
        setContent(contentRef.current);
      }
      return !v;
    });
  }, []);

  const jumpToLine = useCallback(
    (lineIndex: number) => {
      const lines = contentRef.current.split("\n");
      const clamped = Math.max(0, Math.min(lineIndex, lines.length - 1));
      const pos = lines
        .slice(0, clamped)
        .reduce((n, l) => n + l.length + 1, 0);
      isAutoScrollingRef.current = true;
      setCursor(pos);
      focus();

      if (!scrollRef.current) {
        isAutoScrollingRef.current = false;
        return;
      }
      const lineHeightPx =
        effectiveFontSizeRef.current * effectiveLineHeightRatioRef.current;
      const lineY =
        clamped * lineHeightPx + activeThemeRef.current.paddingVertical;
      const targetY = Math.max(0, lineY - 40);
      lastLineIndexRef.current = clamped;
      cancelAnimation(scrollTargetY);
      scrollTargetY.value = withSpring(
        targetY,
        { mass: 0.4, damping: 22, stiffness: 200 },
        () => {
          "worklet";
          runOnJS(setNotAutoScrolling)();
        },
      );
    },
    [setCursor, focus, setNotAutoScrolling],
  );

  // Expose handle to parent.
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
      // Use contentRef (not content state) so we always operate on the latest
      // text even if content state hasn't caught up with recent typing.
      const current = contentRef.current;
      pushHistory(current);
      const updated =
        current.slice(0, match.start) +
        replacement +
        current.slice(match.end);
      const pos = match.start + replacement.length;
      contentRef.current = updated;
      correctNative(updated, pos);
      setContent(updated); // keep state in sync for FindReplaceBar re-search
      scheduleSave();
    },
    [pushHistory, correctNative, scheduleSave],
  );

  const handleReplaceAll = useCallback(
    (query: string, replacement: string, caseSensitive: boolean): number => {
      if (!query) return 0;
      const escapeRe = (s: string) =>
        s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        escapeRe(query),
        "g" + (caseSensitive ? "" : "i"),
      );
      const current = contentRef.current;
      const matches = current.match(re);
      if (!matches || matches.length === 0) return 0;
      pushHistory(current);
      const escapedReplacement = replacement.replace(/\$/g, "$$");
      const updated = current.replace(re, escapedReplacement);
      contentRef.current = updated;
      correctNative(updated, updated.length);
      setContent(updated); // keep state in sync for FindReplaceBar re-search
      scheduleSave();
      return matches.length;
    },
    [pushHistory, correctNative, scheduleSave],
  );

  const acceptRecovery = useCallback(() => {
    if (recoveryOffer === null) return;
    pushHistory(contentRef.current);
    contentRef.current = recoveryOffer;
    correctNative(recoveryOffer, recoveryOffer.length);
    setContent(recoveryOffer);
    setRecoveryOffer(null);
    clearRecoveryBuffer(noteId).catch(() => {});
    scheduleSave();
  }, [recoveryOffer, pushHistory, correctNative, scheduleSave, noteId]);

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
          <Text
            style={[styles.recoveryText, { color: c.text }]}
            numberOfLines={2}
          >
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
        onScrollBeginDrag={() => {
          if (typewriterModeRef.current) {
            // User dragged manually — invalidate the cached line index so the
            // next keystroke triggers a fresh re-center rather than skipping
            // because the line number hasn't changed.
            lastLineIndexRef.current = -1;
          }
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bottomOffset={bottomOffset}
        // Disable the library's own keyboard-avoidance scroll in typewriter
        // mode — runTypewriterScroll owns that entirely.
        enabled={!typewriterMode}
        // Always allow manual touch-scrolling. In typewriter mode, dragging
        // overrides the auto-center; the next keystroke re-centers via the
        // lastLineIndexRef reset in onScrollBeginDrag above.
        scrollEnabled={true}
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
              // No `value` prop — this TextInput is uncontrolled. The native
              // layer manages its own content during typing; corrections
              // (auto-pair, smart-enter, undo/redo, etc.) are pushed via
              // correctNative / setNativeProps. This eliminates the
              // per-keystroke JS→native bridge round-trip of the full document
              // string, fixing lag on documents longer than ~3 k words.
              defaultValue={initialContent}
              onChangeText={handleChangeText}
              onKeyPress={handleKeyPress}
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
        onPress={() => {
          setPreviewMode((p) => {
            if (!p) {
              // Sync contentRef into React state before entering preview so
              // MarkdownPreview gets the latest text. content state may be
              // behind contentRef since normal typing no longer calls setContent.
              setContent(contentRef.current);
            }
            return !p;
          });
        }}
        style={[
          styles.previewToggle,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
        accessibilityLabel={
          previewMode ? "Switch to write mode" : "Switch to preview mode"
        }
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
            <View style={[styles.savedDot, { backgroundColor: c.accent }]} />
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
