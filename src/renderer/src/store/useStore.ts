import { create } from 'zustand'
import type { WorkspaceFolder } from '../types'
import type { Appearance } from '../themes'
import { isPdfFile } from '../markdown/langs'

export type SortMode = 'name' | 'recent'
export type TextSize = 'sm' | 'md' | 'lg'

const lsGet = (k: string, fallback: string): string => {
  try {
    return localStorage.getItem(k) ?? fallback
  } catch {
    return fallback
  }
}
const lsSet = (k: string, v: string): void => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

/**
 * A background tab's document state. The ACTIVE tab lives in the top-level
 * fields (content, savedContent, editMode, conflict, unsupported) so every
 * existing consumer keeps reading "the open document" — switching tabs stashes
 * the outgoing document here and restores the incoming one.
 */
export interface TabSnapshot {
  content: string
  savedContent: string
  editMode: boolean
  conflict: boolean
  unsupported: boolean
}

const blankDoc: TabSnapshot = {
  content: '',
  savedContent: '',
  editMode: false,
  conflict: false,
  unsupported: false
}

const snapOf = (s: TabSnapshot): TabSnapshot => ({
  content: s.content,
  savedContent: s.savedContent,
  editMode: s.editMode,
  conflict: s.conflict,
  unsupported: s.unsupported
})

interface OrchidState {
  folders: WorkspaceFolder[]
  activePath: string | null
  /** ordered paths of the open tabs (the active file is one of them) */
  tabs: string[]
  /** background tabs' document state, keyed by path (never holds the active tab) */
  stash: Record<string, TabSnapshot>
  /**
   * The preview tab (italic title): single-click browsing reuses this one slot
   * instead of piling up tabs. It pins itself — becoming a regular tab — when
   * edited or opened deliberately (double-click / Open in New Tab).
   */
  previewPath: string | null
  /** content as shown (may include unsaved edits) */
  content: string
  /** content last loaded from / saved to disk */
  savedContent: string
  editMode: boolean
  /** sidebar collapsed (its own divider circle / left-edge reveal) */
  focusMode: boolean
  /** external change arrived while we hold unsaved edits */
  conflict: boolean
  /** OS dark-mode flag */
  systemDark: boolean
  appearance: Appearance
  accentKey: string
  customAccent: string
  /** active file can't be shown as text (binary/unsupported) */
  unsupported: boolean
  /** multi-selected file/folder paths (for batch delete) */
  selected: string[]
  /** selection mode shows checkboxes for picking multiple items */
  selectMode: boolean
  tocVisible: boolean
  sortMode: SortMode
  sidebarWidth: number
  tocWidth: number
  sidebarTextSize: TextSize
  /** text size of the "On this page" index */
  tocTextSize: TextSize
  /** editor pane width as a fraction of the split (edit mode) */
  splitRatio: number
  /** pinned file paths (quick-access section at the top of the sidebar) */
  pinned: string[]
  /** path currently being renamed inline in the sidebar (null = none) */
  renaming: string | null
  filter: string

  setWorkspace: (folders: WorkspaceFolder[], select?: string) => void
  setSortMode: (mode: SortMode) => void
  setSidebarWidth: (w: number) => void
  setTocWidth: (w: number) => void
  setSidebarTextSize: (s: TextSize) => void
  setTocTextSize: (s: TextSize) => void
  setSplitRatio: (r: number) => void
  togglePin: (path: string) => void
  renamePath: (oldPath: string, newPath: string) => void
  setRenaming: (path: string | null) => void
  commitRename: (oldPath: string, newName: string) => Promise<void>
  commitMove: (src: string, destDir: string) => Promise<void>
  selectFile: (path: string, opts?: { newTab?: boolean }) => Promise<void>
  /** Close a tab (the active one by default). Returns false if the user kept it. */
  closeTab: (path?: string) => boolean
  /** Close many tabs at once (a single discard prompt covers all dirty ones). */
  closeTabs: (paths: string[]) => boolean
  /** Turn the preview tab into a regular tab (no-op for any other path). */
  pinTab: (path: string) => void
  /** Switch to the neighbouring tab (1 = next, -1 = previous), wrapping around. */
  cycleTab: (dir: 1 | -1) => void
  moveTab: (from: number, to: number) => void
  reloadActive: () => Promise<void>
  setContent: (content: string) => void
  save: () => Promise<void>
  /** Save every dirty tab (used by the window-close guard). */
  saveAll: () => Promise<void>
  toggleEdit: () => void
  setEditMode: (on: boolean) => void
  toggleFocus: () => void
  toggleToc: () => void
  /** master show/hide for all side panels (the fullscreen button) */
  toggleFullscreen: () => void
  setSystemDark: (dark: boolean) => void
  setAppearance: (a: Appearance) => void
  setAccent: (key: string) => void
  setCustomAccent: (hex: string) => void
  toggleSelected: (path: string) => void
  selectMany: (paths: string[], on: boolean) => void
  setSelected: (paths: string[]) => void
  clearSelected: () => void
  setSelectMode: (on: boolean) => void
  setFilter: (q: string) => void
  onExternalChange: (path: string) => void
  resolveConflict: (action: 'mine' | 'theirs') => Promise<void>
}

const dirty = (s: { content: string; savedContent: string }): boolean =>
  s.content !== s.savedContent

function flatHas(nodes: WorkspaceFolder['tree'], path: string): boolean {
  for (const n of nodes) {
    if (n.type === 'file' && n.path === path) return true
    if (n.children && flatHas(n.children, path)) return true
  }
  return false
}

export const useStore = create<OrchidState>((set, get) => ({
  folders: [],
  activePath: null,
  tabs: [],
  stash: {},
  previewPath: null,
  content: '',
  savedContent: '',
  editMode: false,
  focusMode: false,
  conflict: false,
  systemDark: false,
  appearance: lsGet('orchid.appearance', 'system') as Appearance,
  accentKey: lsGet('orchid.accent', 'orchid'),
  customAccent: lsGet('orchid.customAccent', '#7c4dd6'),
  unsupported: false,
  selected: [],
  selectMode: false,
  tocVisible: lsGet('orchid.toc', 'true') !== 'false',
  sortMode: lsGet('orchid.sort', 'name') as SortMode,
  sidebarWidth: Math.min(520, Math.max(180, Number(lsGet('orchid.sidebarW', '248')) || 248)),
  tocWidth: Math.min(420, Math.max(140, Number(lsGet('orchid.tocW', '210')) || 210)),
  sidebarTextSize: lsGet('orchid.sideText', 'md') as TextSize,
  tocTextSize: lsGet('orchid.tocText', 'md') as TextSize,
  splitRatio: Math.min(0.75, Math.max(0.25, Number(lsGet('orchid.split', '0.5')) || 0.5)),
  pinned: (() => {
    try {
      return JSON.parse(lsGet('orchid.pinned', '[]')) as string[]
    } catch {
      return []
    }
  })(),
  renaming: null,
  filter: '',

  setWorkspace: (folders, select) =>
    set((s) => {
      // prune pinned paths whose files no longer exist in the workspace
      const pinned = s.pinned.filter((p) => folders.some((f) => flatHas(f.tree, p)))
      const pinnedChanged = pinned.length !== s.pinned.length
      if (pinnedChanged) lsSet('orchid.pinned', JSON.stringify(pinned))
      // drop tabs whose files no longer exist (the active one survives while a
      // select is in flight — it's about to be replaced anyway)
      const keep = (p: string): boolean =>
        folders.some((f) => flatHas(f.tree, p)) || (!!select && p === s.activePath)
      const tabs = s.tabs.filter(keep)
      const stash: Record<string, TabSnapshot> = {}
      for (const [p, snap] of Object.entries(s.stash)) if (keep(p)) stash[p] = snap
      // if the active file vanished, fall back to a surviving tab, else empty
      let active = {}
      if (s.activePath && !keep(s.activePath)) {
        const i = s.tabs.indexOf(s.activePath)
        const next = tabs.length ? tabs[Math.min(Math.max(i, 0), tabs.length - 1)] : null
        if (next) {
          active = { activePath: next, ...(stash[next] ?? blankDoc) }
          delete stash[next]
        } else {
          active = { activePath: null, ...blankDoc, focusMode: false }
        }
      }
      return {
        folders,
        tabs,
        stash,
        previewPath: s.previewPath && tabs.includes(s.previewPath) ? s.previewPath : null,
        ...(pinnedChanged ? { pinned } : {}),
        selected: [],
        ...active
      }
    }),
  setSortMode: (mode) => {
    lsSet('orchid.sort', mode)
    set({ sortMode: mode })
  },
  setSidebarWidth: (w) => {
    const v = Math.min(520, Math.max(180, Math.round(w)))
    lsSet('orchid.sidebarW', String(v))
    set({ sidebarWidth: v })
  },
  setTocWidth: (w) => {
    const v = Math.min(420, Math.max(140, Math.round(w)))
    lsSet('orchid.tocW', String(v))
    set({ tocWidth: v })
  },
  setSidebarTextSize: (s) => {
    lsSet('orchid.sideText', s)
    set({ sidebarTextSize: s })
  },
  setTocTextSize: (s) => {
    lsSet('orchid.tocText', s)
    set({ tocTextSize: s })
  },
  setSplitRatio: (r) => {
    const v = Math.min(0.75, Math.max(0.25, r))
    lsSet('orchid.split', String(v))
    set({ splitRatio: v })
  },
  togglePin: (path) =>
    set((s) => {
      const pinned = s.pinned.includes(path)
        ? s.pinned.filter((p) => p !== path)
        : [...s.pinned, path]
      lsSet('orchid.pinned', JSON.stringify(pinned))
      return { pinned }
    }),
  renamePath: (oldPath, newPath) =>
    set((s) => {
      const pinned = s.pinned.map((p) => (p === oldPath ? newPath : p))
      if (pinned.some((p, i) => p !== s.pinned[i])) lsSet('orchid.pinned', JSON.stringify(pinned))
      let stash = s.stash
      if (oldPath in s.stash) {
        stash = { ...s.stash, [newPath]: s.stash[oldPath] }
        delete stash[oldPath]
      }
      return {
        pinned,
        stash,
        tabs: s.tabs.map((p) => (p === oldPath ? newPath : p)),
        ...(s.activePath === oldPath ? { activePath: newPath } : {}),
        ...(s.previewPath === oldPath ? { previewPath: newPath } : {})
      }
    }),
  setRenaming: (renaming) => set({ renaming }),
  commitRename: async (oldPath, newName) => {
    const name = newName.trim()
    set({ renaming: null })
    if (!name || name === oldPath.slice(oldPath.lastIndexOf('/') + 1)) return
    try {
      const newPath = await window.orchid.rename(oldPath, name)
      get().renamePath(oldPath, newPath) // keeps pin + open file pointing at the new path
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  },
  commitMove: async (src, destDir) => {
    try {
      const newPath = await window.orchid.move(src, destDir)
      if (newPath !== src) get().renamePath(src, newPath)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  },

  selectFile: async (path, opts) => {
    const s = get()
    if (path === s.activePath) {
      // a deliberate open (double-click / Open in New Tab) pins the preview tab
      if (opts?.newTab && s.previewPath === path) set({ previewPath: null })
      return
    }

    // Already open in a tab — just switch to it (its edits were stashed).
    if (s.tabs.includes(path)) {
      const stash = { ...s.stash }
      if (s.activePath) stash[s.activePath] = snapOf(s)
      const snap = stash[path] ?? blankDoc
      delete stash[path]
      set({
        activePath: path,
        stash,
        selected: [],
        ...snap,
        ...(opts?.newTab && s.previewPath === path ? { previewPath: null } : {})
      })
      return
    }

    // Single-click browsing reuses the one preview slot; a deliberate open
    // ({newTab}) always gets its own tab. The preview tab pins itself when
    // edited, so it is never dirty — a dirty one (defensive) counts as pinned.
    const pv = s.previewPath
    const pvOpen = !opts?.newTab && !!pv && s.tabs.includes(pv)
    const pvDirty =
      pvOpen &&
      (pv === s.activePath
        ? dirty(s)
        : s.stash[pv!]
          ? s.stash[pv!].content !== s.stash[pv!].savedContent
          : false)
    const stash = { ...s.stash }
    let tabs: string[]
    let previewPath: string | null
    if (pvOpen && !pvDirty) {
      // browse: the new file takes over the preview slot
      tabs = s.tabs.map((t) => (t === pv ? path : t))
      if (pv !== s.activePath) {
        if (s.activePath) stash[s.activePath] = snapOf(s)
        delete stash[pv!]
      }
      previewPath = path
    } else {
      // a fresh tab beside the active one; unsaved edits are never dropped —
      // the outgoing tab (dirty or pinned) simply stays open in the background
      if (s.activePath) stash[s.activePath] = snapOf(s)
      const at = s.activePath ? s.tabs.indexOf(s.activePath) + 1 : s.tabs.length
      tabs = [...s.tabs.slice(0, at), path, ...s.tabs.slice(at)]
      previewPath = opts?.newTab ? s.previewPath : path
    }

    // PDFs are rendered by the viewer, not read as text.
    if (isPdfFile(path)) {
      set({ tabs, stash, previewPath, activePath: path, content: '', savedContent: '', conflict: false, unsupported: false, editMode: false, selected: [] })
      return
    }
    try {
      const text = await window.orchid.readFile(path)
      set({ tabs, stash, previewPath, activePath: path, content: text, savedContent: text, conflict: false, unsupported: false, selected: [] })
    } catch {
      // binary / unsupported file — show a friendly message instead of garbage
      set({ tabs, stash, previewPath, activePath: path, content: '', savedContent: '', conflict: false, unsupported: true, editMode: false, selected: [] })
    }
  },

  pinTab: (path) => set((s) => (s.previewPath === path ? { previewPath: null } : {})),

  closeTab: (path) => {
    const s = get()
    const target = path ?? s.activePath
    if (!target || !s.tabs.includes(target)) return true
    const snap = s.stash[target]
    const isDirty =
      target === s.activePath ? dirty(s) : !!snap && snap.content !== snap.savedContent
    const name = target.slice(target.lastIndexOf('/') + 1)
    if (isDirty && !window.confirm(`Discard unsaved changes to "${name}"?`)) return false
    const i = s.tabs.indexOf(target)
    const tabs = s.tabs.filter((t) => t !== target)
    const stash = { ...s.stash }
    delete stash[target]
    const preview = target === s.previewPath ? { previewPath: null } : {}
    if (target !== s.activePath) {
      set({ tabs, stash, ...preview })
      return true
    }
    // closing the active tab: land on its right-hand neighbour, else the last tab
    const next = tabs.length ? tabs[Math.min(i, tabs.length - 1)] : null
    if (!next) {
      set({ tabs, stash, activePath: null, ...blankDoc, ...preview })
      return true
    }
    const nextSnap = stash[next] ?? blankDoc
    delete stash[next]
    set({ tabs, stash, activePath: next, selected: [], ...nextSnap, ...preview })
    return true
  },

  closeTabs: (paths) => {
    const s = get()
    const tset = new Set(paths.filter((p) => s.tabs.includes(p)))
    if (tset.size === 0) return true
    const isDirty = (p: string): boolean =>
      p === s.activePath ? dirty(s) : !!s.stash[p] && s.stash[p].content !== s.stash[p].savedContent
    const dirtyTargets = [...tset].filter(isDirty)
    if (dirtyTargets.length) {
      const msg =
        dirtyTargets.length === 1
          ? `Discard unsaved changes to "${dirtyTargets[0].slice(dirtyTargets[0].lastIndexOf('/') + 1)}"?`
          : `Discard unsaved changes to ${dirtyTargets.length} tabs?`
      if (!window.confirm(msg)) return false
    }
    const tabs = s.tabs.filter((t) => !tset.has(t))
    const stash = { ...s.stash }
    for (const p of tset) delete stash[p]
    const previewPath = s.previewPath && tset.has(s.previewPath) ? null : s.previewPath
    // an untouched active tab keeps everything as-is
    if (!s.activePath || !tset.has(s.activePath)) {
      set({ tabs, stash, previewPath })
      return true
    }
    // active tab closed: land on the nearest survivor — to the right first, then left
    const i = s.tabs.indexOf(s.activePath)
    const remaining = new Set(tabs)
    const order = [...s.tabs.slice(i + 1), ...s.tabs.slice(0, i).reverse()]
    const next = order.find((t) => remaining.has(t)) ?? null
    if (!next) {
      set({ tabs, stash, activePath: null, ...blankDoc, previewPath })
      return true
    }
    const nextSnap = stash[next] ?? blankDoc
    delete stash[next]
    set({ tabs, stash, activePath: next, selected: [], ...nextSnap, previewPath })
    return true
  },

  cycleTab: (dir) => {
    const s = get()
    if (s.tabs.length < 2 || !s.activePath) return
    const i = s.tabs.indexOf(s.activePath)
    void get().selectFile(s.tabs[(i + dir + s.tabs.length) % s.tabs.length])
  },

  moveTab: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.tabs.length || to >= s.tabs.length) return {}
      const tabs = [...s.tabs]
      const [t] = tabs.splice(from, 1)
      tabs.splice(to, 0, t)
      return { tabs }
    }),

  reloadActive: async () => {
    const { activePath } = get()
    if (!activePath) return
    const text = await window.orchid.readFile(activePath)
    set({ content: text, savedContent: text, conflict: false })
  },

  // Typing in the preview tab pins it — those edits deserve a tab of their own.
  setContent: (content) =>
    set((s) => ({
      content,
      ...(s.activePath && s.activePath === s.previewPath ? { previewPath: null } : {})
    })),

  save: async () => {
    const { activePath, content } = get()
    if (!activePath) return
    await window.orchid.writeFile(activePath, content)
    set({ savedContent: content, conflict: false })
  },

  saveAll: async () => {
    const s = get()
    for (const [p, snap] of Object.entries(s.stash)) {
      if (snap.content === snap.savedContent) continue
      try {
        await window.orchid.writeFile(p, snap.content)
        set((st) => ({
          stash: { ...st.stash, [p]: { ...snap, savedContent: snap.content, conflict: false } }
        }))
      } catch {
        /* keep that tab dirty — never block the others */
      }
    }
    if (s.activePath && dirty(s)) await get().save()
  },

  toggleEdit: () => set((s) => ({ editMode: !s.editMode })),
  setEditMode: (on) => set({ editMode: on }),
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode })),
  toggleToc: () =>
    set((s) => {
      const tocVisible = !s.tocVisible
      lsSet('orchid.toc', String(tocVisible))
      return { tocVisible }
    }),
  toggleFullscreen: () =>
    set((s) => {
      // if any panel is showing, hide them all; otherwise bring them all back
      const anyShown = !s.focusMode || s.tocVisible
      const tocVisible = !anyShown
      lsSet('orchid.toc', String(tocVisible))
      return { focusMode: anyShown, tocVisible }
    }),
  setSystemDark: (systemDark) => set({ systemDark }),
  setAppearance: (appearance) => {
    lsSet('orchid.appearance', appearance)
    set({ appearance })
  },
  setAccent: (accentKey) => {
    lsSet('orchid.accent', accentKey)
    set({ accentKey })
  },
  setCustomAccent: (hex) => {
    lsSet('orchid.customAccent', hex)
    lsSet('orchid.accent', 'custom')
    set({ customAccent: hex, accentKey: 'custom' })
  },
  toggleSelected: (path) =>
    set((s) => ({
      selected: s.selected.includes(path) ? s.selected.filter((p) => p !== path) : [...s.selected, path]
    })),
  selectMany: (paths, on) =>
    set((s) => {
      const next = new Set(s.selected)
      if (on) paths.forEach((p) => next.add(p))
      else paths.forEach((p) => next.delete(p))
      return { selected: [...next] }
    }),
  setSelected: (paths) => set({ selected: paths }),
  clearSelected: () => set({ selected: [] }),
  setSelectMode: (on) => set({ selectMode: on, ...(on ? {} : { selected: [] }) }),
  setFilter: (q) => set({ filter: q }),

  onExternalChange: (path) => {
    const s = get()
    if (path === s.activePath) {
      if (dirty(s)) {
        set({ conflict: true }) // surface the banner; let the user choose
      } else {
        void get().reloadActive() // not editing — reload live
      }
      return
    }
    // a background tab: dirty ones get a conflict flag (the banner shows when
    // the tab is activated), clean ones quietly pick up the new content
    const snap = s.stash[path]
    if (!snap) return
    if (snap.content !== snap.savedContent) {
      set((st) => ({ stash: { ...st.stash, [path]: { ...snap, conflict: true } } }))
    } else {
      window.orchid
        .readFile(path)
        .then((text) =>
          set((st) => ({
            stash: { ...st.stash, [path]: { ...snap, content: text, savedContent: text } }
          }))
        )
        .catch(() => {})
    }
  },

  resolveConflict: async (action) => {
    if (action === 'theirs') {
      await get().reloadActive()
    } else {
      await get().save() // keep mine: persist over the external change
    }
    set({ conflict: false })
  }
}))
