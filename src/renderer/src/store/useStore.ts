import { create } from 'zustand'
import type { MdNode } from '../types'
import type { Appearance } from '../themes'

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
  root: string | null
  tree: MdNode[]
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
  filter: string

  setFolder: (root: string, tree: MdNode[]) => void
  setTree: (tree: MdNode[]) => void
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

export const useStore = create<OrchidState>((set, get) => ({
  root: null,
  tree: [],
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
  filter: '',

  setFolder: (root, tree) => set({ root, tree }),
  setTree: (tree) => set({ tree }),

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
