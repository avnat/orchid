import { app, shell, BrowserWindow, ipcMain, dialog, Menu, nativeTheme, protocol, net, screen, clipboard, crashReporter } from 'electron'
import { join, resolve, relative, sep, basename, dirname } from 'path'
import { promises as fs, writeFileSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { reportCrash } from './crash-report'
import { summarizeCrashIps } from './crash-summary'
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

// Every window carries its own workspace, watcher, and close-guard state.
interface WinState {
  win: BrowserWindow
  workspace: WSFolder[]
  unsavedChanges: boolean
  forceClose: boolean
  lastRendererReload: number
}

const winStates = new Map<number, WinState>()

// True while a Quit (⌘Q / Dock right-click → Quit) is in flight. A window's
// unsaved-changes guard prevents its close, which silently cancels the whole
// quit — this flag lets us resume the quit once every window has closed.
let quitting = false
app.on('before-quit', () => {
  quitting = true
})

function stateFor(win: BrowserWindow | null | undefined): WinState | null {
  return win ? (winStates.get(win.id) ?? null) : null
}

function stateFromEvent(e: { sender: Electron.WebContents }): WinState | null {
  return stateFor(BrowserWindow.fromWebContents(e.sender))
}

/** The window a menu action should act on: the focused one, else any open one. */
function focusedState(): WinState | null {
  const focused = stateFor(BrowserWindow.getFocusedWindow())
  if (focused) return focused
  const first = winStates.values().next()
  return first.done ? null : first.value
}

/** A window for a menu action, creating one (and waiting for its renderer) if none exist. */
async function ensureWindow(): Promise<WinState> {
  const st = focusedState()
  if (st) return st
  const win = createWindow()
  await new Promise<void>((r) => win.webContents.once('did-finish-load', () => r()))
  return stateFor(win)!
}

/** The window is present and not torn down — safe to message or parent a dialog. */
function windowAlive(st: WinState | null): st is WinState {
  return !!st && !st.win.isDestroyed() && !st.win.webContents.isDestroyed()
}

/**
 * Send an IPC message to a window's renderer only if it is alive. Background and
 * async callers (file watcher, theme changes, update checks, menu actions with no
 * window) can fire after a window is gone — this prevents "Object has been
 * destroyed" crashes in the main process.
 */
function sendToWin(st: WinState | null, channel: string, payload?: unknown): void {
  if (windowAlive(st)) st.win.webContents.send(channel, payload)
}

function sendToFocused(channel: string, payload?: unknown): void {
  sendToWin(focusedState(), channel, payload)
}

/** Window-independent notifications (theme, shortcut remaps) go to every window. */
function broadcast(channel: string, payload?: unknown): void {
  for (const st of winStates.values()) sendToWin(st, channel, payload)
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

/** True if `target` lives inside any open workspace folder of `st`'s window. */
function withinWorkspace(st: WinState | null, target: string): boolean {
  if (!st) return false
  const r = resolve(target)
  return st.workspace.some((f) => {
    const root = resolve(f.root)
    return r === root || r.startsWith(root + sep)
  })
}

/** True if `target` is inside any window's workspace (for window-less callers like the asset protocol). */
function withinAnyWorkspace(target: string): boolean {
  for (const st of winStates.values()) if (withinWorkspace(st, target)) return true
  return false
}

// ---- Workspace ----
function emitWorkspace(st: WinState, select?: string): void {
  sendToWin(st, 'workspace:changed', { folders: st.workspace, select })
  rewatch(st)
}

function rewatch(st: WinState): void {
  const paths = st.workspace.map((f) => (f.isFile && f.tree[0] ? f.tree[0].path : f.root))
  watchPaths(paths, st.win)
}

async function openFolder(st: WinState, folderPath: string, add = false): Promise<void> {
  const tree = await scanFolder(folderPath)
  const entry: WSFolder = { root: folderPath, name: basename(folderPath) || folderPath, tree }
  if (add) {
    const i = st.workspace.findIndex((f) => f.root === folderPath)
    if (i >= 0) st.workspace[i] = entry
    else st.workspace.push(entry)
  } else {
    st.workspace = [entry]
  }
  emitWorkspace(st)
}

/**
 * Open a single file. If it already lives inside the window's workspace, just
 * select it (a new tab). Otherwise add it as a single-file workspace entry —
 * open folders and their tabs stay put.
 */
async function openFile(st: WinState, filePath: string): Promise<void> {
  if (!withinWorkspace(st, filePath)) {
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
    const entry: WSFolder = { root: dir, name: basename(filePath), tree: [node], isFile: true }
    const i = st.workspace.findIndex((f) => f.root === dir && f.isFile)
    if (i >= 0) st.workspace[i] = entry
    else st.workspace.push(entry)
  }
  emitWorkspace(st, filePath)
}

function closeFolder(st: WinState, root: string): void {
  st.workspace = st.workspace.filter((f) => f.root !== root)
  emitWorkspace(st)
}

async function rescanFolder(st: WinState, changedPath: string): Promise<void> {
  const f = st.workspace.find((w) => !w.isFile && (changedPath === w.root || changedPath.startsWith(w.root + sep)))
  if (!f) return
  f.tree = await scanFolder(f.root)
  emitWorkspace(st)
}

/**
 * Re-scan the workspace that contains `target` so a just-created file/folder
 * shows immediately — independent of the file watcher. If `target` lives in a
 * single-file workspace, promote it to a full folder view so siblings appear.
 */
async function revealCreated(st: WinState, target: string): Promise<void> {
  const t = resolve(target)
  const f = st.workspace.find((w) => {
    const r = resolve(w.root)
    return t === r || t.startsWith(r + sep)
  })
  if (!f) return
  if (f.isFile) {
    f.isFile = false
    f.name = basename(f.root)
  }
  f.tree = await scanFolder(f.root)
  emitWorkspace(st)
}

async function refreshAll(st: WinState): Promise<void> {
  for (const f of st.workspace) {
    if (!f.isFile) f.tree = await scanFolder(f.root)
  }
  emitWorkspace(st)
}

async function openFolderDialog(st: WinState, add: boolean): Promise<void> {
  if (!windowAlive(st)) return
  const result = await dialog.showOpenDialog(st.win, {
    properties: ['openDirectory'],
    message: add ? 'Add a folder to the workspace' : 'Choose a folder of markdown to read'
  })
  if (result.canceled || result.filePaths.length === 0) return
  await openFolder(st, result.filePaths[0], add)
}

/**
 * One dialog that accepts a folder OR a single file (macOS allows both).
 * With `add`, a chosen folder joins the workspace instead of replacing it
 * (files are always additive).
 */
async function openDialog(st: WinState, add = false): Promise<void> {
  if (!windowAlive(st)) return
  const result = await dialog.showOpenDialog(st.win, {
    properties: ['openFile', 'openDirectory'],
    // "All files" is the default so nothing is wrongly greyed out — macOS can
    // resolve some .md files to a non-markdown UTI, which an extension filter
    // would block. "Markdown & text" stays available as a narrowing option.
    filters: [
      { name: 'All files', extensions: ['*'] },
      { name: 'Markdown & text', extensions: TEXT_EXTENSIONS.map((e) => e.slice(1)) }
    ],
    message: add ? 'Add a folder or a file to the workspace' : 'Open a folder or a file'
  })
  if (result.canceled || result.filePaths.length === 0) return
  const p = result.filePaths[0]
  const stat = await fs.stat(p).catch(() => null)
  if (stat?.isDirectory()) await openFolder(st, p, add)
  else if (stat?.isFile()) await openFile(st, p) // read-time guardrail handles binary/unsupported
}

/**
 * New File. With a workspace open, the renderer's in-place create dialog handles
 * it. With nothing open, ask where to save (Save As), create it, and open it.
 */
async function newFileFlow(st: WinState): Promise<void> {
  if (st.workspace.length > 0) {
    sendToWin(st, 'cmd:new-file')
    return
  }
  if (!windowAlive(st)) return
  const { canceled, filePath } = await dialog.showSaveDialog(st.win, {
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
  await openFile(st, filePath) // selects it via emitWorkspace
  sendToWin(st, 'cmd:new-file-created') // renderer opens it in edit mode
}

/** New Folder with nothing open: pick a location, create it, open it as the workspace. */
async function newFolderFlow(st: WinState): Promise<void> {
  if (st.workspace.length > 0) {
    sendToWin(st, 'cmd:new-folder')
    return
  }
  if (!windowAlive(st)) return
  const { canceled, filePath } = await dialog.showSaveDialog(st.win, {
    title: 'New Folder',
    message: 'Choose where to create the folder',
    buttonLabel: 'Create',
    nameFieldLabel: 'Name:',
    defaultPath: join(app.getPath('documents'), 'New Folder')
  })
  if (canceled || !filePath) return
  await fs.mkdir(filePath, { recursive: true }).catch(() => {})
  await openFolder(st, filePath, false)
}

function createWindow(): BrowserWindow {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(1180, screenW - 60)
  const height = Math.min(800, screenH - 60)

  // Additional windows cascade from the focused one instead of stacking dead-centre.
  const focused = BrowserWindow.getFocusedWindow()
  const cascade = focused ? { x: focused.getBounds().x + 28, y: focused.getBounds().y + 28 } : { center: true }

  const win = new BrowserWindow({
    width,
    height,
    minWidth: 560,
    minHeight: 420,
    ...cascade,
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

  const st: WinState = { win, workspace: [], unsavedChanges: false, forceClose: false, lastRendererReload: 0 }
  winStates.set(win.id, st)

  win.on('ready-to-show', () => {
    // Safety: refit/recenter if the window is bigger than the screen or off-screen.
    if (!win.isDestroyed()) {
      const wa = screen.getPrimaryDisplay().workArea
      const b = win.getBounds()
      const w = Math.min(b.width, wa.width - 60)
      const h = Math.min(b.height, wa.height - 60)
      const offscreen =
        b.x < wa.x || b.y < wa.y || b.x + b.width > wa.x + wa.width || b.y + b.height > wa.y + wa.height
      if (w !== b.width || h !== b.height || offscreen) {
        win.setBounds({
          width: w,
          height: h,
          x: wa.x + Math.round((wa.width - w) / 2),
          y: wa.y + Math.round((wa.height - h) / 2)
        })
      }
      win.show()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Right-click menu for editable fields / selected text (Electron has none by
  // default). Items are contextual: paste only in editable fields, copy/cut only
  // with a selection.
  win.webContents.on('context-menu', (_e, params) => {
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
    Menu.buildFromTemplate(items).popup({ window: win })
  })

  // Guard against losing unsaved edits when the window/app closes.
  win.on('close', (e) => {
    if (!st.unsavedChanges || st.forceClose || win.isDestroyed()) return
    e.preventDefault()
    // The dialog must actually be seen — the window may be minimized or on
    // another Space when the user quits from the Dock.
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    // Headless test hook: native dialogs can't be clicked by the E2E harness.
    const testResponse = process.env['ORCHID_TEST_CLOSE_RESPONSE']
    const answer = testResponse
      ? Promise.resolve({ response: Number(testResponse) })
      : dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Save', "Don't Save", 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          message: 'Save changes before closing?',
          detail: "Your edits will be lost if you don't save them."
        })
    answer
      .then(({ response }) => {
        if (response === 0) sendToWin(st, 'app:save-and-close')
        else if (response === 1) {
          st.forceClose = true
          if (!win.isDestroyed()) win.close()
        } else {
          quitting = false // Cancel aborts an in-flight Quit
        }
      })
  })

  // Drop the per-window state once the window is gone, so background listeners
  // (e.g. nativeTheme) don't touch a destroyed window. If a Quit was paused by
  // the unsaved-changes dialog, resume it once the last window is gone.
  win.on('closed', () => {
    stopWatching(win)
    winStates.delete(win.id)
    if (quitting && winStates.size === 0) app.quit()
  })

  // The renderer crashed (gone / OOM / GPU) — report it, then auto-recover by
  // reloading the window so the user sees a brief flash instead of a dead window.
  // A 5s guard prevents a reload storm if it crashes again immediately on load.
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return
    reportCrash('render-process-gone', `${details.reason} (exitCode ${details.exitCode})`, crashMeta())
    const now = Date.now()
    if (windowAlive(st) && now - st.lastRendererReload > 5000) {
      st.lastRendererReload = now
      win.webContents.reload()
    }
  })

  // In-file find (⌘F) — relay native find results to the renderer's find bar.
  win.webContents.on('found-in-page', (_e, result) => {
    sendToWin(st, 'find:result', {
      active: result.activeMatchOrdinal,
      total: result.matches
    })
  })

  if (isDev) {
    win.webContents.on('console-message', (e) => {
      if (e.level === 'warning' || e.level === 'error')
        console.log(`[renderer ${e.level.toUpperCase()}] ${e.message} (${e.sourceId}:${e.lineNumber})`)
    })
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
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
  const st = focusedState()
  if (!rel) {
    if (manual && windowAlive(st)) {
      await dialog.showMessageBox(st.win, {
        type: 'warning',
        buttons: ['OK'],
        message: "Couldn't check for updates",
        detail: 'Please check your connection and try again.'
      })
    }
    return
  }
  if (cmpVersions(rel.version, app.getVersion()) > 0) {
    sendToWin(st, 'update:available', { ...rel, manual })
  } else if (manual && windowAlive(st)) {
    await dialog.showMessageBox(st.win, {
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
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => sendToFocused('cmd:settings') },
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
        { label: 'New Window', accelerator: accel('newWindow'), click: () => void createWindow() },
        { type: 'separator' },
        { label: 'New File…', accelerator: accel('newFile'), click: () => void ensureWindow().then(newFileFlow) },
        { label: 'New Folder…', accelerator: accel('newFolder'), click: () => void ensureWindow().then(newFolderFlow) },
        { type: 'separator' },
        { label: 'Open…', accelerator: accel('open'), click: () => void ensureWindow().then(openDialog) },
        {
          label: 'Add Folder to Workspace…',
          accelerator: accel('addFolder'),
          click: () => void ensureWindow().then((st) => openFolderDialog(st, true))
        },
        { type: 'separator' },
        { label: 'Jump to File…', accelerator: accel('commandPalette'), click: () => sendToFocused('cmd:command-palette') },
        { label: 'Close Tab', accelerator: accel('closeFile'), click: () => sendToFocused('cmd:close-file') },
        { label: 'Refresh', accelerator: accel('refresh'), click: () => void refreshFocused() },
        { type: 'separator' },
        { label: 'Toggle Edit Mode', accelerator: accel('toggleEdit'), click: () => sendToFocused('cmd:toggle-edit') },
        { label: 'Save', accelerator: accel('save'), click: () => sendToFocused('cmd:save') },
        { type: 'separator' },
        { label: 'Find in Files…', accelerator: accel('searchAll'), click: () => sendToFocused('cmd:search') },
        { type: 'separator' },
        { label: 'Export as HTML…', click: () => sendToFocused('cmd:export-html') },
        { label: 'Export as PDF…', click: () => sendToFocused('cmd:export-pdf') }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // Undo/redo route to CodeMirror — Electron's native execCommand undo
        // doesn't drive CodeMirror 6's own history.
        { label: 'Undo', accelerator: accel('undo'), click: () => sendToFocused('cmd:edit-undo') },
        { label: 'Redo', accelerator: accel('redo'), click: () => sendToFocused('cmd:edit-redo') },
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
        { label: 'Toggle Sidebar', accelerator: accel('toggleSidebar'), click: () => sendToFocused('cmd:focus-mode') },
        { label: 'Toggle Table of Contents', accelerator: accel('toggleToc'), click: () => sendToFocused('cmd:toggle-toc') },
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
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { label: 'Show Next Tab', accelerator: accel('nextTab'), click: () => sendToFocused('cmd:next-tab') },
        { label: 'Show Previous Tab', accelerator: accel('prevTab'), click: () => sendToFocused('cmd:prev-tab') },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      role: 'help',
      submenu: [
        { label: 'Keyboard Shortcuts', accelerator: accel('shortcuts'), click: () => sendToFocused('cmd:shortcuts') },
        { label: 'Contributing & Developer Info', click: () => sendToFocused('cmd:developer') },
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

async function refreshFocused(): Promise<void> {
  const st = focusedState()
  if (st) await refreshAll(st)
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

app.on('child-process-gone', (_e, d) => {
  if (d.reason !== 'clean-exit') reportCrash('child-process-gone', `${d.type}: ${d.reason}`, crashMeta())
})

// Native crashes (e.g. a hard V8/Chromium abort in the main process) can't run
// JS at crash time, so the handlers above never see them. macOS, however, writes
// a crash log for every one of them — the same .ips Apple's "quit unexpectedly"
// dialog produces. On launch we read any new Orchid crash logs and report a
// summary. This is ground truth: it catches crashes Crashpad misses, with no
// false positives (only real, OS-recorded crashes have a file).
function crashSeenFile(): string {
  return join(app.getPath('userData'), 'crash-seen.json')
}
function reportDiagnosticCrashes(): void {
  try {
    const dir = process.env['ORCHID_CRASH_DIR'] || join(homedir(), 'Library', 'Logs', 'DiagnosticReports')
    let seen = 0
    try {
      seen = Number((JSON.parse(readFileSync(crashSeenFile(), 'utf8')) as { seen?: number }).seen) || 0
    } catch {
      /* first run */
    }
    // First run: only look back a day so we don't dump a user's entire history.
    const cutoff = seen || Date.now() - 24 * 60 * 60 * 1000
    let files: string[]
    try {
      files = readdirSync(dir)
    } catch {
      return // no crash-log directory
    }
    let maxMtime = seen
    for (const f of files) {
      if (!/^Orchid.*\.(ips|crash|panic)$/i.test(f)) continue
      let mtime = 0
      try {
        mtime = statSync(join(dir, f)).mtimeMs
      } catch {
        continue
      }
      if (mtime > maxMtime) maxMtime = mtime
      if (mtime <= cutoff) continue
      try {
        reportCrash('native-crash', summarizeCrashIps(readFileSync(join(dir, f), 'utf8')), crashMeta())
      } catch {
        /* ignore a single unreadable report */
      }
    }
    try {
      writeFileSync(crashSeenFile(), JSON.stringify({ seen: Math.max(maxMtime, seen || Date.now()) }), 'utf8')
    } catch {
      /* best-effort */
    }
  } catch {
    /* crash reporting must never break startup */
  }
}

app.whenReady().then(async () => {
  reportDiagnosticCrashes()
  await loadShortcutOverrides()
  app.setAboutPanelOptions({
    applicationName: 'Orchid',
    applicationVersion: app.getVersion(),
    version: '', // hide the parenthetical build number — it would repeat the version
    copyright: '© 2026 Avnee · MIT',
    credits: 'A calm, native macOS reader for the Markdown your tools generate.'
  })
  protocol.handle('orchid-asset', (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (!withinAnyWorkspace(filePath)) return new Response('Forbidden', { status: 403 })
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
  const firstWin = createWindow()
  const firstState = (): WinState | null => stateFor(firstWin)

  // One quiet update check shortly after launch (the renderer ignores it if the
  // user already dismissed this version). No repeated polling.
  if (!isDev && !process.env['ORCHID_SHOT']) {
    setTimeout(() => void checkForUpdates(false), 3500)
  }

  // Dev/promo: capture a sequence of frames (for assembling a GIF/video).
  const framesDir = process.env['ORCHID_FRAMES']
  if (framesDir) {
    firstWin.webContents.once('did-finish-load', async () => {
      if (firstWin.isDestroyed()) return
      const evalJs = process.env['ORCHID_EVAL']
      if (evalJs) {
        await new Promise((r) => setTimeout(r, 500))
        await firstWin.webContents.executeJavaScript(evalJs).catch(() => {})
      }
      await new Promise((r) => setTimeout(r, 700)) // let layout/animation settle
      const count = Number(process.env['ORCHID_FRAME_COUNT'] || '48')
      const interval = Number(process.env['ORCHID_FRAME_INTERVAL'] || '125')
      const spinSel = process.env['ORCHID_SPIN'] // CSS selector to rotate explicitly per frame
      for (let i = 0; i < count; i++) {
        if (spinSel) {
          const deg = (i / count) * 360 // exact even rotation → seamless loop
          await firstWin.webContents
            .executeJavaScript(
              `(function(){var el=document.querySelector(${JSON.stringify(spinSel)});` +
                `if(el){el.style.animation='none';el.style.transformOrigin='50% 50%';` +
                `el.style.transform='rotate(${deg}deg)';}})()`
            )
            .catch(() => {})
          await new Promise((r) => setTimeout(r, 40)) // let it paint
        }
        const img = await firstWin.webContents.capturePage()
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
    firstWin.webContents.once('did-finish-load', async () => {
      const st = firstState()
      if (!st) return
      const stat = await fs.stat(autoOpen).catch(() => null)
      if (stat?.isFile()) await openFile(st, autoOpen)
      else await openFolder(st, autoOpen, false)
      if (firstWin.isDestroyed()) return
      const sel = process.env['ORCHID_SELECT']
      if (sel) {
        await firstWin.webContents.executeJavaScript(
          `window.__store && window.__store.getState().selectFile(${JSON.stringify(sel)})`
        )
      }

      const exportTest = process.env['ORCHID_EXPORT_TEST']
      if (exportTest) {
        await new Promise((r) => setTimeout(r, 1200))
        const html: string | null = await firstWin.webContents.executeJavaScript(
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
          await firstWin.webContents.executeJavaScript(evalJs).catch(() => {})
        }
        setTimeout(async () => {
          const img = await firstWin.webContents.capturePage()
          await fs.writeFile(shotPath, img.toPNG())
          console.log('ORCHID_SHOT written to', shotPath)
        }, 1400)
      }
    })
  } else if (shotPath) {
    firstWin.webContents.once('did-finish-load', async () => {
      const evalJs = process.env['ORCHID_EVAL']
      if (evalJs && !firstWin.isDestroyed()) {
        await new Promise((r) => setTimeout(r, 500))
        await firstWin.webContents.executeJavaScript(evalJs).catch(() => {})
      }
      setTimeout(async () => {
        const img = await firstWin.webContents.capturePage()
        await fs.writeFile(shotPath, img.toPNG())
        console.log('ORCHID_SHOT written to', shotPath)
      }, 1200)
    })
  }

  // Fires on system appearance changes (e.g. macOS auto Light↔Dark at sunset),
  // even when every window has been closed but the app is still running.
  nativeTheme.on('updated', () => {
    broadcast('theme:changed', { shouldUseDarkColors: nativeTheme.shouldUseDarkColors })
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
ipcMain.handle('dialog:open', async (e) => {
  const st = stateFromEvent(e)
  if (st) await openDialog(st)
})
ipcMain.handle('dialog:addFolder', async (e) => {
  const st = stateFromEvent(e)
  if (st) await openFolderDialog(st, true)
})

// The sidebar's "+ Add folder or file" — like Open, but never closes anything.
ipcMain.handle('dialog:addAny', async (e) => {
  const st = stateFromEvent(e)
  if (st) await openDialog(st, true)
})

ipcMain.handle('app:new-window', async () => {
  createWindow()
})

// A fresh renderer (first load or a crash-recovery reload) pulls the workspace
// its window already has — IPC pushes sent before the load are lost otherwise.
ipcMain.handle('workspace:get', async (e) => ({ folders: stateFromEvent(e)?.workspace ?? [] }))

ipcMain.handle('workspace:openPath', async (e, p: string) => {
  const st = stateFromEvent(e)
  if (!st) return
  const stat = await fs.stat(p).catch(() => null)
  if (stat?.isDirectory()) await openFolder(st, p, st.workspace.length > 0)
  else if (stat?.isFile() && TEXT_RE.test(p)) await openFile(st, p)
  else if (stat?.isFile() && windowAlive(st)) {
    dialog.showMessageBox(st.win, {
      type: 'info',
      buttons: ['OK'],
      message: "Can't open this file",
      detail: `Orchid reads text and Markdown files. "${basename(p)}" isn't a type it can display.`
    })
  }
})

ipcMain.handle('workspace:closeFolder', async (e, root: string) => {
  const st = stateFromEvent(e)
  if (st) closeFolder(st, root)
})
ipcMain.handle('workspace:refresh', async (e) => {
  const st = stateFromEvent(e)
  if (st) await refreshAll(st)
})
ipcMain.handle('workspace:rescan', async (e, changedPath: string) => {
  const st = stateFromEvent(e)
  if (st) await rescanFolder(st, changedPath)
})

ipcMain.handle('fs:read', async (e, filePath: string) => {
  if (!withinWorkspace(stateFromEvent(e), filePath)) throw new Error('Path outside the workspace')
  const buf = await fs.readFile(filePath)
  // crude binary sniff — a NUL byte near the start means it isn't text we can show
  if (buf.subarray(0, 8000).includes(0)) throw new Error('UNSUPPORTED_BINARY')
  return buf.toString('utf8')
})

ipcMain.handle('fs:write', async (e, filePath: string, content: string) => {
  if (!withinWorkspace(stateFromEvent(e), filePath)) throw new Error('Path outside the workspace')
  await fs.writeFile(filePath, content, 'utf8')
  return true
})

// Raw bytes for binary viewers (e.g. the PDF reader). Returned as a Uint8Array.
ipcMain.handle('fs:readBinary', async (e, filePath: string) => {
  if (!withinWorkspace(stateFromEvent(e), filePath)) throw new Error('Path outside the workspace')
  const buf = await fs.readFile(filePath)
  return new Uint8Array(buf)
})

ipcMain.handle('fs:reveal', async (e, filePath: string) => {
  if (!withinWorkspace(stateFromEvent(e), filePath)) return
  shell.showItemInFolder(filePath)
})

// ---- File / folder operations ----
ipcMain.handle('fs:createFile', async (e, dir: string, name: string) => {
  const st = stateFromEvent(e)
  // Default to .txt when no extension is given (Sublime-style).
  const fname = /\.[^/.]+$/.test(basename(name)) ? name : `${name}.txt`
  const target = join(dir, fname)
  if (!withinWorkspace(st, target)) throw new Error('Path outside the workspace')
  // refuse to clobber an existing file
  if (await fs.stat(target).then(() => true).catch(() => false)) {
    throw new Error('A file with that name already exists')
  }
  await fs.mkdir(dirname(target), { recursive: true })
  await fs.writeFile(target, '', 'utf8')
  await revealCreated(st!, target) // show it in the sidebar right away
  return target
})

ipcMain.handle('fs:createFolder', async (e, parentDir: string, name: string) => {
  const st = stateFromEvent(e)
  const target = join(parentDir, name)
  if (!withinWorkspace(st, target)) throw new Error('Path outside the workspace')
  await fs.mkdir(target, { recursive: true })
  await revealCreated(st!, target)
  return target
})

ipcMain.handle('fs:trash', async (e, target: string) => {
  if (!withinWorkspace(stateFromEvent(e), target)) throw new Error('Path outside the workspace')
  await shell.trashItem(target)
  return true
})

ipcMain.handle('fs:trashMany', async (e, paths: string[]) => {
  const st = stateFromEvent(e)
  for (const p of paths) {
    if (withinWorkspace(st, p)) await shell.trashItem(p).catch(() => {})
  }
  return true
})

const exists = (p: string): Promise<boolean> => fs.stat(p).then(() => true).catch(() => false)

/** Path relative to its workspace folder root (prefixed with the folder name when several are open). */
function relWorkspacePath(st: WinState, target: string): string {
  const t = resolve(target)
  const f = st.workspace.find((w) => {
    const r = resolve(w.root)
    return t === r || t.startsWith(r + sep)
  })
  if (!f) return basename(target)
  const rel = relative(resolve(f.root), t)
  return st.workspace.length > 1 ? join(f.name, rel) : rel
}

/** Middle-truncate a path for a menu label — the tail is the distinguishing part. */
function menuPath(p: string, max = 58): string {
  if (p.length <= max) return p
  const tail = Math.ceil((max - 1) * 0.62)
  return p.slice(0, max - 1 - tail) + '…' + p.slice(-tail)
}

ipcMain.handle('fs:rename', async (e, target: string, newName: string) => {
  const st = stateFromEvent(e)
  if (!withinWorkspace(st, target)) throw new Error('Path outside the workspace')
  const dest = join(dirname(target), newName.trim())
  if (!withinWorkspace(st, dest)) throw new Error('Path outside the workspace')
  if (resolve(dest) === resolve(target)) return target
  if (await exists(dest)) throw new Error('An item with that name already exists')
  await fs.rename(target, dest)
  return dest
})

ipcMain.handle('fs:move', async (e, src: string, destDir: string) => {
  const st = stateFromEvent(e)
  if (!withinWorkspace(st, src) || !withinWorkspace(st, destDir)) throw new Error('Path outside the workspace')
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

ipcMain.handle('fs:fileMenu', (e, target: string, opts?: { pinned?: boolean; isFolder?: boolean }) => {
  const st = stateFromEvent(e)
  if (!st || !withinWorkspace(st, target)) return
  const send = (ch: string): void => {
    sendToWin(st, ch, target)
  }
  const menu = Menu.buildFromTemplate([
    ...(opts?.isFolder
      ? []
      : ([
          { label: 'Open in New Tab', click: () => send('menu:open-new-tab') },
          { type: 'separator' }
        ] as Electron.MenuItemConstructorOptions[])),
    { label: 'Rename…', click: () => send('menu:rename') },
    { type: 'separator' },
    // show what will land on the clipboard, middle-truncated to keep the menu sane
    { label: `Copy Path — ${menuPath(target)}`, click: () => clipboard.writeText(target) },
    {
      label: `Copy Relative Path — ${menuPath(relWorkspacePath(st, target))}`,
      click: () => clipboard.writeText(relWorkspacePath(st, target))
    },
    { type: 'separator' },
    { label: opts?.pinned ? 'Unpin' : 'Pin', click: () => send('menu:pin-toggle') },
    { label: 'Select (for multi-delete)', click: () => send('file:select') },
    { type: 'separator' },
    { label: 'Reveal in Finder', click: () => shell.showItemInFolder(target) },
    {
      label: 'Move to Trash',
      click: async () => {
        if (!withinWorkspace(st, target) || !windowAlive(st)) return
        const { response } = await dialog.showMessageBox(st.win, {
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
  menu.popup({ window: windowAlive(st) ? st.win : undefined })
})

ipcMain.handle('shell:openExternal', async (_e, url: string) => {
  shell.openExternal(url)
})

ipcMain.handle('update:check', async () => checkForUpdates(true))

ipcMain.handle('app:new-file', async (e) => {
  const st = stateFromEvent(e)
  if (st) await newFileFlow(st)
})

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
  broadcast('shortcuts:changed', resolved)
  return { ok: true, ...resolved }
})

ipcMain.handle('shortcuts:reset', async () => {
  shortcutOverrides = {}
  await saveShortcutOverrides()
  safeBuildMenu()
  const resolved = resolvedShortcuts()
  broadcast('shortcuts:changed', resolved)
  return resolved
})

// ---- In-file find (⌘F) ----
ipcMain.handle('find:start', (e, query: string, opts: { forward?: boolean; findNext?: boolean }) => {
  const st = stateFromEvent(e)
  if (query && windowAlive(st)) st.win.webContents.findInPage(query, opts)
})
ipcMain.handle('find:stop', (e) => {
  const st = stateFromEvent(e)
  if (windowAlive(st)) st.win.webContents.stopFindInPage('clearSelection')
})

// ---- Unsaved-changes / close guard ----
ipcMain.on('win:dirty', (e, dirty: boolean) => {
  const st = stateFromEvent(e)
  if (st) st.unsavedChanges = !!dirty
})
ipcMain.on('win:ready-to-close', (e) => {
  const st = stateFromEvent(e)
  if (!st) return
  st.forceClose = true
  if (!st.win.isDestroyed()) st.win.close()
})
// ⌘W with no tabs left closes the window itself (still runs the close guard).
ipcMain.on('win:close', (e) => {
  const st = stateFromEvent(e)
  if (st && !st.win.isDestroyed()) st.win.close()
})

// ---- Content search across all open folders ----
ipcMain.handle('fs:search', async (e, query: string) => {
  const st = stateFromEvent(e)
  if (!query || !st || st.workspace.length === 0) return []
  const q = query.toLowerCase()
  const multi = st.workspace.length > 1
  const results: {
    path: string
    relPath: string
    name: string
    matches: { lineNumber: number; text: string }[]
  }[] = []
  for (const folder of st.workspace) {
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
async function chooseSavePath(st: WinState | null, defaultName: string, ext: string): Promise<string | null> {
  if (!windowAlive(st)) return null
  const res = await dialog.showSaveDialog(st.win, {
    defaultPath: defaultName,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  return res.canceled || !res.filePath ? null : res.filePath
}

ipcMain.handle('export:html', async (e, html: string, defaultName: string) => {
  const out = await chooseSavePath(stateFromEvent(e), defaultName, 'html')
  if (!out) return false
  await fs.writeFile(out, html, 'utf8')
  shell.showItemInFolder(out)
  return true
})

ipcMain.handle(
  'export:pdf',
  async (
    e,
    html: string,
    defaultName: string,
    opts?: { header?: string; footer?: string; pageNumbers?: boolean }
  ) => {
    const out = await chooseSavePath(stateFromEvent(e), defaultName, 'pdf')
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
