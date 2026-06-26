<div align="center">

<img src="docs/img/icon.png" width="116" alt="Orchid" />

# Orchid

**A calm, native macOS reader for the Markdown your tools generate.**

Point it at a folder (or several) and Orchid surfaces every Markdown file inside —
beautifully rendered, live-updating, and built for *reading*. Now also creates, edits,
and syntax-highlights code files.

[![Download — latest release](https://img.shields.io/github/v/release/avnat/orchid?label=download&color=7c4dd6&sort=semver)](https://github.com/avnat/orchid/releases/latest)
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
- **Collapse / expand all** — one click in the sidebar toolbar to fold every folder, or open them all back up.
- **Find fast** — `⌘P` fuzzy switcher · `⌘⇧F` full-text search across folders · `⌘F` find-in-file · a scroll-spy table of contents with adjustable text size.

**Read**
- **Rich preview** — GFM tables, task lists, syntax-highlighted code, callouts, images, a frontmatter header, **KaTeX math**, and **Mermaid diagrams**.
- **PDF reading** — open a `.pdf` and read it right in Orchid's own calm viewer (not the grey system one): fit-to-width, zoom, selectable text, and find (`⌘F`) across the whole document.
- **Built for focus** — refined typography; resizable panels; collapse the sidebar or contents rail right from the divider (a circular handle appears on hover), or one **focus button** to hide everything. A **Reading / Editing** badge always shows your mode.
- **Themes** — light (*Bloom*) / dark (*Dusk*) following the system, **13 accent presets**, a **bring-your-own custom colour**, and adjustable sidebar & index text sizes.

**Create & edit**
- **New files** (`⌘N`) and **folders** (`⌘⇧N`) — from the menu or the sidebar `+`; code files get syntax highlighting; extension-less files default to `.txt`.
- **Manage files** — **rename** (or double-click), **duplicate**, **move** by dragging onto a folder, **copy path / relative path**, and **delete to Trash** with **multi-select** — all from right-click.
- **Light editing** — `⌘E` toggles a CodeMirror editor with a scroll-synced live preview (the cursor lands ready to type); `⌘S` saves. Full cut / copy / paste / undo (keyboard **and** right-click), and an Edit menu. Prompts before losing unsaved edits.
- **Export** — self-contained **HTML** or **PDF** with a customisable header, footer, and page numbers; always rendered light for clean printing and sharing.

**Stay current**
- **In-app updates** — Orchid checks for new releases and shows an in-app card when one's out (**Check for Updates…** in the app menu); one click to download.
- **Know your version** — shown in **Orchid → About Orchid**, on the launch screen, and in Settings.
- **Resilient** — a stray error no longer takes the app down (a crashed view quietly reloads), and crashes are recorded so they can be diagnosed.

<div align="center">

### Light &amp; dark

Orchid follows your system appearance — **Bloom** (light) and **Dusk** (dark) — or pin either.

<img src="docs/img/hero-dark.png" width="780" alt="A Mermaid diagram rendered in dark mode (Dusk)" />
<br/><em>Dusk — Mermaid diagrams, math, and code, rendered live</em>
<br/><br/>
<img src="docs/img/workspace.png" width="780" alt="Multi-folder workspace with rich preview" />
<br/><em>Pinned files · multi-folder workspaces · contents rail</em>
<br/><br/>
<img src="docs/img/themes.png" width="780" alt="Accent presets" />
<br/><em>13 accent presets + a custom colour</em>
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

**Every shortcut is customisable** — open **Settings** (`⌘,` or the gear in the titlebar), click a command, and press the keys you want. On a Windows-style keyboard you can bind `Ctrl`-based shortcuts (macOS treats `⌘` and `Ctrl` as distinct).

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

## Releases

Builds are produced by **GitHub Actions**, not by hand:

- Each release is **tagged** `vX.Y.Z`. Pushing that tag triggers the release workflow, which builds the macOS (Apple Silicon) `.dmg`, ad-hoc signs it, and publishes a **GitHub Release** with the dmg attached.
- The newest stable build is always at **[/releases/latest](https://github.com/avnat/orchid/releases/latest)** — that's the one to download (and the **Download** badge above links straight to it).
- Every past version stays on the **[Releases page](https://github.com/avnat/orchid/releases)**, so you can always go back to an older build. Build logs live under the **[Actions tab](https://github.com/avnat/orchid/actions)**.
- Release candidates are tagged `vX.Y.Z-rc.N` and published as **prereleases** — testable, but never marked "latest" (and skipped by the in-app updater).

## Acknowledgements

Orchid stands on the shoulders of remarkable open-source work — every dependency below is MIT- or similarly permissively licensed. Thank you to their authors and maintainers.

- **Rendering** — [react-markdown](https://github.com/remarkjs/react-markdown) with the [remark](https://github.com/remarkjs/remark) / [rehype](https://github.com/rehypejs/rehype) ecosystem turns Markdown into the preview.
- **Math** — [KaTeX](https://katex.org). **Diagrams** — [Mermaid](https://mermaid.js.org).
- **Code highlighting** — [highlight.js](https://highlightjs.org) (preview) and [CodeMirror 6](https://codemirror.net) (editor and code files).
- **Desktop shell** — [Electron](https://www.electronjs.org), bundled with [Vite](https://vitejs.dev) / [electron-vite](https://electron-vite.org) and packaged by [electron-builder](https://www.electron.build).
- **State** — [Zustand](https://github.com/pmndrs/zustand). **File watching** — [chokidar](https://github.com/paulmillr/chokidar). **UI** — [React](https://react.dev), [TypeScript](https://www.typescriptlang.org).

## Contributing

Contributions are welcome — the project runs a normal issue → branch → PR flow:

1. **Open an issue** describing the bug or feature (use the Bug / Feature templates).
2. **Branch** off `main` (`fix/…`, `feat/…`, `chore/…`), make your change, and run `npm run typecheck`.
3. **Open a pull request** linking the issue (`Closes #NN`). CI (typecheck + build) runs automatically; the maintainer reviews and merges — `main` is protected, so changes land via PR, not direct pushes.

Keep changes focused and in the style of their neighbours, and don't add company-specific or proprietary content to the sample/docs. Full details in [`CONTRIBUTING.md`](CONTRIBUTING.md); version history in [`CHANGELOG.md`](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 Avnee.

<div align="center"><sub>Concept by Avnee · Built by Claude 🌸</sub></div>
