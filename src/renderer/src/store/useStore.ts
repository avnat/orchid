import { create } from 'zustand'
import type { WorkspaceFolder } from '../types'
import type { Appearance } from '../themes'

export type SortMode = 'name' | 'recent'

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
  tocVisible: boolean
  sortMode: SortMode
  filter: string

  setWorkspace: (folders: WorkspaceFolder[], select?: string) => void
  setSortMode: (mode: SortMode) => void
  selectFile: (path: string) => Promise<void>
  reloadActive: () => Promise<void>
  setContent: (content: string) => void
  save: () => Promise<void>
  toggleEdit: () => void
  toggleFocus: () => void
  toggleToc: () => void
  setSystemDark: (dark: boolean) => void
  setAppearance: (a: Appearance) => void
  setAccent: (key: string) => void
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
  tocVisible: lsGet('orchid.toc', 'true') !== 'false',
  sortMode: lsGet('orchid.sort', 'name') as SortMode,
  filter: '',

  setWorkspace: (folders, select) =>
    set((s) => ({
      folders,
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

  selectFile: async (path) => {
    const text = await window.orchid.readFile(path)
    set({ activePath: path, content: text, savedContent: text, conflict: false })
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
