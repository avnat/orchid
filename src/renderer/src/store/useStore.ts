import { create } from 'zustand'
import type { WorkspaceFolder } from '../types'
import type { Appearance } from '../themes'

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

interface OrchidState {
  folders: WorkspaceFolder[]
  activePath: string | null
  /** content as shown (may include unsaved edits) */
  content: string
  /** content last loaded from / saved to disk */
  savedContent: string
  editMode: boolean
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
  filter: string

  setWorkspace: (folders: WorkspaceFolder[], select?: string) => void
  setSortMode: (mode: SortMode) => void
  setSidebarWidth: (w: number) => void
  setTocWidth: (w: number) => void
  setSidebarTextSize: (s: TextSize) => void
  selectFile: (path: string) => Promise<void>
  reloadActive: () => Promise<void>
  setContent: (content: string) => void
  save: () => Promise<void>
  toggleEdit: () => void
  setEditMode: (on: boolean) => void
  toggleFocus: () => void
  toggleToc: () => void
  setSystemDark: (dark: boolean) => void
  setAppearance: (a: Appearance) => void
  setAccent: (key: string) => void
  setCustomAccent: (hex: string) => void
  toggleSelected: (path: string) => void
  selectMany: (paths: string[], on: boolean) => void
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
  filter: '',

  setWorkspace: (folders, select) =>
    set((s) => ({
      folders,
      selected: [],
      // drop active selection (and any edit/conflict state) if its file no
      // longer exists in the workspace
      ...(select
        ? {}
        : s.activePath && !folders.some((f) => flatHas(f.tree, s.activePath!))
          ? { activePath: null, content: '', savedContent: '', editMode: false, conflict: false, focusMode: false }
          : {})
    })),
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

  selectFile: async (path) => {
    const s = get()
    // guard against silently dropping unsaved edits when switching files
    if (s.activePath && path !== s.activePath && dirty(s)) {
      const ok = window.confirm('Discard unsaved changes to the current file?')
      if (!ok) return
    }
    try {
      const text = await window.orchid.readFile(path)
      set({ activePath: path, content: text, savedContent: text, conflict: false, unsupported: false, selected: [] })
    } catch {
      // binary / unsupported file — show a friendly message instead of garbage
      set({ activePath: path, content: '', savedContent: '', conflict: false, unsupported: true, editMode: false, selected: [] })
    }
  },

  reloadActive: async () => {
    const { activePath } = get()
    if (!activePath) return
    const text = await window.orchid.readFile(activePath)
    set({ content: text, savedContent: text, conflict: false })
  },

  setContent: (content) => set({ content }),

  save: async () => {
    const { activePath, content } = get()
    if (!activePath) return
    await window.orchid.writeFile(activePath, content)
    set({ savedContent: content, conflict: false })
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
  clearSelected: () => set({ selected: [] }),
  setSelectMode: (on) => set({ selectMode: on, ...(on ? {} : { selected: [] }) }),
  setFilter: (q) => set({ filter: q }),

  onExternalChange: (path) => {
    const s = get()
    if (path !== s.activePath) return
    if (dirty(s)) {
      set({ conflict: true }) // surface the banner; let the user choose
    } else {
      void get().reloadActive() // not editing — reload live
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
