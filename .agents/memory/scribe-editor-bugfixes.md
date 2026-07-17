---
name: Scribe editor bug fixes
description: Three editor bugs fixed in artifacts/mobile/components/Editor.tsx and how they were solved.
---

## Fix 1 — Paste lag (startTransition)
Large insertions (> 200 chars) now call `startTransition(() => setContent(newText))` instead of `setContent(newText)` directly. This marks the update as non-urgent so React can yield to the UI thread during re-render, keeping the app responsive while pasting.

**Why:** Controlled TextInput must re-render with the new `value` on every change. For large pastes this blocks the JS thread. `startTransition` is the React 18 idiomatic fix.

## Fix 2 & 3 — Scroll jump on smart-enter and skip-over
Added `snapScrollToCursor(text, position)` helper (a `useCallback` that reads `typewriterModeRef` and `activeThemeRef`). Called immediately after `correctNative` in both the smart-enter path (Enter before close bracket) and skip-over path (typing a close char that already follows the cursor).

**Why:** `KeyboardAwareScrollView`'s Reanimated worklet runs on the UI thread and fires *before* our JS `onChangeText` handler. It scrolls to the wrong line (the briefly-inserted newline/char). Our `correctNative` reverts the text synchronously, but the KAScrollView has already scrolled. `snapScrollToCursor` calls `scrollRef.current.scrollTo({ animated: false })` in the same JS turn to snap back, limiting the visible jump to at most one frame (~16 ms at 60 fps).

**How to apply:** Any future programmatic correction (`correctNative` call) that changes which line the cursor is on should be followed by `snapScrollToCursor` to prevent the same race.

## Architecture note
`typewriterModeRef` and `activeThemeRef` were added as mirror refs (synced via `useEffect`) so `snapScrollToCursor` can read current values without being recreated on every prop change — avoiding cascading `handleChangeText` deps.
