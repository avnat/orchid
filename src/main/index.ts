import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, protocol, net, screen } from 'electron'
import { join, resolve, relative, sep, basename } from 'path'
import { promises as fs } from 'fs'
import { pathToFileURL } from 'url'
import { scanFolder, type MdNode } from './fs-scan'
import { watchFolder, stopWatching } from './watcher'

let mainWindow: BrowserWindow | null = null
let currentRoot: string | null = null
let currentFiles: string[] = []

function flattenFiles(nodes: MdNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === 'file') out.push(n.path)
    else if (n.children) flattenFiles(n.children, out)
  }
  return out
}

const isDev = !!process.env['ELECTRON_RENDERER_URL']

// Privileged scheme so the renderer can load local images safely (scoped to the open folder).
protocol.registerSchemesAsPrivileged([
  { scheme: 'orchid-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

function withinRoot(target: string): boolean {
  if (!currentRoot) return false
  const root = resolve(currentRoot)
  const r = resolve(target)
  return r === root || r.startsWith(root + sep)
}

function createWindow(): void {
  // Fit the window to the actual screen so it never opens larger than the
  // display (which would push the title bar / edges out of reach).
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
    // Safety: if the window is somehow bigger than the screen or off-screen,
    // refit and re-center so its title bar and edges are always reachable.
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
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function openFolderDialog(): Promise<void> {
  if (!mainWindow) return
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    message: 'Choose a folder of markdown to read'
  })
  if (result.canceled || result.filePaths.length === 0) return
  await loadFolder(result.filePaths[0])
}

async function loadFolder(folderPath: string): Promise<void> {
  if (!mainWindow) return
  currentRoot = folderPath
  const tree = await scanFolder(folderPath)
  currentFiles = flattenFiles(tree)
  mainWindow.webContents.send('folder:opened', { root: folderPath, tree })
  watchFolder(folderPath, mainWindow)
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
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFolderDialog()
        },
        { type: 'separator' },
        {
          label: 'Toggle Edit Mode',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('cmd:toggle-edit')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('cmd:save')
        },
        { type: 'separator' },
        {
          label: 'Find in Files…',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => mainWindow?.webContents.send('cmd:search')
        },
        { type: 'separator' },
        {
          label: 'Export as HTML…',
          click: () => mainWindow?.webContents.send('cmd:export-html')
        },
        {
          label: 'Export as PDF…',
          click: () => mainWindow?.webContents.send('cmd:export-pdf')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+.',
          click: () => mainWindow?.webContents.send('cmd:focus-mode')
        },
        {
          label: 'Toggle Table of Contents',
          accelerator: 'CmdOrCtrl+Alt+.',
          click: () => mainWindow?.webContents.send('cmd:toggle-toc')
        },
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
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => mainWindow?.webContents.send('cmd:shortcuts')
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // Serve local images scoped to the open folder: orchid-asset://local/<encoded-abs-path>
  protocol.handle('orchid-asset', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (!withinRoot(filePath)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  })

  const themeOverride = process.env['ORCHID_THEME']
  if (themeOverride === 'dark' || themeOverride === 'light') {
    nativeTheme.themeSource = themeOverride
  }

  // Show the Orchid icon in the dock during development too.
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(join(app.getAppPath(), 'resources', 'icon.png'))
    } catch {
      /* ignore */
    }
  }

  buildMenu()
  createWindow()

  // Dev convenience: auto-open a folder when ORCHID_OPEN is set.
  const autoOpen = process.env['ORCHID_OPEN']
  const shotPath = process.env['ORCHID_SHOT']
  if (autoOpen) {
    mainWindow?.webContents.once('did-finish-load', async () => {
      await loadFolder(autoOpen)
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
    // Screenshot the launch page (no folder opened).
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
    mainWindow?.webContents.send('theme:changed', {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    })
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

ipcMain.handle('dialog:openFolder', async () => {
  await openFolderDialog()
})

ipcMain.handle('folder:openPath', async (_e, folderPath: string) => {
  const stat = await fs.stat(folderPath).catch(() => null)
  if (stat?.isDirectory()) await loadFolder(folderPath)
})

ipcMain.handle('fs:scan', async (_e, root: string) => {
  return scanFolder(root)
})

ipcMain.handle('fs:read', async (_e, filePath: string) => {
  if (!withinRoot(filePath)) throw new Error('Path outside the open folder')
  return fs.readFile(filePath, 'utf8')
})

ipcMain.handle('fs:write', async (_e, filePath: string, content: string) => {
  if (!withinRoot(filePath)) throw new Error('Path outside the open folder')
  await fs.writeFile(filePath, content, 'utf8')
  return true
})

ipcMain.handle('fs:reveal', async (_e, filePath: string) => {
  if (!withinRoot(filePath)) return
  shell.showItemInFolder(filePath)
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('theme:get', async () => ({
  shouldUseDarkColors: nativeTheme.shouldUseDarkColors
}))

// ---- Content search across the open folder ----
ipcMain.handle('fs:search', async (_e, query: string) => {
  if (!query || !currentRoot) return []
  const q = query.toLowerCase()
  const results: {
    path: string
    relPath: string
    name: string
    matches: { lineNumber: number; text: string }[]
  }[] = []
  for (const file of currentFiles) {
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
    results.push({ path: file, relPath: relative(currentRoot, file), name: basename(file), matches })
    if (results.length >= 100) break
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
    await new Promise((r) => setTimeout(r, 300)) // let fonts/SVG settle
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
