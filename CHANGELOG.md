# Changelog

All notable changes to **Orchid**. Newest first. Built for macOS (Apple Silicon).

## 1.3.0 — 2026-06-26

**Added**
- **PDF reading.** Open a `.pdf` and read it right inside Orchid — rendered in the app's own calm viewer (not the grey system one), with fit-to-width, zoom, selectable text, and **find (`⌘F`)** across the whole document.
- **Customisable keyboard shortcuts.** A new **Settings** panel (⌘, or the gear in the titlebar) lists every command — click a shortcut and press the keys you want. Especially handy on a **Windows-style keyboard**, where you can bind `Ctrl`-based shortcuts (macOS treats `⌘` and `Ctrl` as different keys). Reset any one shortcut, or all of them, to the defaults.
- **A proper Edit menu** — Undo, Redo, Cut, Copy, Paste, Paste and Match Style, and Select All, so the standard editing keyboard shortcuts work everywhere.
- **Right-click in the editor** — a context menu with Cut / Copy / Paste / Select All (and Copy on selected preview text).
- **Collapse / Expand all folders** — a one-click toggle in the sidebar toolbar.
- **Version everywhere** — shown in **Orchid → About Orchid**, on the launch screen, and in Settings.

**Fixed**
- **The editor now supports cut, copy, and paste** — both the keyboard shortcuts (`⌘X` / `⌘C` / `⌘V`) and the right-click menu. Undo/redo (`⌘Z` / `⌘⇧Z`) drive the editor's own history.
- **New empty folders show up immediately** — creating a folder inside a folder no longer waits for files before appearing.

**Reliability**
- **Fewer unexpected quits.** A stray main-process error is now caught instead of taking the app down, a crashed renderer auto-reloads itself, and crashes are recorded so they can be diagnosed (version + macOS version), rather than failing silently.

## 1.2.0 — 2026-06-25

**Changed**
- **Redesigned accent picker.** Choosing your own colour is now two clear controls: a solid **Custom** swatch (tap to use your colour, like any preset) and a rainbow **Pick…** swatch that opens the colour picker. The selection ring matches the preset swatches.
- **Trimmed to 13 curated accent presets** (dropped Periwinkle, Jade, and Slate) for a tidier, shorter picker.

**Fixed**
- **The Theme button's colour dot now reflects a custom accent** instead of staying on the default.

**Under the hood**
- **Security & platform update** — upgraded to **Electron 39** (closes 17 runtime security advisories), **electron-builder 26** (pulls a patched `tar`), and **Vite 6**. `npm audit` is clean. No change to how the app looks or behaves — it still ships as the same ad-hoc-signed Apple Silicon build.
- **Test suite** — added a Vitest unit suite with 100% coverage of the logic layer (store, file scan, export, themes, version compare), enforced in CI on every change.

## 1.1.2 — 2026-06-24

**Fixed**
- **No more crash when the system theme changes.** If you closed Orchid's window but left the app running, a macOS auto Light↔Dark switch (e.g. at sunset) could throw a "JavaScript error in the main process" dialog. The window reference is now cleared on close, and every background message to the window is guarded against a torn-down window.

## 1.1.1 — 2026-06-24

**Fixed**
- **New files now appear in the sidebar immediately.** Creating a file (or folder) refreshes the containing folder right away instead of waiting on the file watcher — and if you'd opened a single file, the sidebar promotes to its folder view so the new file and its siblings show.
- **Create a file with nothing open.** New File / New Folder (`⌘N` / `⌘⇧N`, or the launch screen) now offer a **Save As** dialog to pick a location when no folder is open — previously a dead end.

**Added**
- **Close File (`⌘W`)** — closes the open file (a single-file window returns to the launch screen); prompts if there are unsaved edits.
- The create dialog now shows **where** the file will be created, and `⌘N` targets the folder of the file you're viewing.

## 1.1.0 — 2026-06-24

**Added**
- **In-app updates** — **Check for Updates…** in the Orchid menu, plus a quiet one-time check on launch. When a newer release exists, an in-app card shows what's new with a one-click download. (No background nagging.)
- **Customisable PDF export** — set a **header**, **footer**, and toggle **page numbers** before exporting; use `{title}` and `{date}` tokens. Your choices are remembered.
- **New File (⌘N)** and **New Folder (⌘⇧N)** in the File menu — creation is no longer sidebar-only.
- **Shout-outs** — Help → *Give Orchid a Shout-out on X* (a pre-filled post) and *Follow @AvneeNathani*; a friendly link on the launch screen too.

**Changed**
- **Redesigned sort control** — the `Name / Recent` pill is now a compact **"Sort by" dropdown** with a checkmarked menu (room to grow).
- **Edit mode focuses the editor** with the cursor at the very start, so you can type immediately.
- **Exports are always light** — PDF and HTML now render on a clean white page (keeping your accent) regardless of the app theme, so they print and share well.

**Fixed**
- **Some `.md` files couldn't be opened** — the Open dialog no longer greys out valid Markdown files (a macOS file-type quirk). It defaults to *All files*, and any file you pick opens, with the binary guardrail handling anything unsupported.

## 1.0.2 — 2026-06-24

**Added**
- **Rename, Duplicate & Move** — right-click any file or folder to rename (or double-click its name), duplicate it, or drag it onto another folder to move it.
- **Copy Path / Copy Relative Path** — right-click to grab a file's full or workspace-relative path.
- **Pin files** — a **Pinned** section at the top of the sidebar for instant access to your go-to files, no matter where they live. Pin via right-click or the pin glyph that appears on hover.
- **Keyboard navigation** — with the sidebar focused, ↑/↓ move through files (opening each); **⇧↑ / ⇧↓** and **⇧-click** extend a multi-file selection.
- **Resizable edit preview** — drag the divider between the editor and the live preview; the split position is remembered.
- **Adjustable index text size** — Small / Medium / Large for the "On this page" outline (Theme menu).

**Changed**
- **Collapse panels from the divider** — hover the resize line between panels and a circular control appears to collapse it; hover the edge of a hidden panel to bring it back. (Replaces the two separate title-bar toggles.)
- **One focus button** in the title bar now hides or restores every panel at once.
- **Cleaner outline** — dropped the redundant rail line in the table of contents.
- **Lighter, faster** carried over from 1.0.1.

**Fixed**
- Your saved **theme and accent now apply instantly on launch** — no more flash of the default purple before your choice loads.

## 1.0.1 — 2026-06-24

**Added**
- **Current-mode badge** in the title bar — a quiet **Reading** pill that lights up as **Editing**, with a matching accent rule under the bar, so you always know which mode you're in.
- New files now **open ready to edit** — no extra click to start typing.
- The **+** (new file / folder) is now available everywhere: at the root, on a workspace folder, and on any subfolder.

**Changed**
- Selecting a folder now **selects every file inside it** (for multi-delete).
- **Multi-select is easier to find** — a Select toggle in the sidebar, a right-click "Select", and checkboxes on items.
- **Move to Trash now asks for confirmation.**
- Files **always show a relative time** (consistent even beyond two weeks); long names truncate with an ellipsis and reveal the full name on hover.
- **Recent** sort keeps just-created and just-edited files on top.
- **Smaller and faster** — Mermaid diagrams and the code editor now load on demand (startup bundle ~4.1 MB → ~2.9 MB), and unused Chromium locales are trimmed (~40 MB off the install).

**Removed**
- The new-file accent dot (it depended on a constantly-running timer); relative timestamps cover the same need.

## 1.0.0 — 2026-06-24

First stable release.

**Added**
- **Create files** of any type, and **create folders** (nest by typing a path like `notes/idea.md`). Extension-less files default to `.txt`, Sublime-style.
- **Syntax highlighting** for code files — Swift, C/C++, Python, JavaScript/TypeScript, JSON, shell, YAML and more — via CodeMirror's own language packages.
- **Delete to Trash**, including **multi-select** (⌘-click several files, then Move to Trash).
- **Close** a file or folder; closing the last one returns to the launch screen.
- **Custom accent colour** — pick your own hex, alongside the 16 presets.
- **In-app Contributing & Developer info** (Help menu).
- **Guardrails** — a friendly message for binary/unsupported files, and a clear notice when opening a type Orchid can't display (e.g. a PDF).

## 0.1.2 — 2026-06-23

**Added**
- **Unified Open** — pick a file *or* a folder in one dialog.
- **Resizable** sidebar and contents rail (the reading area is the remainder); sizes persist.
- **Adjustable sidebar text size** (Small / Medium / Large).
- **Find in file** (⌘F) — document-scoped, with a match count and next/previous.

**Changed**
- Bolder, higher-contrast folder headers so multiple folders read distinctly.

**Fixed**
- Orchid now prompts to **save before closing** or switching files — no more lost edits.

## 0.1.1 — 2026-06-23

**Added**
- **Multi-folder workspaces** — keep several folders open, each its own section; **open a single file** too.
- **Refresh** button + **Name / Recent** sort.
- Expanded to **16 accent presets**, including cool/neutral Slate, Steel, Graphite and Pine.

**Changed**
- Calmer, more deliberate accent use; lighter dark-mode code blocks; wider full-bleed reading.

**Fixed**
- **Ad-hoc code signing** so downloaded builds aren't flagged as "damaged".
- The window always opens on-screen and reachable.

## 0.1.0 — 2026-06-23

First public release.

**Added**
- Folder-native **Markdown reader** — open a folder and see only the Markdown inside.
- **Rich preview** — GFM tables & task lists, syntax-highlighted code, **KaTeX** math, **Mermaid** diagrams, images, and a tidy frontmatter header.
- **Table-of-contents** rail with scroll-spy; **⌘P** quick file switcher; **⌘⇧F** content search.
- **CodeMirror** editor with a live, scroll-synced preview; **export to HTML / PDF**.
- Light (**Bloom**) / dark (**Dusk**) themes following the system; accent presets.
- Live reload on disk changes; unsaved-change conflict banner; recency badges; keyboard shortcuts.
