export interface MdNode {
  name: string
  path: string
  relPath: string
  type: 'dir' | 'file'
  mtimeMs?: number
  children?: MdNode[]
}

export interface OrchidApi {
  openFolder: () => Promise<void>
  openFolderPath: (path: string) => Promise<void>
  scan: (root: string) => Promise<MdNode[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  reveal: (path: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  getTheme: () => Promise<{ shouldUseDarkColors: boolean }>
  search: (query: string) => Promise<SearchHit[]>
  exportHtml: (html: string, defaultName: string) => Promise<boolean>
  exportPdf: (html: string, defaultName: string) => Promise<boolean>
  onFolderOpened: (cb: (p: { root: string; tree: MdNode[] }) => void) => () => void
  onFileChanged: (cb: (p: { path: string }) => void) => () => void
  onTreeChanged: (cb: (p: { type: string; path?: string }) => void) => () => void
  onThemeChanged: (cb: (p: { shouldUseDarkColors: boolean }) => void) => () => void
  onToggleEdit: (cb: () => void) => () => void
  onSave: (cb: () => void) => () => void
  onFocusMode: (cb: () => void) => () => void
  onToggleToc: (cb: () => void) => () => void
  onSearch: (cb: () => void) => () => void
  onExportHtml: (cb: () => void) => () => void
  onExportPdf: (cb: () => void) => () => void
  onShortcuts: (cb: () => void) => () => void
}

export interface SearchHit {
  path: string
  relPath: string
  name: string
  matches: { lineNumber: number; text: string }[]
}
