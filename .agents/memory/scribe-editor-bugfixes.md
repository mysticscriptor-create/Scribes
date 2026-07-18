---
name: Scribe editor bug fixes
description: All editor bugs fixed in artifacts/mobile/components/Editor.tsx and how they were solved.
---

## Fix 1 — Paste lag (startTransition)
Large insertions (> 200 chars) use `startTransition(() => setContent(newText))`. React treats the update as non-urgent and can yield to the UI thread during re-render.

## Fix 2 & 3 — Scroll jump on smart-enter and skip-over (snapScrollToCursor)
Added `snapScrollToCursor(text, position)` helper called immediately after `correctNative` in both the smart-enter and skip-over paths. `KAScrollView`'s Reanimated worklet fires on the UI thread before our JS correction, so it briefly scrolls to the wrong line. `snapScrollToCursor` calls `scrollRef.scrollTo({ animated: false })` in the same JS turn to snap back, limiting the visible jump to at most one frame.

## Fix 4 — Typewriter scroll uses wrong line height
`runTypewriterScroll`, `snapScrollToCursor`, and `jumpToLine` all previously computed `lineHeightPx = activeTheme.fontSize * activeTheme.lineHeight`. This ignored the user's panel overrides (`editorFontSize` and `lineSpacing`). Fixed: added `effectiveFontSizeRef` and `effectiveLineHeightRatioRef` refs (synced via `useEffect`) used in all scroll calculations.

**Why:** User sets `editorFontSize: 20` + `lineSpacing: spacious` → actual `lineHeightPx = 40`, but old code used theme default `18 * 1.7 = 30.6` → 25% centering error.

## Fix 5 — Tap-to-line blocked during typewriter animation
`handleSelectionChange` was guarded by `if (!isAutoScrollingRef.current)` before calling `runTypewriterScroll`. During a `jumpToLine` animation the guard fired, so user taps to a different line were ignored and the view stayed centered on the old line. Fixed: removed the guard; `runTypewriterScroll` already short-circuits via `lastLineIndexRef` for same-line moves. Also moved `isAutoScrollingRef.current = true` to BEFORE `setCursor` in `jumpToLine` so the flag is set before `handleSelectionChange` can fire.

## Fix 6 — Undo/redo cursor jumps to end of document
History entries were plain `string` values. On undo/redo the cursor was placed at `prev.length` (end of text). Fixed: history entries are now `{ text: string; cursor: number }`. `pushHistory` saves `cursorRef.current.start` alongside the text. `undo`/`redo` restore both.

## Fix 7 — Replace-all regex back-reference in replacement string
`handleReplaceAll` passed the replacement string directly to `String.replace(re, replacement)`. If the replacement contained `$1`, `$2`, etc., JavaScript would interpret them as regex capture group references, producing wrong results. Fixed: escape `$` in replacement with `.replace(/\$/g, '$$$$')`.

## Fix 8 — Paired backspace
When the user backspaces an auto-paired opening bracket (e.g. `(|)` → `|)`), the close bracket was left stranded. Fixed: added `lenDiff === -1` branch in `handleChangeText` that detects when the deleted char is an open bracket immediately followed by its matching close, and deletes both.

## Fix 9 — Recovery buffer could offer older content
The recovery buffer was written on an independent 800ms debounce, while autosave runs every 120ms (with AsyncStorage write at 600ms in NotesContext). On crash, the recovery buffer could be older than what was already persisted, causing the banner to "restore" to earlier content. Fixed: recovery buffer is now written inside the same 120ms autosave timer as the note content, so they're always at the same version. Also added `buf.content.length >= initialContent.length` guard so shorter (likely older) buffers don't trigger the banner.

## Architecture notes
- `typewriterModeRef` and `activeThemeRef` are mirror refs synced via `useEffect` so `snapScrollToCursor` can read current values without cascading `handleChangeText` deps.
- `effectiveFontSizeRef` and `effectiveLineHeightRatioRef` serve the same purpose for scroll calculations.
- All three scroll functions (`runTypewriterScroll`, `snapScrollToCursor`, `jumpToLine`) now use these refs consistently.
