import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { MD_EXTENSIONS } from './fs-scan'

let watcher: FSWatcher | null = null

/**
 * Watch a folder tree for markdown changes and notify the renderer.
 * - structural events (add/unlink/dir) trigger a re-scan in the renderer
 * - content changes ('change') let the renderer reload just that file
 */
export function watchFolder(root: string, win: BrowserWindow): void {
  stopWatching()

  watcher = chokidar.watch(root, {
    ignored: (path: string) =>
      /(^|[/\\])\../.test(path) || // dotfiles/dirs
      /[/\\](node_modules|dist|out|build|\.git|coverage)([/\\]|$)/.test(path),
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 }
  })

  const isMd = (p: string): boolean => MD_EXTENSIONS.some((e) => p.toLowerCase().endsWith(e))
  const send = (channel: string, payload: unknown): void => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  watcher
    .on('change', (path) => {
      if (isMd(path)) send('fs:changed', { path })
    })
    .on('add', (path) => {
      if (isMd(path)) send('fs:tree-changed', { type: 'add', path })
    })
    .on('unlink', (path) => {
      if (isMd(path)) send('fs:tree-changed', { type: 'unlink', path })
    })
    .on('addDir', () => send('fs:tree-changed', { type: 'addDir' }))
    .on('unlinkDir', () => send('fs:tree-changed', { type: 'unlinkDir' }))
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
