import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { TEXT_EXTENSIONS } from './fs-scan'

let watcher: FSWatcher | null = null

/**
 * Watch one or more paths (folders and/or single files) for markdown changes
 * and notify the renderer. Content changes emit `fs:changed`; structural
 * changes emit `fs:tree-changed` with the affected path so the renderer can
 * re-scan just the relevant workspace folder.
 */
export function watchPaths(paths: string[], win: BrowserWindow | null): void {
  stopWatching()
  if (!win || paths.length === 0) return

  watcher = chokidar.watch(paths, {
    ignored: (path: string) =>
      /(^|[/\\])\../.test(path) ||
      /[/\\](node_modules|dist|out|build|\.git|coverage)([/\\]|$)/.test(path),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 }
  })

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

export function stopWatching(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
