import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { TEXT_EXTENSIONS } from './fs-scan'

// One watcher per window — each window has its own workspace.
const watchers = new Map<number, FSWatcher>()

/**
 * Watch one or more paths (folders and/or single files) for markdown changes
 * and notify the window's renderer. Content changes emit `fs:changed`;
 * structural changes emit `fs:tree-changed` with the affected path so the
 * renderer can re-scan just the relevant workspace folder.
 */
export function watchPaths(paths: string[], win: BrowserWindow | null): void {
  if (win) stopWatching(win)
  if (!win || paths.length === 0) return

  const watcher = chokidar.watch(paths, {
    ignored: (path: string) =>
      /(^|[/\\])\../.test(path) ||
      /[/\\](node_modules|dist|out|build|\.git|coverage)([/\\]|$)/.test(path),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 }
  })
  watchers.set(win.id, watcher)

  const isMd = (p: string): boolean => TEXT_EXTENSIONS.some((e) => p.toLowerCase().endsWith(e))
  const send = (channel: string, payload: unknown): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  watcher
    .on('change', (path) => {
      if (isMd(path)) send('fs:changed', { path })
    })
    .on('add', (path) => {
      if (isMd(path)) send('fs:tree-changed', { path })
    })
    .on('unlink', (path) => {
      if (isMd(path)) send('fs:tree-changed', { path })
    })
    .on('addDir', (path) => send('fs:tree-changed', { path }))
    .on('unlinkDir', (path) => send('fs:tree-changed', { path }))
}

/** Stop the watcher for one window, or all of them when no window is given. */
export function stopWatching(win?: BrowserWindow): void {
  if (win) {
    watchers.get(win.id)?.close()
    watchers.delete(win.id)
    return
  }
  for (const w of watchers.values()) w.close()
  watchers.clear()
}
