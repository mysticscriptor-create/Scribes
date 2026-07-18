# Scribe — Editor Feature Reference
> Auto-generated reference for agent use. Describes every feature, its design, data-flow, and known constraints.
> Source of truth: `artifacts/mobile/components/Editor.tsx` (~1200 lines) plus supporting files.

---

## Architecture overview

- **Framework**: Expo SDK (React Native), New Architecture (Fabric) enabled (`newArchEnabled: true`), React Compiler enabled (`reactCompiler: true`), Hermes JS engine.
- **Editor core**: A single controlled `TextInput` (multiline) inside a `KeyboardAwareScrollView` (from `react-native-keyboard-controller`).
- **Controlled mode constraint**: `value={content}` — MUST stay controlled. Uncontrolled (`defaultValue`) was tried and caused IME composition bugs + text duplication on real Android devices.

---

## 1. Text input & change handling (`handleChangeText`)

**Entry point**: `TextInput.onChangeText` → `handleChangeText(newText)`.

`handleChangeText` is the dispatcher for all text changes. It classifies by `lenDiff = newText.length - oldText.length`:

### 1a. Single-char insertion (`lenDiff === 1`)
Uses `commonPrefixLen(oldText, newText, cursorRef.current.start)` to find `diffPos` (the insertion point) in O(1) for the common case (anchor near caret).

**Smart-enter** (`insertedChar === '\n'` AND `charAfterCursor` ∈ CLOSE_CHARS):
- Reverts text to `oldText`, moves cursor past the close char (`diffPos + 1`).
- Calls `correctNative(oldText, diffPos+1)` to push correction synchronously.
- Calls `snapScrollToCursor` to counteract KAScrollView's pre-correction scroll.
- No history push (text didn't change).

**Auto-pair** (`insertedChar` ∈ PAIR_OPEN_TO_CLOSE AND `charAfterCursor` is NOT already the close char):
- Inserts the close character immediately after the open.
- Calls `pushHistory(oldText)`.
- Calls `setContent(updated)` + `correctNative(updated, diffPos+1)` to land cursor between the pair.

**Skip-over** (`insertedChar` ∈ CLOSE_CHARS AND `charAfterCursor === insertedChar`):
- Reverts text, moves cursor past the existing close char.
- Same scroll treatment as smart-enter.

### 1b. Single-char deletion (`lenDiff === -1`)
**Paired backspace**: If the deleted char is an opening bracket/quote and the char immediately following it (in oldText) is its matching close, both are deleted together (keeping the cursor at diffPos). Calls `pushHistory + setContent + correctNative`.

Falls through to general path if not a pair.

### 1c. Large change (`|lenDiff| > 200` — pastes)
Uses `startTransition(() => setContent(newText))` to yield to the UI thread during the expensive re-render.

### 1d. Normal typing / small deletes
`pushHistory(oldText)` + `setContent(newText)`.
Estimates cursor position via `commonPrefixLen` + `commonSuffixLen` anchored at `cursorRef.current` (O(1) for normal typing on long documents).
Calls `runTypewriterScroll(newText, estimatedCursor)`.

**Pair characters** (`PAIR_OPEN_TO_CLOSE`):
`" → "`, `' → '`, `( → )`, `[ → ]`, `{ → }`, `` ` → ` ``, `" → "`, `' → '`, `« → »`.

---

## 2. Native correction (`correctNative`, `setCursor`)

Both imperatively push state to the native TextInput in the same frame:
- `correctNative(text, position)`: calls `setNativeProps({ text, selection })`. Used when text AND cursor both need to change without waiting for a React render cycle. Also calls `setForcedSelection` for the controlled prop.
- `setCursor(position)`: only pushes a new selection (no text change).

**Why needed**: Android paints the committed keystroke immediately before React's `onChangeText` handler runs. Without synchronous correction via JSI (`setNativeProps`), the user sees a flash of the incorrect text for one render cycle.

---

## 3. Scroll management

### 3a. Typewriter mode (`runTypewriterScroll`)
Only active when `typewriterMode === true`. Centers the active line vertically in the visible area (above keyboard).

Algorithm:
1. Compute `lineIndex = text.slice(0, pos).split('\n').length - 1`.
2. Early-return if `lineIndex === lastLineIndexRef.current` (same line, no scroll needed).
3. Compute pixel position: `lineY = lineIndex * lineHeightPx + paddingVertical`.
4. Target: `targetY = lineY - visibleHeight/2 + lineHeightPx/2`.
5. Animate with `Animated.spring` (speed 16, bounciness 0, JS-driven via listener → `scrollRef.scrollTo`).

`lineHeightPx` uses **effective** values: `effectiveFontSizeRef.current * effectiveLineHeightRatioRef.current`. These refs mirror the `editorFontSize` panel override and `lineSpacing` panel override, not raw theme values.

`isAutoScrollingRef` is set `true` while spring runs; cleared in `.start()` callback. Prevents competing scroll from `handleSelectionChange` during an in-flight animation.

`KAScrollView` is disabled (`enabled={false}`, `scrollEnabled={false}`) in typewriter mode so the two scroll systems never fight.

### 3b. Normal mode scroll (`snapScrollToCursor`)
Used immediately after programmatic corrections (smart-enter, skip-over, auto-pair) to counteract the `KAScrollView` Reanimated worklet's pre-correction scroll. The worklet runs on the UI thread before our JS correction lands, scrolling to the wrong line; `snapScrollToCursor` snaps back in the same JS turn, limiting the visible jump to at most one frame. Skipped in typewriter mode (where `runTypewriterScroll` owns scrolling).

### 3c. Outline jump (`jumpToLine`)
Explicit user navigation (from the right panel outline). Always scrolls once regardless of `typewriterMode`. Sets `isAutoScrollingRef = true` BEFORE `setCursor` to block `handleSelectionChange` from firing a competing scroll while the animation runs. Uses the same `Animated.spring` as typewriter mode.

### 3d. `KAScrollView` scroll state
- Typewriter mode: `enabled={false}`, `scrollEnabled={false}` — only `runTypewriterScroll` drives scroll.
- Normal mode: `enabled={true}`, `scrollEnabled={true}` — KAScrollView follows the cursor automatically.
- `bottomOffset={bottomOffset}` — passed from the parent (measured shortcut-bar height + 16px), so the auto-scroll never hides the caret behind the keyboard.

---

## 4. Selection tracking (`handleSelectionChange`)

`TextInput.onSelectionChange` → `handleSelectionChange`.

Guards:
- Ignores events when `isFocusedRef.current === false` (Android fires a spurious selection event on blur that would corrupt `cursorRef`).

On valid event:
- Updates `cursorRef.current`.
- Calls `onSelectionChange` prop (parent notification).
- Calls `runTypewriterScroll(content, selection.start)` — guarded by `isAutoScrollingRef` only when an in-flight `jumpToLine` animation is running (to prevent competing scroll). Normal typewriter typing does NOT guard this call.

---

## 5. Undo / redo

**History structure**: `historyRef.current = { past: { text, cursor }[], future: { text, cursor }[], lastChangeAt: number }`.

**`pushHistory(oldText)`**:
- Saves `{ text: oldText, cursor: cursorRef.current.start }`.
- Groups rapid edits within `HISTORY_GROUP_MS = 700ms` into a single snapshot (no-op if grouped).
- Clears `future`.
- Limit: `HISTORY_LIMIT = 200` snapshots.
- Called by: `handleChangeText` (all paths that change text), `applyShortcut`, `insertText`, `acceptRecovery`, `handleReplaceOne`, `handleReplaceAll`.

**`undo()`**: Pops from `past`, pushes `{ text: content, cursor: cursorRef.current.start }` onto `future`. Restores text AND cursor.

**`redo()`**: Pops from `future`, pushes current onto `past`. Restores text AND cursor.

Smart-enter and skip-over do NOT push history (text doesn't change; only cursor moves).

---

## 6. Autosave & persistence pipeline

Three layers running on every content change:

| Layer | Debounce | Target | Notes |
|---|---|---|---|
| In-memory note update | 120ms | `NotesContext.updateNoteContent` | Updates note in React state |
| Vault AsyncStorage write | 600ms (in NotesContext) | `AsyncStorage.setItem(NOTES_KEY)` | Entire vault serialized as one JSON blob |
| Recovery buffer | 120ms (merged with autosave) | `AsyncStorage.setItem('scribe.recovery.' + noteId)` | Per-note crash recovery |
| Snapshot (history) | 3min + 40 char diff gate | `AsyncStorage.setItem('scribe.history.' + noteId)` | In-memory watermark skips most calls |

On unmount/note-switch: immediate flush via the cleanup in `useEffect([noteId])`.
On app background/inactive: `NotesContext` flushes vault + pending SAF writes via `AppState` listener.

**Recovery buffer** is merged into the 120ms autosave effect (not a separate 800ms timer) so recovery content is always at least as fresh as the last autosave. The recovery banner is shown at mount if `buf.content !== initialContent && buf.content.trim().length > 0 && buf.content.length >= initialContent.length` (the length guard prevents offering older/shorter recovery content).

---

## 7. Crash recovery banner

Shown when a recovery buffer exists and differs from (and is at least as long as) the initial note content. User can accept (restore + push to history) or dismiss (clear buffer). Positioned: `position: absolute, top: 10, left: 12, right: 50` to leave room for the preview toggle button.

---

## 8. Find & Replace (`FindReplaceBar`)

`toggleFindReplace` shows/hides the bar. Three operations passed as props:

- `onJump(match)`: moves `forcedSelection` to the match range (highlights it).
- `onReplaceOne(match, replacement)`: splices replacement at match range; pushes history.
- `onReplaceAll(query, replacement, caseSensitive)`: builds escaped regex, replaces all. Dollar signs in replacement are escaped (`$` → `$$`) to prevent regex back-reference interpretation. Returns count.

---

## 9. Shortcuts (`applyShortcut`, `insertText`)

`applyShortcut(shortcut)` handles three shortcut kinds:
- `"insert"`: inserts `payload` at cursor, places cursor after.
- `"wrap"` / `"pair"`: wraps selected text (or inserts empty pair) with `payload` + `closing`.

`insertText(text)`: inserts text at cursor.

Both call `ensureFocused()` first — if the editor never had focus, `focus()` is called to establish a caret before insertion (prevents silent insert-at-end-of-file surprise).

History is pushed before both operations.

---

## 10. Markdown preview

`previewMode` toggle (floating eye/pencil button, top-right). Renders `MarkdownPreview` component (custom native-component renderer for bold, italic, headers, quotes, HRs) in place of `TextInput`. Tapping the preview switches back to edit mode.

---

## 11. Writing stats & goal bar

**Word count / char count / reading time**: computed from `debouncedStatsContent` (content debounced 500ms) to avoid per-keystroke re-computation on long documents. Displayed in a floating pill (bottom-right), collapsible.

**Daily goal bar**: 3px progress bar at the top of the editor. Fills based on `todayWords / dailyGoal`. Pulses green when the goal is first reached (`goalCelebratedRef` prevents repeat animations). Managed by `WritingStatsContext`.

---

## 12. Typewriter mode — edge cases & constraints

- `paddingBottom: 300` (in typewriter mode) ensures the bottom half of the scroll view is empty so the last line can be centered.
- `scrollViewHeightRef` tracks the outer container height via `onLayout`. NOTE: Android `softwareKeyboardLayoutMode="pan"` means the layout never resizes when keyboard appears — `keyboardHeightRef` (populated from real `Keyboard.addListener` OS events) compensates for this.
- `effectiveFontSizeRef` / `effectiveLineHeightRatioRef`: mirror `editorFontSize` panel override and `lineSpacing` override. All scroll calculations use these, not raw `activeTheme.fontSize / lineHeight`, since those don't account for user overrides.

---

## 13. SAF (Storage Access Framework) / external folder

When an external folder is connected (`externalRoot !== null`):
- Note content is NOT stored in AsyncStorage vault — only `externalNotes` state.
- Each note has `externalUri` (Android SAF URI). Content is lazy-loaded on first open (`ensureLoaded`).
- Writes: `safWriteFile` with 600ms debounce per note, immediate flush on app background.
- Rename: display-only (SAF can't rename in place on Android — file keeps original name on disk).

---

## 14. Floating windows

`PanelsContext.floatingWindows`: draggable, resizable overlays rendering a pinned note (read-only `MarkdownView`). Managed in `FloatingWindowsLayer`. Each window has position (x, y), size (width, height), z-index, and collapsed state.

---

## 15. Theme system

5 built-in themes (Paper, Midnight, Sepia, Typewriter, Focus). Custom themes can be created/edited/duplicated/deleted. Theme properties: colors, `fontFamily` (maps to loaded Expo fonts), `fontSize`, `lineHeight`, `letterSpacing`, `paragraphSpacing`, `paddingHorizontal`, `paddingVertical`, `maxWidth`, optional `backgroundImageUri`.

User overrides from panels: `editorFontSize` (14–22px, 0 = use theme default), `lineSpacing` (compact/comfortable/spacious → 1.4/1.7/2.0× multiplier).

**Effective values used in all scroll calculations:**
- `effectiveFontSize = editorFontSize > 0 ? editorFontSize : activeTheme.fontSize`
- `effectiveLineHeightRatio = LINE_SPACING_MAP[lineSpacing]`

---

## 16. New Architecture (Fabric) status

`app.json`: `"newArchEnabled": true` — **enabled**.  
`setNativeProps` calls in `correctNative` and `setCursor` use synchronous JSI communication through Fabric's C++ host components. No bridge serialization overhead.  
React Compiler (`"reactCompiler": true`) handles component-level memoization automatically.

---

## Known limitations (not bugs, by design)

- Typewriter line-centering is pixel-approximate: computed from logical line index × line height, not visual pixel position. Lines that wrap to multiple visual rows shift the centering off.
- Vault AsyncStorage stores ALL notes as one JSON blob. Large vaults serialize slowly; the 600ms debounce in NotesContext mitigates this.
- SAF rename is display-only on Android (OS limitation).
- `docx` export is plain text only (no inline formatting).
