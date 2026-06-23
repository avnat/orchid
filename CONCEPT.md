# Orchid — Concept

> A native macOS app for **navigating and previewing markdown beautifully**, with light editing as a secondary mode. Built for the world where Claude (and other tools) generate piles of `.md` files and a human needs to read, browse, and lightly fix them. Named for the orchid — exotic, elegant, quietly purple.

---

## 1. Vision & principles

**The preview is the product.** Most markdown apps treat preview as a sidecar to the editor. We invert that. You open a folder full of `.md` files, and Lumen becomes a calm, gorgeous reading surface for them. Editing exists, but it's something you *toggle into*, not the default state.

Design principles:

1. **Reading-first.** Typography, spacing, and theme quality are not afterthoughts — they're the core feature. The preview should feel like a well-set document, not a rendered textarea.
2. **Folder-native.** The unit of work is a *folder*, not a single file. Point Lumen at a directory and it surfaces every markdown file inside, ignoring the noise.
3. **Live.** When Claude rewrites a file on disk, the preview updates itself. No manual refresh. The app is a window onto the filesystem, not a copy of it.
4. **Quietly native.** Real macOS window, menus, traffic lights, keyboard conventions, dark mode that follows the system. It should feel like it belongs on the Mac.
5. **Zero-config.** No project files, no databases, no import step. Open a folder, read.

---

## 2. Core user journeys

**J1 — Open a folder and read.**
`⌘O` (or drag a folder onto the dock icon) → sidebar fills with the markdown files in that tree → click one → it renders in the preview pane. This is the 90% path.

**J2 — Browse Claude's output.**
Claude just generated `docs/`, `specs/`, `plans/` full of `.md`. User opens the parent folder. Sidebar shows the tree, **markdown files only**, folder structure preserved, non-markdown hidden. User arrows up/down through files, each rendering instantly.

**J3 — Watch a file change.**
User is previewing `PLAN.md`. Claude rewrites it. The preview re-renders in place, scroll position preserved as best as possible. A subtle "updated" pulse confirms it.

**J4 — Quick fix.**
User spots a typo. `⌘E` flips the current file into edit mode (or split view). They fix it, `⌘S` saves to disk. `⌘E` flips back to clean preview.

**J5 — Find something.**
`⌘P` opens a quick file switcher (fuzzy filename search). `⌘⇧F` searches *content* across all markdown in the folder and lists hits.

---

## 3. Feature set

### MVP (v0.1 — the spine)
- **Open Folder** via menu, `⌘O`, drag-and-drop, and "Recent Folders."
- **Markdown-only file tree** in the sidebar: recurse the folder, keep `.md` / `.markdown` / `.mdx`, preserve directory hierarchy, collapse/expand folders, hide everything else. Respect `.gitignore`-style noise (skip `node_modules`, `.git`, dotfolders) by default.
- **Rich preview** with the full pipeline (see §5): GFM, tables, task lists, code with syntax highlighting, blockquotes, images (relative paths resolved against the file's folder), links.
- **Light/Dark theme** following the system, manual override.
- **Toggle edit mode** (`⌘E`): CodeMirror 6 editor; **split view** option with scroll-synced live preview; `⌘S` saves.
- **Live reload** on external file change (file watcher).

### v0.1+ — recency & the Claude workflow (high-value, pulled forward)
*These exist because the core use case is "Claude just generated a pile of files."*
- **Recency-aware sidebar**: sort by modified time, and badge files changed in the last N minutes as "new/updated" (a dot). You instantly see what Claude just wrote.
- **Follow mode**: optionally auto-select & open the file that just changed on disk, so you can watch generation happen live.
- **Diff on change**: when a watched file is rewritten, offer "View what changed" (inline diff) — not just a silent reload.
- **Code block copy buttons** (table stakes — people copy Claude's code constantly).
- **Reveal in Finder / Open in external editor** (right-click on a file).
- **Sidebar filename filter** (quick type-to-filter the tree, distinct from content search).
- **Interactive task checkboxes**: clicking `- [ ]` in the preview writes the change back to disk — great for the plans/todos Claude emits.

### v0.2 — the rich layer
- **Mermaid** diagrams (```mermaid fences render as SVG).
- **KaTeX** math (`$inline$` and `$$block$$`).
- **Frontmatter** rendered as a tidy metadata header (not raw YAML dump).
- **Auto Table of Contents** from headings, with scroll-spy in a slim right rail.
- **Quick file switcher** (`⌘P`, fuzzy).
- **Reading themes** beyond light/dark: sepia, high-contrast; adjustable reading width & font size.

### v0.3 — polish & power
- **Content search** across the folder (`⌘⇧F`).
- **Code block copy buttons**, line numbers, language labels.
- **Export** current file to HTML / PDF (local file only).
- **Outline-aware navigation**, breadcrumbs, "next/prev file" keys.
- **Image lightbox**, callout/admonition styling (`> [!NOTE]`).
- **Persisted UI state** per folder (last open file, sidebar width, theme).

### Explicitly out of scope (for now)
- WYSIWYG/rich-text editing (we stay source-markdown in edit mode).
- Multi-folder workspaces, tabs across windows, sync, plugins.
- Wiki-links / backlink graph (Obsidian territory).

---

## 4. UX & layout

```
┌───────────────────────────────────────────────────────────┐
│ ●●●  Lumen — ~/work/claude-output            [◧ split] [✎] │  ← native titlebar + toggles
├──────────────┬────────────────────────────────┬───────────┤
│  SIDEBAR     │        PREVIEW (the star)        │   TOC     │
│              │                                  │  rail     │
│ ▾ specs/     │   # Architecture Plan            │  • Intro  │
│   • plan.md  │                                  │  • Goals  │
│   • api.md   │   Beautifully set body text,     │  • API    │
│ ▾ docs/      │   generous measure, real         │           │
│   • intro.md │   typographic hierarchy…         │           │
│   • setup.md │                                  │           │
│              │   ```mermaid → rendered SVG      │           │
│ [search ⌘P]  │   $$ math $$ → rendered          │           │
└──────────────┴────────────────────────────────┴───────────┘
```

- **Three panes**, all collapsible: sidebar (file tree), preview, TOC rail. Preview is always center stage and gets the most room.
- **Edit mode (`⌘E`)** swaps the preview area for either (a) full editor or (b) editor+preview split, with synced scrolling.
- **Reading mode**: hide sidebar + TOC (`⌘.`) for distraction-free full-bleed reading.
- **Keyboard-driven**: ↑/↓ move through files, `⌘O` open folder, `⌘P` switch file, `⌘E` edit, `⌘S` save, `⌘.` focus mode, `⌘+/-` font size, `⌘[ / ⌘]` back/forward.
- Empty state: a friendly "Open a folder to begin" with the recent-folders list.

**Design tone (decided): refined, editorial & subtle.** Distinctive, high-craft typography that reads like a beautifully set document — characterful headings, clean sans body, generous measure. The palette is **near-monochrome cool-neutral** with only a **whisper of muted violet** as the single accent. Calm and quiet, in the spirit of Bear / iA Writer — the color never shouts. **Dark mode is first-class**, not an afterthought.

**Edit-conflict handling (decided):** when a file changes on disk while you hold unsaved edits, show a non-blocking banner — `⚠ File changed on disk — [Keep mine] [Load theirs] [View diff]`. Never silently discard work. When not editing, external changes reload live (with scroll preserved).

---

## 5. Technical architecture

**Stack:** Electron + TypeScript + React + Vite (via `electron-vite`), packaged with `electron-builder`.

```
┌─────────────────────── Main process (Node) ───────────────────────┐
│ • Window & menu lifecycle, native dialogs (Open Folder)            │
│ • Filesystem: recursive .md scan, read/write files                 │
│ • File watching (chokidar) → push change events to renderer        │
│ • Recent folders, persisted state (electron-store)                 │
└────────────────────────────┬───────────────────────────────────────┘
                  IPC (contextBridge / preload, validated channels)
┌────────────────────────────┴───────────────────────────────────────┐
│                     Renderer process (React)                         │
│ • Sidebar tree · Preview pane · TOC rail · Editor                    │
│ • Markdown pipeline (unified/remark/rehype)                          │
│ • CodeMirror 6 editor · state mgmt (Zustand)                         │
└──────────────────────────────────────────────────────────────────────┘
```

**Security posture (non-negotiable for an app that reads arbitrary files):**
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- All Node/FS access lives in main; renderer talks through a typed `preload` bridge exposing a narrow, validated API (e.g. `openFolder`, `readFile`, `writeFile`, `onFileChanged`).
- Renderer never touches `fs` directly. Markdown HTML is sanitized before render. Local images served via a custom protocol scoped to the open folder (no arbitrary disk reads).

**Markdown rendering pipeline (renderer):**
`unified` → `remark-parse` → `remark-gfm` → `remark-frontmatter` → `remark-math` → `remark-rehype` (allowDangerousHtml, then sanitize) → `rehype-katex` → syntax highlighting (`shiki` via `rehype-pretty-code`) → custom `mermaid` handler for code fences → `rehype-sanitize` → React render. Rendered as React components (not `dangerouslySetInnerHTML` where avoidable) for interactivity (copy buttons, lightbox, scroll-spy anchors).

**Editor:** CodeMirror 6 with markdown language support, soft-wrap, theme matched to app. Edits debounce-render into the preview in split mode.

**Why these choices:** unified/rehype gives the richest, safest, most extensible pipeline (math, mermaid, GFM, sanitization all first-class). Shiki gives VS Code-grade highlighting. CodeMirror 6 is the modern, lightweight editor standard. Zustand keeps state simple. electron-vite gives fast HMR dev loop.

---

## 6. Project structure

```
lumen/
├─ package.json
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ src/
│  ├─ main/            # main process: window, menu, fs, watcher, ipc
│  │  ├─ index.ts
│  │  ├─ fs-scan.ts    # recursive markdown discovery
│  │  ├─ watcher.ts    # chokidar
│  │  └─ ipc.ts
│  ├─ preload/
│  │  └─ index.ts      # contextBridge typed API
│  └─ renderer/
│     ├─ App.tsx
│     ├─ components/   # Sidebar, Preview, Toc, Editor, EmptyState
│     ├─ markdown/     # unified pipeline + custom nodes (mermaid, katex)
│     ├─ store/        # zustand
│     └─ styles/       # themes, typography
└─ resources/          # icons, entitlements
```

---

## 7. Build, run, package

- **Dev:** `npm run dev` → electron-vite with HMR.
- **Build:** `npm run build` → bundle main/preload/renderer.
- **Package:** `npm run dist` → electron-builder produces a `.dmg` / `.app` for arm64 + x64 (universal). Code-signing + notarization deferred until distribution is actually needed (personal use can run unsigned).

---

## 8. Phased build plan

- **Phase 0 — Skeleton:** ✅ electron-vite + React + TS scaffold, native window/menu, "Open Folder" dialog, recursive `.md` scan, sidebar tree rendering markdown files only, click-to-select, recency dots, filter. *Outcome: you can browse a folder's markdown.*
- **Phase 1 — Preview spine:** ✅ react-markdown pipeline with GFM + syntax highlighting + images + sanitization + frontmatter header, refined typography & Bloom/Dusk themes following the system. *Outcome: the preview looks great.*
- **Phase 2 — Live + edit:** ✅ (basic) chokidar watch → live reload + conflict banner; `⌘E` edit mode + split + save; `⌘.` focus mode. *Editor is a styled textarea for now — swap to CodeMirror 6 with scroll-sync next.*
- **Phase 3 — Rich layer:** ✅ mermaid diagrams, KaTeX math, frontmatter header, TOC rail with scroll-spy, `⌘P` fuzzy switcher, CodeMirror 6 editor with scroll-sync.
- **Phase 4 — Polish:** ✅ content search (`⌘⇧F`), export to HTML/PDF (self-contained, theme-embedded), hidable sidebar (`⌘.`) & TOC (`⌘⌥.`) with persisted state, keyboard-shortcuts panel (`⌘/`, spelled-out keys), theme-aware kachnar logo, **app icon**, and **`.dmg` packaging**.
- **v0.1.1:** ✅ **multi-folder workspaces** (each folder a collapsible section; add/close), **open a single file**, **refresh** + **Name/Recent sort**, wider full-bleed reading, lighter dark code blocks, calmer accent usage, expanded **16-accent** palette (incl. cool/neutral Slate · Steel · Graphite · Pine), and **ad-hoc signing** so downloads aren't flagged "damaged".
- **v0.1.2:** ✅ unified **Open** (file *or* folder in one dialog), **resizable** left/right/center panels (persisted), configurable **sidebar text size** (S/M/L), bold high-contrast folder headers, **`⌘F` find-in-file** (document-scoped via the CSS Custom Highlight API, with count + next/prev), and a **save-on-quit prompt** + discard-guard on file switch to prevent data loss. *Remaining: reading-width/font controls, follow-mode + diff, interactive checkboxes; notarized/universal build for wide distribution.*

---

## 9. Decisions log

**Resolved:**
- Name: **Orchid**.
- Stack: **Electron + TypeScript + React + Vite**.
- Scope: **preview-first with light editing** (`⌘E` toggle + split).
- Edit conflicts: **warn + choose** (banner).
- Design tone: **refined, editorial & subtle** — near-monochrome cool neutrals + muted violet.
- Accent: **configurable presets** (Slack-style), default **Orchid** violet. **16-swatch** set grouped by hue, each tuned for light + dark: violets/pink (Orchid · Iris · Plum · Fuchsia), blues + slate (Periwinkle · Azure · Slate · Steel), neutral (Graphite), greens (Lagoon · Teal · Jade · Pine), warms (Marigold · Coral · Rose). Accent reserved for meaningful spots (links, active file, callouts, TOC) — incidental elements stay neutral. Picked from a titlebar swatch popover; persisted.
- Themes: **Bloom** (light) / **Dusk** (dark) with **Appearance = System / Bloom / Dusk** (default System).
- Extensions: treat `.md`, `.markdown`, `.mdx` as markdown.
- Window model: single window; **multi-folder workspaces** + single-file open.

**Still open:**
1. **Distribution** — personal use (unsigned) vs. eventual notarized distributable. Defer signing until distribution is needed.

---

## 10. Name & palette (proposals)

### Name shortlist — exotic flowers, easy to pronounce
| Name | Flower | Read | Notes |
|------|--------|------|-------|
| **Orchid** | orchid | exotic, elegant, naturally purple | Easy to say, brandable, beautiful. Strong fit for a subtle purple app. |
| **Wisteria** | wisteria | cascading purple blooms | Inherently purple; slightly longer but lovely (wis-TEER-ee-uh). |
| **Aster** | aster | star-shaped purple flower | Short, modern, brandable; "aster" = star. Very easy. |
| **Iris** | iris | purple iris | Short, soft, easy; note the eye/iris overload. |
| **Freesia** | freesia | fragrant, exotic | Easy (FREE-zha), distinctive. |
| **Protea** | protea | striking South African bloom | Very exotic, easy (PRO-tee-uh), unusual & memorable. |
| **Lila** | lilac (dim.) | soft, purple | Short, gentle, "lila" literally means purple in several languages. |

### Palette direction (subtle, cool-neutral + muted violet)
Near-monochrome neutrals with a single quiet violet accent. The accent appears only on links, the active file, focus rings, and the "new/updated" badge — everything else stays neutral.

- **Light ("Bloom"):** background `#FBFAFD` (faint cool off-white), surface `#FFFFFF`, text `#1B1A21` (near-black, slight cool), muted `#6E6A78`, hairlines `#ECEAF1`.
- **Dark ("Dusk") — first-class:** background `#141318` (cool near-black, faint violet undertone), surface `#1C1A22`, text `#E8E5EF`, muted `#928CA0`, hairlines `#29262F`.
- **Accent — muted violet:** light `#6E56CF`, dark `#A28BE0` (lighter for contrast on dark). Restrained, never neon. Two intensity options to choose from in §below.
- **Semantic (desaturated):** success `#5E8C72`, warning `#B8923E`, danger `#C05E5E`; "new/updated" badge = accent.
- **Code blocks:** custom Shiki theme tuned to Bloom/Dusk so code feels part of the document, with a faint violet tint to keywords.
- **Typography:** characterful serif headings (*Newsreader* / *Source Serif*), clean humanist sans body (*Inter* / system), mono code (*JetBrains Mono* / *SF Mono*).

#### Accent intensity options
- **A — Whisper (recommended):** desaturated dusty violet, accent `#7E6BB8` (light) / `#A99AD4` (dark). Maximally subtle; reads almost gray until you look.
- **B — Signature:** clearer violet, `#6E56CF` (light) / `#A28BE0` (dark). Still calm but unmistakably purple on links/active states.
