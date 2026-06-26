import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, protocol, net, screen, clipboard, crashReporter } from 'electron'
import { join, resolve, relative, sep, basename, dirname } from 'path'
import { promises as fs, existsSync, writeFileSync, unlinkSync } from 'fs'
import { reportCrash } from './crash-report'
import { pathToFileURL } from 'url'
import { scanFolder, TEXT_EXTENSIONS, type MdNode } from './fs-scan'
import { watchPaths, stopWatching } from './watcher'
import { cmpVersions } from './version'
import { SHORTCUT_DEFS, mergeShortcuts, sanitizeOverrides, isValidAccelerator } from './shortcuts'

const TEXT_RE = new RegExp('\\.(' + TEXT_EXTENSIONS.map((e) => e.slice(1)).join('|') + ')$', 'i')

interface WSFolder {
  root: string
  name: string
  tree: MdNode[]
  isFile?: boolean
}

let mainWindow: BrowserWindow | null = null
let lastRendererReload = 0
let workspace: WSFolder[] = []
let currentFiles: string[] = []
let unsavedChanges = false
let forceClose = false

/** The window is present and not torn down — safe to message or parent a dialog. */
function windowAlive(): boolean {
  return !!mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()
}

/**
 * Send an IPC message to the renderer only if the window is alive. Background and
 * async callers (file watcher, theme changes, update checks, menu actions with no
 * window) can fire after the window is gone — this prevents "Object has been
 * destroyed" crashes in the main process.
 */
function sendToUi(channel: string, payload?: unknown): void {
  if (windowAlive()) mainWindow!.webContents.send(channel, payload)
}

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
  sendToUi('workspace:changed', { folders: workspace, select })
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

/**
 * Re-scan the workspace that contains `target` so a just-created file/folder
 * shows immediately — independent of the file watcher. If `target` lives in a
 * single-file workspace, promote it to a full folder view so siblings appear.
 */
async function revealCreated(target: string): Promise<void> {
  const t = resolve(target)
  const f = workspace.find((w) => {
    const r = resolve(w.root)
    return t === r || t.startsWith(r + sep)
  })
  if (!f) return
  if (f.isFile) {
    f.isFile = false
    f.name = basename(f.root)
  }
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

/** One dialog that accepts a folder OR a single file (macOS allows both). */
async function openDialog(): Promise<void> {
  if (!mainWindow) return
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'openDirectory'],
    // "All files" is the default so nothing is wrongly greyed out — macOS can
    // resolve some .md files to a non-markdown UTI, which an extension filter
    // would block. "Markdown & text" stays available as a narrowing option.
    filters: [
      { name: 'All files', extensions: ['*'] },
      { name: 'Markdown & text', extensions: TEXT_EXTENSIONS.map((e) => e.slice(1)) }
    ],
    message: 'Open a folder or a file'
  })
  if (result.canceled || result.filePaths.length === 0) return
  const p = result.filePaths[0]
  const stat = await fs.stat(p).catch(() => null)
  if (stat?.isDirectory()) await openFolder(p, false)
  else if (stat?.isFile()) await openFile(p) // read-time guardrail handles binary/unsupported
}

/**
 * New File. With a workspace open, the renderer's in-place create dialog handles
 * it. With nothing open, ask where to save (Save As), create it, and open it.
 */
async function newFileFlow(): Promise<void> {
  if (workspace.length > 0) {
    sendToUi('cmd:new-file')
    return
  }
  if (!mainWindow) return
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'New File',
    message: 'Choose where to create the file',
    buttonLabel: 'Create',
    nameFieldLabel: 'Name:',
    defaultPath: join(app.getPath('documents'), 'untitled.md')
  })
  if (canceled || !filePath) return
  if (!(await fs.stat(filePath).then(() => true).catch(() => false))) {
    await fs.writeFile(filePath, '', 'utf8').catch(() => {})
  }
  await openFile(filePath) // selects it via emitWorkspace
  sendToUi('cmd:new-file-created') // renderer opens it in edit mode
}

/** New Folder with nothing open: pick a location, create it, open it as the workspace. */
async function newFolderFlow(): Promise<void> {
  if (workspace.length > 0) {
    sendToUi('cmd:new-folder')
    return
  }
  if (!mainWindow) return
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'New Folder',
    message: 'Choose where to create the folder',
    buttonLabel: 'Create',
    nameFieldLabel: 'Name:',
    defaultPath: join(app.getPath('documents'), 'New Folder')
  })
  if (canceled || !filePath) return
  await fs.mkdir(filePath, { recursive: true }).catch(() => {})
  await openFolder(filePath, false)
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

  // Right-click menu for editable fields / selected text (Electron has none by
  // default). Items are contextual: paste only in editable fields, copy/cut only
  // with a selection.
  mainWindow.webContents.on('context-menu', (_e, params) => {
    const { editFlags, isEditable, selectionText } = params
    const hasSelection = selectionText.trim().length > 0
    const items: Electron.MenuItemConstructorOptions[] = []
    if (isEditable) {
      items.push(
        { role: 'cut', enabled: editFlags.canCut },
        { role: 'copy', enabled: editFlags.canCopy },
        { role: 'paste', enabled: editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll' }
      )
    } else if (hasSelection) {
      items.push({ role: 'copy' }, { type: 'separator' }, { role: 'selectAll' })
    }
    if (items.length === 0) return
    Menu.buildFromTemplate(items).popup({ window: mainWindow ?? undefined })
  })

  // Guard against losing unsaved edits when the window/app closes.
  mainWindow.on('close', (e) => {
    if (!unsavedChanges || forceClose || !mainWindow) return
    e.preventDefault()
    dialog
      .showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        message: 'Save changes before closing?',
        detail: "Your edits to this file will be lost if you don't save them."
      })
      .then(({ response }) => {
        if (response === 0) sendToUi('app:save-and-close')
        else if (response === 1) {
          forceClose = true
          mainWindow?.close()
        }
        // response === 2 (Cancel): stay open
      })
  })

  // Clear the reference once the window is gone, so background listeners
  // (e.g. nativeTheme) don't touch a destroyed window.
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // The renderer crashed (gone / OOM / GPU) — report it, then auto-recover by
  // reloading the window so the user sees a brief flash instead of a dead window.
  // A 5s guard prevents a reload storm if it crashes again immediately on load.
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return
    reportCrash('render-process-gone', `${details.reason} (exitCode ${details.exitCode})`, crashMeta())
    const now = Date.now()
    if (windowAlive() && now - lastRendererReload > 5000) {
      lastRendererReload = now
      mainWindow!.webContents.reload()
    }
  })

  // In-file find (⌘F) — relay native find results to the renderer's find bar.
  mainWindow.webContents.on('found-in-page', (_e, result) => {
    sendToUi('find:result', {
      active: result.activeMatchOrdinal,
      total: result.matches
    })
  })

  if (isDev) {
    mainWindow.webContents.on('console-message', (e) => {
      if (e.level === 'warning' || e.level === 'error')
        console.log(`[renderer ${e.level.toUpperCase()}] ${e.message} (${e.sourceId}:${e.lineNumber})`)
    })
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---- Update check (GitHub Releases) ----
const UPDATE_REPO = 'avnat/orchid'

interface ReleaseInfo {
  version: string
  notes: string
  url: string
  download: string
}

function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  return new Promise((resolve) => {
    const req = net.request(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`)
    req.setHeader('User-Agent', 'Orchid-Updater')
    req.setHeader('Accept', 'application/vnd.github+json')
    let data = ''
    req.on('response', (res) => {
      res.on('data', (c) => (data += c.toString()))
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          if (!j.tag_name) return resolve(null)
          const dmg = (j.assets || []).find((a: { name: string }) => a.name.endsWith('.dmg'))
          resolve({
            version: j.tag_name,
            notes: typeof j.body === 'string' ? j.body : '',
            url: j.html_url,
            download: dmg?.browser_download_url || j.html_url
          })
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.end()
  })
}

/** Check GitHub for a newer release. `manual` shows an "up to date" / error dialog too. */
async function checkForUpdates(manual: boolean): Promise<void> {
  const rel = await fetchLatestRelease()
  if (!rel) {
    if (manual && windowAlive()) {
      await dialog.showMessageBox(mainWindow!, {
        type: 'warning',
        buttons: ['OK'],
        message: "Couldn't check for updates",
        detail: 'Please check your connection and try again.'
      })
    }
    return
  }
  if (cmpVersions(rel.version, app.getVersion()) > 0) {
    sendToUi('update:available', { ...rel, manual })
  } else if (manual && windowAlive()) {
    await dialog.showMessageBox(mainWindow!, {
      type: 'info',
      buttons: ['OK'],
      message: "You're up to date",
      detail: `Orchid ${app.getVersion()} is the latest version.`
    })
  }
}

// ---- Customisable keyboard shortcuts ----
let shortcutOverrides: Record<string, string> = {}

function shortcutsFile(): string {
  return join(app.getPath('userData'), 'shortcuts.json')
}

async function loadShortcutOverrides(): Promise<void> {
  try {
    shortcutOverrides = sanitizeOverrides(JSON.parse(await fs.readFile(shortcutsFile(), 'utf8')))
  } catch {
    shortcutOverrides = {}
  }
}

async function saveShortcutOverrides(): Promise<void> {
  try {
    await fs.writeFile(shortcutsFile(), JSON.stringify(shortcutOverrides, null, 2), 'utf8')
  } catch {
    /* best-effort */
  }
}

/** Resolved accelerator for a command id (override if valid, else default). */
function accel(id: string): string {
  return mergeShortcuts(shortcutOverrides)[id]
}

function resolvedShortcuts(): { defs: typeof SHORTCUT_DEFS; map: Record<string, string> } {
  return { defs: SHORTCUT_DEFS, map: mergeShortcuts(shortcutOverrides) }
}

/** Rebuild the application menu; on any failure (e.g. a bad accelerator) reset to defaults. */
function safeBuildMenu(): void {
  try {
    buildMenu()
  } catch {
    shortcutOverrides = {}
    void saveShortcutOverrides()
    buildMenu()
  }
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates…', click: () => void checkForUpdates(true) },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => sendToUi('cmd:settings') },
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
        { label: 'New File…', accelerator: accel('newFile'), click: () => void newFileFlow() },
        { label: 'New Folder…', accelerator: accel('newFolder'), click: () => void newFolderFlow() },
        { type: 'separator' },
        { label: 'Open…', accelerator: accel('open'), click: () => openDialog() },
        { label: 'Add Folder to Workspace…', accelerator: accel('addFolder'), click: () => openFolderDialog(true) },
        { type: 'separator' },
        { label: 'Jump to File…', accelerator: accel('commandPalette'), click: () => sendToUi('cmd:command-palette') },
        { label: 'Close File', accelerator: accel('closeFile'), click: () => sendToUi('cmd:close-file') },
        { label: 'Refresh', accelerator: accel('refresh'), click: () => void refreshAll() },
        { type: 'separator' },
        { label: 'Toggle Edit Mode', accelerator: accel('toggleEdit'), click: () => sendToUi('cmd:toggle-edit') },
        { label: 'Save', accelerator: accel('save'), click: () => sendToUi('cmd:save') },
        { type: 'separator' },
        { label: 'Find in Files…', accelerator: accel('searchAll'), click: () => sendToUi('cmd:search') },
        { type: 'separator' },
        { label: 'Export as HTML…', click: () => sendToUi('cmd:export-html') },
        { label: 'Export as PDF…', click: () => sendToUi('cmd:export-pdf') }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // Undo/redo route to CodeMirror — Electron's native execCommand undo
        // doesn't drive CodeMirror 6's own history.
        { label: 'Undo', accelerator: accel('undo'), click: () => sendToUi('cmd:edit-undo') },
        { label: 'Redo', accelerator: accel('redo'), click: () => sendToUi('cmd:edit-redo') },
        { type: 'separator' },
        // Native clipboard roles act on the focused editable element (incl. the editor).
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: accel('toggleSidebar'), click: () => sendToUi('cmd:focus-mode') },
        { label: 'Toggle Table of Contents', accelerator: accel('toggleToc'), click: () => sendToUi('cmd:toggle-toc') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' } as Electron.MenuItemConstructorOptions] : [])
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }]
    },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: accel('shortcuts'), click: () => sendToUi('cmd:shortcuts') },
        { label: 'Contributing & Developer Info', click: () => sendToUi('cmd:developer') },
        { type: 'separator' },
        { label: 'View Project on GitHub', click: () => shell.openExternal('https://github.com/avnat/orchid') },
        { type: 'separator' },
        {
          label: 'Give Orchid a Shout-out on X',
          click: () =>
            shell.openExternal(
              'https://twitter.com/intent/tweet?text=' +
                encodeURIComponent(
                  "I've been reading my Markdown in Orchid — a clean, native macOS reader by @AvneeNathani 🌸 https://github.com/avnat/orchid"
                )
            )
        },
        { label: 'Follow @AvneeNathani on X', click: () => shell.openExternal('https://twitter.com/AvneeNathani') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Collect native crashes locally (no upload — we read them on next launch).
crashReporter.start({ uploadToServer: false })

function crashMeta(): { version: string; os: string; arch: string } {
  return { version: app.getVersion(), os: process.getSystemVersion(), arch: process.arch }
}

// Last line of defence against "Orchid quit unexpectedly": a stray error in the
// main process (a background timer, an IPC handler, a rejected promise) would
// otherwise take the whole app down. Report it and keep running.
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception:', err)
  reportCrash('uncaughtException', err?.stack ?? String(err), crashMeta())
})
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandled rejection:', reason)
  const detail = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)
  reportCrash('unhandledRejection', detail, crashMeta())
})

// "Did the last run exit cleanly?" sentinel — catches hard native crashes (which
// can't run JS at crash time) by noticing the marker survived to the next launch.
function crashSentinel(): string {
  return join(app.getPath('userData'), '.running')
}
function armSentinel(): void {
  try {
    if (existsSync(crashSentinel())) {
      reportCrash('unclean-exit', 'Previous session did not exit cleanly (possible native crash).', crashMeta())
    }
    writeFileSync(crashSentinel(), String(Date.now()), 'utf8')
  } catch {
    /* ignore */
  }
}
app.on('will-quit', () => {
  try {
    unlinkSync(crashSentinel())
  } catch {
    /* ignore */
  }
})
app.on('child-process-gone', (_e, d) => {
  if (d.reason !== 'clean-exit') reportCrash('child-process-gone', `${d.type}: ${d.reason}`, crashMeta())
})

app.whenReady().then(async () => {
  armSentinel()
  await loadShortcutOverrides()
  app.setAboutPanelOptions({
    applicationName: 'Orchid',
    applicationVersion: app.getVersion(),
    copyright: '© 2026 Avnee · MIT',
    credits: 'A calm, native macOS reader for the Markdown your tools generate.'
  })
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

  safeBuildMenu()
  createWindow()

  // One quiet update check shortly after launch (the renderer ignores it if the
  // user already dismissed this version). No repeated polling.
  if (!isDev && !process.env['ORCHID_SHOT']) {
    setTimeout(() => void checkForUpdates(false), 3500)
  }

  // Dev/promo: capture a sequence of frames (for assembling a GIF/video).
  const framesDir = process.env['ORCHID_FRAMES']
  if (framesDir) {
    mainWindow?.webContents.once('did-finish-load', async () => {
      if (!mainWindow) return
      const evalJs = process.env['ORCHID_EVAL']
      if (evalJs) {
        await new Promise((r) => setTimeout(r, 500))
        await mainWindow.webContents.executeJavaScript(evalJs).catch(() => {})
      }
      await new Promise((r) => setTimeout(r, 700)) // let layout/animation settle
      const count = Number(process.env['ORCHID_FRAME_COUNT'] || '48')
      const interval = Number(process.env['ORCHID_FRAME_INTERVAL'] || '125')
      const spinSel = process.env['ORCHID_SPIN'] // CSS selector to rotate explicitly per frame
      for (let i = 0; i < count; i++) {
        if (spinSel) {
          const deg = (i / count) * 360 // exact even rotation → seamless loop
          await mainWindow.webContents
            .executeJavaScript(
              `(function(){var el=document.querySelector(${JSON.stringify(spinSel)});` +
                `if(el){el.style.animation='none';el.style.transformOrigin='50% 50%';` +
                `el.style.transform='rotate(${deg}deg)';}})()`
            )
            .catch(() => {})
          await new Promise((r) => setTimeout(r, 40)) // let it paint
        }
        const img = await mainWindow.webContents.capturePage()
        await fs.writeFile(join(framesDir, `frame-${String(i).padStart(3, '0')}.png`), img.toPNG())
        if (!spinSel) await new Promise((r) => setTimeout(r, interval))
      }
      console.log('ORCHID_FRAMES done:', count)
      app.quit()
    })
  }

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

  // Fires on system appearance changes (e.g. macOS auto Light↔Dark at sunset),
  // even when the window has been closed but the app is still running.
  nativeTheme.on('updated', () => {
    sendToUi('theme:changed', { shouldUseDarkColors: nativeTheme.shouldUseDarkColors })
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
ipcMain.handle('dialog:open', async () => openDialog())
ipcMain.handle('dialog:addFolder', async () => openFolderDialog(true))

ipcMain.handle('workspace:openPath', async (_e, p: string) => {
  const stat = await fs.stat(p).catch(() => null)
  if (stat?.isDirectory()) await openFolder(p, workspace.length > 0)
  else if (stat?.isFile() && TEXT_RE.test(p)) await openFile(p)
  else if (stat?.isFile() && mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['OK'],
      message: "Can't open this file",
      detail: `Orchid reads text and Markdown files. "${basename(p)}" isn't a type it can display.`
    })
  }
})

ipcMain.handle('workspace:closeFolder', async (_e, root: string) => closeFolder(root))
ipcMain.handle('workspace:refresh', async () => refreshAll())
ipcMain.handle('workspace:rescan', async (_e, changedPath: string) => rescanFolder(changedPath))

ipcMain.handle('fs:read', async (_e, filePath: string) => {
  if (!withinWorkspace(filePath)) throw new Error('Path outside the workspace')
  const buf = await fs.readFile(filePath)
  // crude binary sniff — a NUL byte near the start means it isn't text we can show
  if (buf.subarray(0, 8000).includes(0)) throw new Error('UNSUPPORTED_BINARY')
  return buf.toString('utf8')
})

ipcMain.handle('fs:write', async (_e, filePath: string, content: string) => {
  if (!withinWorkspace(filePath)) throw new Error('Path outside the workspace')
  await fs.writeFile(filePath, content, 'utf8')
  return true
})

// Raw bytes for binary viewers (e.g. the PDF reader). Returned as a Uint8Array.
ipcMain.handle('fs:readBinary', async (_e, filePath: string) => {
  if (!withinWorkspace(filePath)) throw new Error('Path outside the workspace')
  const buf = await fs.readFile(filePath)
  return new Uint8Array(buf)
})

ipcMain.handle('fs:reveal', async (_e, filePath: string) => {
  if (!withinWorkspace(filePath)) return
  shell.showItemInFolder(filePath)
})

// ---- File / folder operations ----
ipcMain.handle('fs:createFile', async (_e, dir: string, name: string) => {
  // Default to .txt when no extension is given (Sublime-style).
  const fname = /\.[^/.]+$/.test(basename(name)) ? name : `${name}.txt`
  const target = join(dir, fname)
  if (!withinWorkspace(target)) throw new Error('Path outside the workspace')
  // refuse to clobber an existing file
  if (await fs.stat(target).then(() => true).catch(() => false)) {
    throw new Error('A file with that name already exists')
  }
  await fs.mkdir(dirname(target), { recursive: true })
  await fs.writeFile(target, '', 'utf8')
  await revealCreated(target) // show it in the sidebar right away
  return target
})

ipcMain.handle('fs:createFolder', async (_e, parentDir: string, name: string) => {
  const target = join(parentDir, name)
  if (!withinWorkspace(target)) throw new Error('Path outside the workspace')
  await fs.mkdir(target, { recursive: true })
  await revealCreated(target)
  return target
})

ipcMain.handle('fs:trash', async (_e, target: string) => {
  if (!withinWorkspace(target)) throw new Error('Path outside the workspace')
  await shell.trashItem(target)
  return true
})

ipcMain.handle('fs:trashMany', async (_e, paths: string[]) => {
  for (const p of paths) {
    if (withinWorkspace(p)) await shell.trashItem(p).catch(() => {})
  }
  return true
})

const exists = (p: string): Promise<boolean> => fs.stat(p).then(() => true).catch(() => false)

/** Path relative to its workspace folder root (prefixed with the folder name when several are open). */
function relWorkspacePath(target: string): string {
  const t = resolve(target)
  const f = workspace.find((w) => {
    const r = resolve(w.root)
    return t === r || t.startsWith(r + sep)
  })
  if (!f) return basename(target)
  const rel = relative(resolve(f.root), t)
  return workspace.length > 1 ? join(f.name, rel) : rel
}

/** Copy a file or folder beside itself as "name copy" (auto-incrementing). */
async function duplicatePath(target: string): Promise<string> {
  const st = await fs.stat(target)
  const dir = dirname(target)
  const base = basename(target)
  const ext = st.isDirectory() ? '' : (base.match(/\.[^.]+$/)?.[0] ?? '')
  const stem = ext ? base.slice(0, -ext.length) : base
  let dest = join(dir, `${stem} copy${ext}`)
  for (let i = 2; await exists(dest); i++) dest = join(dir, `${stem} copy ${i}${ext}`)
  await fs.cp(target, dest, { recursive: true })
  return dest
}

ipcMain.handle('fs:rename', async (_e, target: string, newName: string) => {
  if (!withinWorkspace(target)) throw new Error('Path outside the workspace')
  const dest = join(dirname(target), newName.trim())
  if (!withinWorkspace(dest)) throw new Error('Path outside the workspace')
  if (resolve(dest) === resolve(target)) return target
  if (await exists(dest)) throw new Error('An item with that name already exists')
  await fs.rename(target, dest)
  return dest
})

ipcMain.handle('fs:duplicate', async (_e, target: string) => {
  if (!withinWorkspace(target)) throw new Error('Path outside the workspace')
  return duplicatePath(target)
})

ipcMain.handle('fs:move', async (_e, src: string, destDir: string) => {
  if (!withinWorkspace(src) || !withinWorkspace(destDir)) throw new Error('Path outside the workspace')
  const s = resolve(src)
  const d = resolve(destDir)
  // no-op if already there; refuse to drop a folder into itself or a descendant
  if (dirname(s) === d) return src
  if (d === s || d.startsWith(s + sep)) throw new Error("Can't move a folder into itself")
  const dest = join(destDir, basename(src))
  if (await exists(dest)) throw new Error('An item with that name already exists there')
  await fs.rename(src, dest)
  return dest
})

ipcMain.handle('fs:fileMenu', (_e, target: string, opts?: { pinned?: boolean; isFolder?: boolean }) => {
  if (!withinWorkspace(target)) return
  const send = (ch: string): void => {
    sendToUi(ch, target)
  }
  const menu = Menu.buildFromTemplate([
    { label: 'Rename…', click: () => send('menu:rename') },
    { label: 'Duplicate', click: () => duplicatePath(target).catch(() => {}) },
    { type: 'separator' },
    { label: 'Copy Path', click: () => clipboard.writeText(target) },
    { label: 'Copy Relative Path', click: () => clipboard.writeText(relWorkspacePath(target)) },
    { type: 'separator' },
    { label: opts?.pinned ? 'Unpin' : 'Pin', click: () => send('menu:pin-toggle') },
    { label: 'Select (for multi-delete)', click: () => send('file:select') },
    { type: 'separator' },
    { label: 'Reveal in Finder', click: () => shell.showItemInFolder(target) },
    {
      label: 'Move to Trash',
      click: async () => {
        if (!withinWorkspace(target) || !mainWindow) return
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['Cancel', 'Move to Trash'],
          defaultId: 1,
          cancelId: 0,
          message: `Move "${basename(target)}" to Trash?`,
          detail: 'You can restore it from the Trash later.'
        })
        if (response === 1) await shell.trashItem(target).catch(() => {})
      }
    }
  ])
  menu.popup({ window: mainWindow ?? undefined })
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('update:check', async () => checkForUpdates(true))

ipcMain.handle('app:new-file', async () => newFileFlow())

ipcMain.handle('theme:get', async () => ({ shouldUseDarkColors: nativeTheme.shouldUseDarkColors }))

ipcMain.handle('app:getVersion', async () => app.getVersion())

// ---- Shortcuts IPC ----
ipcMain.handle('shortcuts:get', async () => resolvedShortcuts())

ipcMain.handle('shortcuts:set', async (_e, id: string, accelerator: string | null) => {
  const def = SHORTCUT_DEFS.find((d) => d.id === id)
  if (!def) return { ok: false, error: 'Unknown command' }
  if (accelerator === null || accelerator === def.defaultAccelerator) {
    delete shortcutOverrides[id] // back to default
  } else if (isValidAccelerator(accelerator)) {
    shortcutOverrides[id] = accelerator
  } else {
    return { ok: false, error: 'Invalid shortcut' }
  }
  await saveShortcutOverrides()
  safeBuildMenu()
  const resolved = resolvedShortcuts()
  sendToUi('shortcuts:changed', resolved)
  return { ok: true, ...resolved }
})

ipcMain.handle('shortcuts:reset', async () => {
  shortcutOverrides = {}
  await saveShortcutOverrides()
  safeBuildMenu()
  const resolved = resolvedShortcuts()
  sendToUi('shortcuts:changed', resolved)
  return resolved
})

// ---- In-file find (⌘F) ----
ipcMain.handle('find:start', (_e, query: string, opts: { forward?: boolean; findNext?: boolean }) => {
  if (query) mainWindow?.webContents.findInPage(query, opts)
})
ipcMain.handle('find:stop', () => {
  mainWindow?.webContents.stopFindInPage('clearSelection')
})

// ---- Unsaved-changes / quit guard ----
ipcMain.on('win:dirty', (_e, dirty: boolean) => {
  unsavedChanges = !!dirty
})
ipcMain.on('win:ready-to-close', () => {
  forceClose = true
  mainWindow?.close()
})

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

ipcMain.handle(
  'export:pdf',
  async (
    _e,
    html: string,
    defaultName: string,
    opts?: { header?: string; footer?: string; pageNumbers?: boolean }
  ) => {
    const out = await chooseSavePath(defaultName, 'pdf')
    if (!out) return false
    const tmp = join(app.getPath('temp'), `orchid-export-${Date.now()}.html`)
    await fs.writeFile(tmp, html, 'utf8')
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })

    const header = (opts?.header ?? '').trim()
    const footer = (opts?.footer ?? '').trim()
    const pageNumbers = !!opts?.pageNumbers
    const hasHeader = !!header
    const hasFooter = !!(footer || pageNumbers)
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const headerTemplate = `<div style="font-size:9px;width:100%;text-align:center;color:#9a9a9a;padding:0 0.5in;">${esc(header)}</div>`
    const footerTemplate = `<div style="font-size:9px;width:100%;color:#9a9a9a;padding:0 0.5in;display:flex;justify-content:space-between;"><span>${esc(footer)}</span><span>${pageNumbers ? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>' : ''}</span></div>`

    try {
      await win.loadFile(tmp)
      await new Promise((r) => setTimeout(r, 300))
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        displayHeaderFooter: hasHeader || hasFooter,
        headerTemplate,
        footerTemplate,
        margins: {
          top: hasHeader ? 0.85 : 0.6,
          bottom: hasFooter ? 0.85 : 0.6,
          left: 0.6,
          right: 0.6
        }
      })
      await fs.writeFile(out, pdf)
      shell.showItemInFolder(out)
    } finally {
      win.destroy()
      fs.unlink(tmp).catch(() => {})
    }
    return true
  }
)
