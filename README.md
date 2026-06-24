<div align="center">

<img src="docs/img/icon.png" width="116" alt="Orchid" />

# Orchid

**A calm, native macOS reader for the Markdown your tools generate.**

Point it at a folder (or several) and Orchid surfaces every Markdown file inside —
beautifully rendered, live-updating, and built for *reading*. Now also creates, edits,
and syntax-highlights code files.

[![License: MIT](https://img.shields.io/badge/License-MIT-7c4dd6.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS%20(Apple%20Silicon)-555.svg)
![Built with Electron + React](https://img.shields.io/badge/built%20with-Electron%20%2B%20React-7c4dd6.svg)

</div>

---

## ⬇️ Download & install

> **Requires macOS on Apple Silicon** (M1 / M2 / M3 / M4).

**1. Download** the latest **`Orchid-*.dmg`** from the [**Releases page**](https://github.com/avnat/orchid/releases/latest).

**2. Install** — open the downloaded `.dmg`, then drag the **Orchid** icon onto the **Applications** folder shown in the window.

**3. Open it the first time** (one-time, ~15 seconds):

Orchid is a free, open-source app that isn't paid-signed by Apple, so macOS double-checks with you on the *very first* launch. This is normal and safe — just:

1. In **Applications**, double-click **Orchid**.
2. A box says *"Apple could not verify 'Orchid' is free of malware…"* → click **Done**. *(Do **not** click "Move to Bin".)*
3. Open the **Apple menu  → System Settings → Privacy & Security**.
4. Scroll to **Security** — you'll see *"Orchid was blocked to protect your Mac."* → click **Open Anyway**.
5. Confirm with **Open Anyway** (Touch ID / password if asked).

From then on, Orchid opens with a normal double-click. ✨

<details>
<summary>Rare: it says "damaged" or won't open</summary>

If the download's quarantine flag got stuck, open the **Terminal** app (⌘Space → "Terminal") and paste:

```bash
xattr -dr com.apple.quarantine /Applications/Orchid.app
```

Press Return, then open Orchid normally. You only ever need this once.
</details>

> 📋 Every version's changes are tracked in [**CHANGELOG.md**](CHANGELOG.md).

---

<div align="center">
<img src="docs/img/hero-light.png" width="820" alt="Orchid rendering a Markdown document — diagram, table, and math" />
</div>

## Features

**Navigate**
- **Folder-native** — open a folder and the sidebar shows your Markdown (and code/text files), nested structure preserved, noise (`node_modules`, dotfiles) hidden.
- **Multi-folder workspaces** — keep several folders open at once, each a collapsible section. Add, close, or remove folders any time. Open a single file too.
- **Pinned files** — pin your go-to files to a section at the top of the sidebar (right-click, or the pin that appears on hover).
- **Keyboard navigation** — with the sidebar focused, `↑`/`↓` move through files; `⇧↑`/`⇧↓` and `⇧-click` extend a multi-file selection.
- **Sort** — a compact menu: **Name (A–Z)** or **Recently edited**; every file shows a relative timestamp.
- **Live** — new and changed files appear automatically; a **Refresh** button re-scans on demand.
- **Find fast** — `⌘P` fuzzy switcher · `⌘⇧F` full-text search across folders · `⌘F` find-in-file · a scroll-spy table of contents with adjustable text size.

**Read**
- **Rich preview** — GFM tables, task lists, syntax-highlighted code, callouts, images, a frontmatter header, **KaTeX math**, and **Mermaid diagrams**.
- **Built for focus** — refined typography; resizable panels; collapse the sidebar or contents rail right from the divider (a circular handle appears on hover), or one **focus button** to hide everything. A **Reading / Editing** badge always shows your mode.
- **Themes** — light (*Bloom*) / dark (*Dusk*) following the system, **16 accent presets**, a **bring-your-own custom colour**, and adjustable sidebar & index text sizes.

**Create & edit**
- **New files** (`⌘N`) and **folders** (`⌘⇧N`) — from the menu or the sidebar `+`; code files get syntax highlighting; extension-less files default to `.txt`.
- **Manage files** — **rename** (or double-click), **duplicate**, **move** by dragging onto a folder, **copy path / relative path**, and **delete to Trash** with **multi-select** — all from right-click.
- **Light editing** — `⌘E` toggles a CodeMirror editor with a scroll-synced live preview (the cursor lands ready to type); `⌘S` saves. Prompts before losing unsaved edits.
- **Export** — self-contained **HTML** or **PDF** with a customisable header, footer, and page numbers; always rendered light for clean printing and sharing.

**Stay current**
- **In-app updates** — Orchid checks for new releases and shows an in-app card when one's out (**Check for Updates…** in the app menu); one click to download.

<div align="center">

### Light &amp; dark

Orchid follows your system appearance — **Bloom** (light) and **Dusk** (dark) — or pin either.

<img src="docs/img/hero-dark.png" width="780" alt="The same document in dark mode (Dusk)" />
<br/><em>Dusk — the same document in dark mode</em>
<br/><br/>
<img src="docs/img/workspace.png" width="780" alt="Multi-folder workspace with rich preview" />
<br/><em>Pinned files · multi-folder workspaces · contents rail</em>
<br/><br/>
<img src="docs/img/themes.png" width="780" alt="Accent presets" />
<br/><em>16 accent presets + a custom colour</em>
</div>

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Open a folder or file | `⌘O` |
| Add a folder to the workspace | `⇧⌘O` |
| Refresh (re-scan) | `⌘R` |
| Jump to a file | `⌘P` |
| Find in this file | `⌘F` |
| Find across all files | `⌘⇧F` |
| Preview ⇄ Edit | `⌘E` |
| Save | `⌘S` |
| Toggle sidebar / contents | `⌘.` / `⌘⌥.` |
| Keyboard shortcuts | `⌘/` |

> Tip: drag a folder or file onto the window, right-click a file to reveal/trash it, or ⌘-click several files to delete them together.

## Build from source

```bash
git clone https://github.com/avnat/orchid.git
cd orchid
npm install
npm run dev      # launch with hot reload
npm run build    # bundle to out/
npm run dist     # package a signed .dmg into dist/
```

See [`CONCEPT.md`](CONCEPT.md) for the design rationale, and the in-app **Help → Contributing & Developer Info**.

## Acknowledgements

Orchid stands on the shoulders of remarkable open-source work — every dependency below is MIT- or similarly permissively licensed. Thank you to their authors and maintainers.

- **Rendering** — [react-markdown](https://github.com/remarkjs/react-markdown) with the [remark](https://github.com/remarkjs/remark) / [rehype](https://github.com/rehypejs/rehype) ecosystem turns Markdown into the preview.
- **Math** — [KaTeX](https://katex.org). **Diagrams** — [Mermaid](https://mermaid.js.org).
- **Code highlighting** — [highlight.js](https://highlightjs.org) (preview) and [CodeMirror 6](https://codemirror.net) (editor and code files).
- **Desktop shell** — [Electron](https://www.electronjs.org), bundled with [Vite](https://vitejs.dev) / [electron-vite](https://electron-vite.org) and packaged by [electron-builder](https://www.electron.build).
- **State** — [Zustand](https://github.com/pmndrs/zustand). **File watching** — [chokidar](https://github.com/paulmillr/chokidar). **UI** — [React](https://react.dev), [TypeScript](https://www.typescriptlang.org).

## Contributing

Issues and pull requests are welcome. Run `npm run typecheck` before pushing, and keep changes in the style of their neighbours. Version history lives in [`CHANGELOG.md`](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 Avnee.

<div align="center"><sub>Concept by Avnee · Built by Claude 🌸</sub></div>
