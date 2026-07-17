# Scribe v2.0 — Bugfix & Feature Plan (reference copy of user's prompt)

Source: user-uploaded file `attached_assets/Pasted-Some-bugs-that-needs-fixing-Bugs-Issues-Section-A-Writi_1783769257085.txt`.
Kept here verbatim as a working reference during the v2.0 build. Workflow: fix Section A (1-7) fully,
then Section B (8-11), then Section C (12-21) with creative freedom, then verify/deconflict, then ship as v2.0.

## Section A: Writing Bugs
1. "We found unsaved changes from before. Restore them?" toast/dialog fires on every keystroke — should only prompt once, on load, if there's actually a stale unsaved draft.
2. Fast typing drops/duplicates characters; deleting characters causes flicker (chars reappear/disappear). Likely controlled-input race condition or debounce fighting the native TextInput.
3. Screen/editor jumps up and down while typing for no reason — should stay anchored to the caret without layout thrash.
4. Same jump issue is worse in Typewriter mode — scroll should track the caret smoothly, not oscillate per keystroke.
5. Occasionally happens on Enter/newline too.
6. Cursor jumps unexpectedly when exiting brackets/quotes via Enter or via the shortcut-bar auto-pair insert (sometimes jumps to bottom of file).
7. Keyboard opening/focusing the editor is jittery, not smooth.

## Section B: Other Bugs and Fixes
8. Connected folders from phone storage show as .txt files (extension/mime handling bug for SAF-connected folders).
9. View modes in file explorer don't show files from "projects". Fix: add a "Mode" button where the project picker is; clicking cycles/opens Project mode, Vault mode, Folder mode — separate from filtering.
10. New Projects should ask chapter-wise vs scene-wise structure.
    - Chapter-wise: chapters ARE the files (no scene sub-level).
    - Scene-wise: chapters contain scenes as files.
    - Long-press on chapter/scene → pin to side panel / open in floating window, etc.
11. Left/right edge-swipe hit area for opening panels is too small — widen so a swipe starting near the middle of the screen still opens panels.

## Section C: UI Changes & Additions (creative freedom, use judgment)
12. Redefine side panels:
    - Left panel ("Macro"): Vault/Project management, Folders, File Tree/explorer, Settings, Global Search — all navigation. Add anything reasonable that's missing.
    - Right panel ("Micro"): purely reference — Pinned tab + Outline tab (headers of current doc). No navigation/management here.
13. In right panel's pinned notes (both upper/bottom slots) add a small add/replace button that opens a file picker (folders/files) to pin a file directly, instead of requiring the file explorer.
    (Also numbered 13 again in source — see "Smooth Cursor Tracking" below, kept as its own item.)
14. Smooth cursor tracking: scroll transitions must be spring-animated, not linear jumps, in both normal and Typewriter mode; Enter should glide the canvas up smoothly.
15. Typewriter toggle, export options, and search & replace move into the top-bar three-dot menu; file title moves to the center of the top bar.
16. Images: add add/replace/remove image support for Characters, Locations, and Projects (project cover image).
17. Characters & Locations: add tags support + search-by-tag.
18. Theme settings: add background image, opacity control, font settings incl. importing local fonts, plus a few built-in popular fonts.
19. Settings menu: reorganize into clean, beautiful categories.
20. Version History: history entries should render visually dimmer than the live editor so it's obvious you're browsing history; the Restore action should be a clearly labeled button (explicit text, e.g. "Restore this version — replaces current note").
21. Character/Location creation: add image upload, Save/Cancel buttons, more polished fields with icons. After creation it becomes a card; tapping the card shows a read-only detail view (not the editor); a dedicated button opens the edit page. Long-press on a card offers pin/floating-window options like files.

## Meta Instructions
- Work Section A fully (bug by bug) before touching Section B; Section B fully before Section C.
- Section C: use creativity/current UX conventions for writing apps; don't clash with existing functionality.
- Add in-app usage guides; remove any mention of other apps (e.g. "inspired by Writer Lite / Pure Writer" references).
- After all 21 points: verify no conflicts, check dependencies, then ship as **v2.0**.
- Deliver the `eas build` command to rebuild the native app at the end.
