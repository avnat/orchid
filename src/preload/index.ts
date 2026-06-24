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
  open: (): Promise<void> => ipcRenderer.invoke('dialog:open'),
  addFolder: (): Promise<void> => ipcRenderer.invoke('dialog:addFolder'),
  openPath: (path: string): Promise<void> => ipcRenderer.invoke('workspace:openPath', path),
  closeFolder: (root: string): Promise<void> => ipcRenderer.invoke('workspace:closeFolder', root),
  refresh: (): Promise<void> => ipcRenderer.invoke('workspace:refresh'),
  createFile: (dir: string, name: string): Promise<string> => ipcRenderer.invoke('fs:createFile', dir, name),
  createFolder: (parentDir: string, name: string): Promise<string> =>
    ipcRenderer.invoke('fs:createFolder', parentDir, name),
  trash: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:trash', path),
  trashMany: (paths: string[]): Promise<boolean> => ipcRenderer.invoke('fs:trashMany', paths),
  rename: (path: string, newName: string): Promise<string> => ipcRenderer.invoke('fs:rename', path, newName),
  duplicate: (path: string): Promise<string> => ipcRenderer.invoke('fs:duplicate', path),
  move: (src: string, destDir: string): Promise<string> => ipcRenderer.invoke('fs:move', src, destDir),
  fileMenu: (path: string, opts?: { pinned?: boolean; isFolder?: boolean }): Promise<void> =>
    ipcRenderer.invoke('fs:fileMenu', path, opts),
  rescan: (changedPath: string): Promise<void> => ipcRenderer.invoke('workspace:rescan', changedPath),
  readFile: (path: string): Promise<string> => ipcRenderer.invoke('fs:read', path),
  writeFile: (path: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:write', path, content),
  reveal: (path: string): Promise<void> => ipcRenderer.invoke('fs:reveal', path),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url),
  checkUpdates: (): Promise<void> => ipcRenderer.invoke('update:check'),
  getTheme: (): Promise<{ shouldUseDarkColors: boolean }> => ipcRenderer.invoke('theme:get'),
  search: (
    query: string
  ): Promise<
    { path: string; relPath: string; name: string; matches: { lineNumber: number; text: string }[] }[]
  > => ipcRenderer.invoke('fs:search', query),
  exportHtml: (html: string, defaultName: string): Promise<boolean> =>
    ipcRenderer.invoke('export:html', html, defaultName),
  exportPdf: (
    html: string,
    defaultName: string,
    opts?: { header: string; footer: string; pageNumbers: boolean }
  ): Promise<boolean> => ipcRenderer.invoke('export:pdf', html, defaultName, opts),
  findInPage: (query: string, opts: { forward?: boolean; findNext?: boolean }): Promise<void> =>
    ipcRenderer.invoke('find:start', query, opts),
  stopFind: (): Promise<void> => ipcRenderer.invoke('find:stop'),
  setDirty: (dirty: boolean): void => ipcRenderer.send('win:dirty', dirty),
  confirmClose: (): void => ipcRenderer.send('win:ready-to-close'),

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
  onNewFile: (cb: () => void) => on('cmd:new-file', cb),
  onNewFolder: (cb: () => void) => on('cmd:new-folder', cb),
  onExportHtml: (cb: () => void) => on('cmd:export-html', cb),
  onExportPdf: (cb: () => void) => on('cmd:export-pdf', cb),
  onShortcuts: (cb: () => void) => on('cmd:shortcuts', cb),
  onDeveloper: (cb: () => void) => on('cmd:developer', cb),
  onSelectFile: (cb: (path: string) => void) => on('file:select', cb),
  onBeginRename: (cb: (path: string) => void) => on('menu:rename', cb),
  onTogglePin: (cb: (path: string) => void) => on('menu:pin-toggle', cb),
  onFindResult: (cb: (p: { active: number; total: number }) => void) => on('find:result', cb),
  onSaveAndClose: (cb: () => void) => on('app:save-and-close', cb),
  onUpdateAvailable: (
    cb: (info: { version: string; notes: string; url: string; download: string; manual: boolean }) => void
  ) => on('update:available', cb)
}

export type OrchidApi = typeof api

contextBridge.exposeInMainWorld('orchid', api)
