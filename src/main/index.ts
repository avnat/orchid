import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, protocol, net, screen } from 'electron'
import { join, resolve, relative, sep, basename, dirname } from 'path'
import { promises as fs } from 'fs'
import { pathToFileURL } from 'url'
import { scanFolder, type MdNode } from './fs-scan'
import { watchPaths, stopWatching } from './watcher'

const MD_RE = /\.(md|markdown|mdx)$/i

interface WSFolder {
  root: string
  name: string
  tree: MdNode[]
  isFile?: boolean
}

let mainWindow: BrowserWindow | null = null
let workspace: WSFolder[] = []
let currentFiles: string[] = []

function flattenFiles(nodes: MdNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === 'file') out.push(n.path)
    else if (n.children) flattenFiles(n.children, out)
  }
  return out
}

const isDev = !!process.env['ELECTRON_RENDERER_URL']

protocol.registerSchemesAsPrivileged([
  { scheme: 'orchid-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

/** True if `target` lives inside any open workspace folder. */
function withinWorkspace(target: string): boolean {
  const r = resolve(target)
  return workspace.some((f) => {
    const root = resolve(f.root)
    return r === root || r.startsWith(root + sep)
  })
}

// ---- Workspace ----
function emitWorkspace(select?: string): void {
  currentFiles = workspace.flatMap((f) => flattenFiles(f.tree))
  mainWindow?.webContents.send('workspace:changed', { folders: workspace, select })
  rewatch()
}

function rewatch(): void {
  const paths = workspace.map((f) => (f.isFile && f.tree[0] ? f.tree[0].path : f.root))
  watchPaths(paths, mainWindow)
}

async function openFolder(folderPath: string, add = false): Promise<void> {
  const tree = await scanFolder(folderPath)
  const entry: WSFolder = { root: folderPath, name: basename(folderPath) || folderPath, tree }
  if (add) {
    const i = workspace.findIndex((f) => f.root === folderPath)
    if (i >= 0) workspace[i] = entry
    else workspace.push(entry)
  } else {
    workspace = [entry]
  }
  emitWorkspace()
}

async function openFile(filePath: string): Promise<void> {
  const dir = dirname(filePath)
  let mtimeMs = 0
  try {
    mtimeMs = (await fs.stat(filePath)).mtimeMs
  } catch {
    /* ignore */
  }
  const node: MdNode = {
    name: basename(filePath),
    path: filePath,
    relPath: basename(filePath),
    type: 'file',
    mtimeMs
  }
  workspace = [{ root: dir, name: basename(filePath), tree: [node], isFile: true }]
  emitWorkspace(filePath)
}

function closeFolder(root: string): void {
  workspace = workspace.filter((f) => f.root !== root)
  emitWorkspace()
}

async function rescanFolder(changedPath: string): Promise<void> {
  const f = workspace.find((w) => !w.isFile && (changedPath === w.root || changedPath.startsWith(w.root + sep)))
  if (!f) return
  f.tree = await scanFolder(f.root)
  emitWorkspace()
}

async function refreshAll(): Promise<void> {
  for (const f of workspace) {
    if (!f.isFile) f.tree = await scanFolder(f.root)
  }
  emitWorkspace()
}

async function openFolderDialog(add: boolean): Promise<void> {
  if (!mainWindow) return
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    message: add ? 'Add a folder to the workspace' : 'Choose a folder of markdown to read'
  })
  if (result.canceled || result.filePaths.length === 0) return
  await openFolder(result.filePaths[0], add)
}

async function openFileDialog(): Promise<void> {
  if (!mainWindow) return
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] }],
    message: 'Choose a markdown file to read'
  })
  if (result.canceled || result.filePaths.length === 0) return
  await openFile(result.filePaths[0])
}

function createWindow(): void {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(1180, screenW - 60)
  const height = Math.min(800, screenH - 60)

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 560,
    minHeight: 420,
    center: true,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141318' : '#FBFAFD',
    vibrancy: 'sidebar',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    // Safety: refit/recenter if the window is bigger than the screen or off-screen.
    if (mainWindow) {
      const wa = screen.getPrimaryDisplay().workArea
      const b = mainWindow.getBounds()
      const w = Math.min(b.width, wa.width - 60)
      const h = Math.min(b.height, wa.height - 60)
      const offscreen =
        b.x < wa.x || b.y < wa.y || b.x + b.width > wa.x + wa.width || b.y + b.height > wa.y + wa.height
      if (w !== b.width || h !== b.height || offscreen) {
        mainWindow.setBounds({
          width: w,
          height: h,
          x: wa.x + Math.round((wa.width - w) / 2),
          y: wa.y + Math.round((wa.height - h) / 2)
        })
      }
    }
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 2) console.log(`[renderer ${level >= 3 ? 'ERROR' : 'WARN'}] ${message} (${sourceId}:${line})`)
    })
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => openFolderDialog(false) },
        { label: 'Add Folder to Workspace…', accelerator: 'CmdOrCtrl+Shift+O', click: () => openFolderDialog(true) },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+Ctrl+O', click: () => openFileDialog() },
        { type: 'separator' },
        { label: 'Refresh', accelerator: 'CmdOrCtrl+R', click: () => void refreshAll() },
        { type: 'separator' },
        { label: 'Toggle Edit Mode', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('cmd:toggle-edit') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('cmd:save') },
        { type: 'separator' },
        { label: 'Find in Files…', accelerator: 'CmdOrCtrl+Shift+F', click: () => mainWindow?.webContents.send('cmd:search') },
        { type: 'separator' },
        { label: 'Export as HTML…', click: () => mainWindow?.webContents.send('cmd:export-html') },
        { label: 'Export as PDF…', click: () => mainWindow?.webContents.send('cmd:export-pdf') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+.', click: () => mainWindow?.webContents.send('cmd:focus-mode') },
        { label: 'Toggle Table of Contents', accelerator: 'CmdOrCtrl+Alt+.', click: () => mainWindow?.webContents.send('cmd:toggle-toc') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' } as Electron.MenuItemConstructorOptions] : [])
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => mainWindow?.webContents.send('cmd:shortcuts') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  protocol.handle('orchid-asset', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (!withinWorkspace(filePath)) return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(filePath).toString())
  })

  const themeOverride = process.env['ORCHID_THEME']
  if (themeOverride === 'dark' || themeOverride === 'light') {
    nativeTheme.themeSource = themeOverride
  }

  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(join(app.getAppPath(), 'resources', 'icon.png'))
    } catch {
      /* ignore */
    }
  }

  buildMenu()
  createWindow()

  // Dev convenience: auto-open a folder OR file when ORCHID_OPEN is set.
  const autoOpen = process.env['ORCHID_OPEN']
  const shotPath = process.env['ORCHID_SHOT']
  if (autoOpen) {
    mainWindow?.webContents.once('did-finish-load', async () => {
      const st = await fs.stat(autoOpen).catch(() => null)
      if (st?.isFile()) await openFile(autoOpen)
      else await openFolder(autoOpen, false)
      if (!mainWindow) return
      const sel = process.env['ORCHID_SELECT']
      if (sel) {
        await mainWindow.webContents.executeJavaScript(
          `window.__store && window.__store.getState().selectFile(${JSON.stringify(sel)})`
        )
      }

      const exportTest = process.env['ORCHID_EXPORT_TEST']
      if (exportTest) {
        await new Promise((r) => setTimeout(r, 1200))
        const html: string | null = await mainWindow.webContents.executeJavaScript(
          'window.__buildExport ? window.__buildExport("Export Test") : null'
        )
        if (html) {
          await fs.writeFile(exportTest, html, 'utf8')
          const tmp = join(app.getPath('temp'), 'orchid-export-test.html')
          await fs.writeFile(tmp, html, 'utf8')
          const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
          await w.loadFile(tmp)
          await new Promise((r) => setTimeout(r, 300))
          const pdf = await w.webContents.printToPDF({ printBackground: true })
          await fs.writeFile(exportTest.replace(/\.html$/, '.pdf'), pdf)
          w.destroy()
          console.log('EXPORT_TEST html bytes', html.length)
        }
      }

      if (shotPath) {
        const evalJs = process.env['ORCHID_EVAL']
        if (evalJs) {
          await new Promise((r) => setTimeout(r, 400))
          await mainWindow.webContents.executeJavaScript(evalJs).catch(() => {})
        }
        setTimeout(async () => {
          const img = await mainWindow!.webContents.capturePage()
          await fs.writeFile(shotPath, img.toPNG())
          console.log('ORCHID_SHOT written to', shotPath)
        }, 1400)
      }
    })
  } else if (shotPath) {
    mainWindow?.webContents.once('did-finish-load', async () => {
      const evalJs = process.env['ORCHID_EVAL']
      if (evalJs && mainWindow) {
        await new Promise((r) => setTimeout(r, 500))
        await mainWindow.webContents.executeJavaScript(evalJs).catch(() => {})
      }
      setTimeout(async () => {
        const img = await mainWindow!.webContents.capturePage()
        await fs.writeFile(shotPath, img.toPNG())
        console.log('ORCHID_SHOT written to', shotPath)
      }, 1200)
    })
  }

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('theme:changed', { shouldUseDarkColors: nativeTheme.shouldUseDarkColors })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopWatching()
  if (process.platform !== 'darwin') app.quit()
})

// ---- IPC ----
ipcMain.handle('dialog:openFolder', async () => openFolderDialog(false))
ipcMain.handle('dialog:addFolder', async () => openFolderDialog(true))
ipcMain.handle('dialog:openFile', async () => openFileDialog())

ipcMain.handle('workspace:openPath', async (_e, p: string) => {
  const stat = await fs.stat(p).catch(() => null)
  if (stat?.isDirectory()) await openFolder(p, workspace.length > 0)
  else if (stat?.isFile() && MD_RE.test(p)) await openFile(p)
})

ipcMain.handle('workspace:closeFolder', async (_e, root: string) => closeFolder(root))
ipcMain.handle('workspace:refresh', async () => refreshAll())
ipcMain.handle('workspace:rescan', async (_e, changedPath: string) => rescanFolder(changedPath))

ipcMain.handle('fs:read', async (_e, filePath: string) => {
  if (!withinWorkspace(filePath)) throw new Error('Path outside the workspace')
  return fs.readFile(filePath, 'utf8')
})

ipcMain.handle('fs:write', async (_e, filePath: string, content: string) => {
  if (!withinWorkspace(filePath)) throw new Error('Path outside the workspace')
  await fs.writeFile(filePath, content, 'utf8')
  return true
})

ipcMain.handle('fs:reveal', async (_e, filePath: string) => {
  if (!withinWorkspace(filePath)) return
  shell.showItemInFolder(filePath)
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('theme:get', async () => ({ shouldUseDarkColors: nativeTheme.shouldUseDarkColors }))

// ---- Content search across all open folders ----
ipcMain.handle('fs:search', async (_e, query: string) => {
  if (!query || workspace.length === 0) return []
  const q = query.toLowerCase()
  const multi = workspace.length > 1
  const results: {
    path: string
    relPath: string
    name: string
    matches: { lineNumber: number; text: string }[]
  }[] = []
  for (const folder of workspace) {
    for (const file of flattenFiles(folder.tree)) {
      let text: string
      try {
        text = await fs.readFile(file, 'utf8')
      } catch {
        continue
      }
      if (!text.toLowerCase().includes(q)) continue
      const lines = text.split(/\r?\n/)
      const matches: { lineNumber: number; text: string }[] = []
      for (let i = 0; i < lines.length && matches.length < 5; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          matches.push({ lineNumber: i + 1, text: lines[i].trim().slice(0, 200) })
        }
      }
      // label hits with their folder when more than one is open
      const rel = folder.isFile ? basename(file) : relative(folder.root, file)
      const relPath = multi ? `${folder.name}/${rel}` : rel
      results.push({ path: file, relPath, name: basename(file), matches })
      if (results.length >= 100) return results
    }
  }
  return results
})

// ---- Export ----
async function chooseSavePath(defaultName: string, ext: string): Promise<string | null> {
  if (!mainWindow) return null
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  return res.canceled || !res.filePath ? null : res.filePath
}

ipcMain.handle('export:html', async (_e, html: string, defaultName: string) => {
  const out = await chooseSavePath(defaultName, 'html')
  if (!out) return false
  await fs.writeFile(out, html, 'utf8')
  shell.showItemInFolder(out)
  return true
})

ipcMain.handle('export:pdf', async (_e, html: string, defaultName: string) => {
  const out = await chooseSavePath(defaultName, 'pdf')
  if (!out) return false
  const tmp = join(app.getPath('temp'), `orchid-export-${Date.now()}.html`)
  await fs.writeFile(tmp, html, 'utf8')
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await win.loadFile(tmp)
    await new Promise((r) => setTimeout(r, 300))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 }
    })
    await fs.writeFile(out, pdf)
    shell.showItemInFolder(out)
  } finally {
    win.destroy()
    fs.unlink(tmp).catch(() => {})
  }
  return true
})
