import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

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

function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  // actions
  openFolder: (): Promise<void> => ipcRenderer.invoke('dialog:openFolder'),
  addFolder: (): Promise<void> => ipcRenderer.invoke('dialog:addFolder'),
  openFile: (): Promise<void> => ipcRenderer.invoke('dialog:openFile'),
  openPath: (path: string): Promise<void> => ipcRenderer.invoke('workspace:openPath', path),
  closeFolder: (root: string): Promise<void> => ipcRenderer.invoke('workspace:closeFolder', root),
  refresh: (): Promise<void> => ipcRenderer.invoke('workspace:refresh'),
  rescan: (changedPath: string): Promise<void> => ipcRenderer.invoke('workspace:rescan', changedPath),
  readFile: (path: string): Promise<string> => ipcRenderer.invoke('fs:read', path),
  writeFile: (path: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:write', path, content),
  reveal: (path: string): Promise<void> => ipcRenderer.invoke('fs:reveal', path),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  getTheme: (): Promise<{ shouldUseDarkColors: boolean }> => ipcRenderer.invoke('theme:get'),
  search: (
    query: string
  ): Promise<
    { path: string; relPath: string; name: string; matches: { lineNumber: number; text: string }[] }[]
  > => ipcRenderer.invoke('fs:search', query),
  exportHtml: (html: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('export:html', html, defaultName),
  exportPdf: (html: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('export:pdf', html, defaultName),

  // events (return an unsubscribe fn)
  onWorkspaceChanged: (cb: (p: { folders: WorkspaceFolder[]; select?: string }) => void) =>
    on('workspace:changed', cb),
  onFileChanged: (cb: (p: { path: string }) => void) => on('fs:changed', cb),
  onTreeChanged: (cb: (p: { path?: string }) => void) => on('fs:tree-changed', cb),
  onThemeChanged: (cb: (p: { shouldUseDarkColors: boolean }) => void) => on('theme:changed', cb),
  onToggleEdit: (cb: () => void) => on('cmd:toggle-edit', cb),
  onSave: (cb: () => void) => on('cmd:save', cb),
  onFocusMode: (cb: () => void) => on('cmd:focus-mode', cb),
  onToggleToc: (cb: () => void) => on('cmd:toggle-toc', cb),
  onSearch: (cb: () => void) => on('cmd:search', cb),
  onExportHtml: (cb: () => void) => on('cmd:export-html', cb),
  onExportPdf: (cb: () => void) => on('cmd:export-pdf', cb),
  onShortcuts: (cb: () => void) => on('cmd:shortcuts', cb)
}

export type OrchidApi = typeof api

contextBridge.exposeInMainWorld('orchid', api)
