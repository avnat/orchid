# Changelog

All notable changes to **Orchid**. Newest first. Built for macOS (Apple Silicon).

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
