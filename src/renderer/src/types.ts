export interface MdNode {
  name: string
  path: string
  relPath: string
  type: 'dir' | 'file'
  mtimeMs?: number
  children?: MdNode[]
}

export interface WorkspaceFolder {
  root: string
  name: string
  tree: MdNode[]
  isFile?: boolean
}

export interface OrchidApi {
  open: () => Promise<void>
  addFolder: () => Promise<void>
  openPath: (path: string) => Promise<void>
  closeFolder: (root: string) => Promise<void>
  refresh: () => Promise<void>
  rescan: (changedPath: string) => Promise<void>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  reveal: (path: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  getTheme: () => Promise<{ shouldUseDarkColors: boolean }>
  search: (query: string) => Promise<SearchHit[]>
  exportHtml: (html: string, defaultName: string) => Promise<boolean>
  exportPdf: (html: string, defaultName: string) => Promise<boolean>
  findInPage: (query: string, opts: { forward?: boolean; findNext?: boolean }) => Promise<void>
  stopFind: () => Promise<void>
  setDirty: (dirty: boolean) => void
  confirmClose: () => void
  onWorkspaceChanged: (cb: (p: { folders: WorkspaceFolder[]; select?: string }) => void) => () => void
  onFileChanged: (cb: (p: { path: string }) => void) => () => void
  onTreeChanged: (cb: (p: { path?: string }) => void) => () => void
  onThemeChanged: (cb: (p: { shouldUseDarkColors: boolean }) => void) => () => void
  onToggleEdit: (cb: () => void) => () => void
  onSave: (cb: () => void) => () => void
  onFocusMode: (cb: () => void) => () => void
  onToggleToc: (cb: () => void) => () => void
  onSearch: (cb: () => void) => () => void
  onExportHtml: (cb: () => void) => () => void
  onExportPdf: (cb: () => void) => () => void
  onShortcuts: (cb: () => void) => () => void
  onFindResult: (cb: (p: { active: number; total: number }) => void) => () => void
  onSaveAndClose: (cb: () => void) => () => void
}

export interface SearchHit {
  path: string
  relPath: string
  name: string
  matches: { lineNumber: number; text: string }[]
}
