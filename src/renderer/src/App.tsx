import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import MainPane from './components/MainPane'
import EmptyState from './components/EmptyState'
import ThemePicker from './components/ThemePicker'
import CommandPalette from './components/CommandPalette'
import SearchPanel from './components/SearchPanel'
import ShortcutsPanel from './components/ShortcutsPanel'
import FindBar from './components/FindBar'
import { buildStandaloneHtml } from './markdown/exportDoc'
import { accentByKey } from './themes'

function baseName(p: string): string {
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export default function App(): JSX.Element {
  const folders = useStore((s) => s.folders)
  const activePath = useStore((s) => s.activePath)
  const editMode = useStore((s) => s.editMode)
  const focusMode = useStore((s) => s.focusMode)
  const appearance = useStore((s) => s.appearance)
  const accentKey = useStore((s) => s.accentKey)
  const systemDark = useStore((s) => s.systemDark)
  const tocVisible = useStore((s) => s.tocVisible)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const sidebarTextSize = useStore((s) => s.sidebarTextSize)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)

  // Track the OS appearance.
  useEffect(() => {
    window.orchid.getTheme().then((t) => useStore.getState().setSystemDark(t.shouldUseDarkColors))
    return window.orchid.onThemeChanged((t) =>
      useStore.getState().setSystemDark(t.shouldUseDarkColors)
    )
  }, [])

  // Resolve appearance + accent into the live CSS variables.
  const dark = appearance === 'system' ? systemDark : appearance === 'dark'
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = dark ? 'dusk' : 'bloom'
    const accent = accentByKey(accentKey)
    root.style.setProperty('--accent', dark ? accent.dark : accent.light)
  }, [dark, accentKey])

  // Configurable sidebar text size (S / M / L).
  useEffect(() => {
    const px = sidebarTextSize === 'sm' ? '13px' : sidebarTextSize === 'lg' ? '16.5px' : '14.5px'
    document.documentElement.style.setProperty('--side-font', px)
  }, [sidebarTextSize])

  // IPC wiring.
  useEffect(() => {
    const s = useStore.getState
    const offs = [
      window.orchid.onWorkspaceChanged(({ folders, select }) => {
        s().setWorkspace(folders, select)
        if (select) void s().selectFile(select)
      }),
      window.orchid.onFileChanged(({ path }) => s().onExternalChange(path)),
      window.orchid.onTreeChanged(({ path }) => {
        if (path) void window.orchid.rescan(path)
      }),
      window.orchid.onToggleEdit(() => {
        if (s().activePath) s().toggleEdit()
      }),
      window.orchid.onSave(() => void s().save()),
      window.orchid.onFocusMode(() => s().toggleFocus()),
      window.orchid.onToggleToc(() => s().toggleToc()),
      window.orchid.onSearch(() => {
        if (s().folders.length) setSearchOpen(true)
      }),
      window.orchid.onExportHtml(() => void doExport('html')),
      window.orchid.onExportPdf(() => void doExport('pdf')),
      window.orchid.onShortcuts(() => setShortcutsOpen(true)),
      // Save-and-close: main asked us to persist before quitting.
      window.orchid.onSaveAndClose(async () => {
        await useStore.getState().save()
        window.orchid.confirmClose()
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  // Keep the main process informed of unsaved-changes state (for the quit prompt).
  useEffect(() => {
    let last = false
    return useStore.subscribe((s) => {
      const d = s.content !== s.savedContent
      if (d !== last) {
        last = d
        window.orchid.setDirty(d)
      }
    })
  }, [])

  // Close the find bar when the file or mode changes (matches go stale).
  useEffect(() => {
    setFindOpen(false)
    void window.orchid.stopFind()
  }, [activePath, editMode])

  async function doExport(kind: 'html' | 'pdf'): Promise<void> {
    const s = useStore.getState()
    if (!s.activePath) return
    const base = baseName(s.activePath).replace(/\.(md|markdown|mdx)$/i, '')
    const html = await buildStandaloneHtml(base)
    if (!html) return
    if (kind === 'html') await window.orchid.exportHtml(html, `${base}.html`)
    else await window.orchid.exportPdf(html, `${base}.pdf`)
  }

  // Save on ⌘S even when menu accelerator is intercepted by a focused field.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void useStore.getState().save()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        if (useStore.getState().folders.length) setPaletteOpen(true)
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        if (useStore.getState().folders.length) setSearchOpen(true)
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        // ⌘F = find in the current file (preview only; CodeMirror owns ⌘F in edit mode)
        const st = useStore.getState()
        if (st.activePath && !st.editMode) {
          e.preventDefault()
          setFindOpen(true)
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Drag-and-drop a folder onto the window.
  useEffect(() => {
    const prevent = (e: DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
    }
    const onDrop = (e: DragEvent): void => {
      prevent(e)
      const dropped = Array.from(e.dataTransfer?.files ?? []) as (File & { path?: string })[]
      for (const f of dropped) if (f.path) void window.orchid.openPath(f.path)
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const hasWorkspace = folders.length > 0

  const activeFolder = activePath
    ? folders.find((f) => activePath === f.root || activePath.startsWith(f.root + '/'))
    : undefined
  const title = activePath ? (
    activeFolder?.isFile ? (
      <b>{baseName(activePath)}</b>
    ) : (
      <>
        <b>{activeFolder?.name ?? ''}</b>
        {activeFolder ? ` — ${activePath.slice(activeFolder.root.length + 1)}` : baseName(activePath)}
      </>
    )
  ) : hasWorkspace ? (
    <b>{folders.length === 1 ? folders[0].name : `${folders.length} folders`}</b>
  ) : (
    'Orchid'
  )

  return (
    <div className="app">
      <div className="titlebar">
        <div className="left">
          <button className="tbtn" onClick={() => window.orchid.open()} title="Open a folder or file (⌘O)">
            Open
          </button>
        </div>
        <div className="title">{title}</div>
        <div className="actions">
          <div className="mode-toggle" role="group" aria-label="View mode">
            <button
              className={!editMode ? 'on' : ''}
              disabled={!activePath}
              onClick={() => editMode && useStore.getState().toggleEdit()}
            >
              Preview
            </button>
            <button
              className={editMode ? 'on' : ''}
              disabled={!activePath}
              onClick={() => !editMode && useStore.getState().toggleEdit()}
            >
              Edit
            </button>
          </div>
          <button
            className={`tbtn icon ${focusMode ? 'on' : ''}`}
            disabled={!activePath}
            onClick={() => useStore.getState().toggleFocus()}
            title={focusMode ? 'Show sidebar (⌘.)' : 'Hide sidebar for focused reading (⌘.)'}
            aria-label="Toggle sidebar"
          >
            ◧
          </button>
          <button
            className={`tbtn icon ${!tocVisible ? 'on' : ''}`}
            disabled={!activePath || editMode}
            onClick={() => useStore.getState().toggleToc()}
            title={tocVisible ? 'Hide contents (⌘⌥.)' : 'Show contents (⌘⌥.)'}
            aria-label="Toggle table of contents"
          >
            ◨
          </button>
          <ThemePicker />
          <button
            className="tbtn icon"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (⌘/)"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>

      {!hasWorkspace ? (
        <EmptyState />
      ) : (
        <div
          className={`body ${focusMode ? 'focus' : ''}`}
          style={{ gridTemplateColumns: focusMode ? '1fr' : `${sidebarWidth}px 1fr` }}
        >
          <Sidebar />
          <MainPane />
        </div>
      )}

      <FindBar open={findOpen} onClose={() => setFindOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
