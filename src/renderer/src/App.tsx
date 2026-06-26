import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import MainPane from './components/MainPane'
import EmptyState from './components/EmptyState'
import ThemePicker from './components/ThemePicker'
import CommandPalette from './components/CommandPalette'
import SearchPanel from './components/SearchPanel'
import ShortcutsPanel from './components/ShortcutsPanel'
import SettingsPanel from './components/SettingsPanel'
import DeveloperPanel from './components/DeveloperPanel'
import UpdateDialog, { type UpdateInfo } from './components/UpdateDialog'
import PdfDialog, { type PdfOptions } from './components/PdfDialog'
import FindBar from './components/FindBar'
import { buildStandaloneHtml } from './markdown/exportDoc'
import { isMarkdownFile, isPdfFile } from './markdown/langs'
import { accentByKey } from './themes'
import { matchAccelerator } from './lib/accelerator'

function baseName(p: string): string {
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export default function App(): JSX.Element {
  const folders = useStore((s) => s.folders)
  const activePath = useStore((s) => s.activePath)
  const editMode = useStore((s) => s.editMode)
  const focusMode = useStore((s) => s.focusMode)
  const tocVisible = useStore((s) => s.tocVisible)
  const appearance = useStore((s) => s.appearance)
  const accentKey = useStore((s) => s.accentKey)
  const customAccent = useStore((s) => s.customAccent)
  const systemDark = useStore((s) => s.systemDark)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const sidebarTextSize = useStore((s) => s.sidebarTextSize)
  const tocTextSize = useStore((s) => s.tocTextSize)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [developerOpen, setDeveloperOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  // Resolved accelerator map, so the fallback key handler honours custom shortcuts.
  const [shortcutMap, setShortcutMap] = useState<Record<string, string>>({})

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
    if (accentKey === 'custom') {
      root.style.setProperty('--accent', customAccent)
    } else {
      const accent = accentByKey(accentKey)
      root.style.setProperty('--accent', dark ? accent.dark : accent.light)
    }
  }, [dark, accentKey, customAccent])

  // Configurable sidebar text size (S / M / L).
  useEffect(() => {
    const px = sidebarTextSize === 'sm' ? '13px' : sidebarTextSize === 'lg' ? '16.5px' : '14.5px'
    document.documentElement.style.setProperty('--side-font', px)
  }, [sidebarTextSize])

  // Configurable "On this page" index text size (S / M / L).
  useEffect(() => {
    const px = tocTextSize === 'sm' ? '11.5px' : tocTextSize === 'lg' ? '14.5px' : '12.5px'
    document.documentElement.style.setProperty('--toc-font', px)
  }, [tocTextSize])

  // Load the resolved shortcut map and keep it in sync with remaps.
  useEffect(() => {
    void window.orchid.getShortcuts().then((s) => setShortcutMap(s.map))
    return window.orchid.onShortcutsChanged((s) => setShortcutMap(s.map))
  }, [])

  // Update notifications: always show on a manual check; on the quiet launch
  // check, skip versions the user already dismissed.
  useEffect(() => {
    return window.orchid.onUpdateAvailable((info) => {
      if (info.manual || localStorage.getItem('orchid.updateDismissed') !== info.version) {
        setUpdate(info)
      }
    })
  }, [])

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
        const ap = s().activePath
        if (ap && !isPdfFile(ap)) s().toggleEdit()
      }),
      window.orchid.onSave(() => void s().save()),
      window.orchid.onFocusMode(() => s().toggleFullscreen()),
      window.orchid.onToggleToc(() => s().toggleToc()),
      window.orchid.onSearch(() => {
        if (s().folders.length) setSearchOpen(true)
      }),
      window.orchid.onExportHtml(() => void doExport('html')),
      window.orchid.onExportPdf(() => setPdfOpen(true)),
      // ⌘W — close the open file (a single-file workspace closes entirely → launch).
      window.orchid.onCloseFile(() => {
        const st = s()
        const ap = st.activePath
        if (!ap) return
        if (st.content !== st.savedContent && !window.confirm('Discard unsaved changes and close this file?')) return
        const folder = st.folders.find((f) => ap === f.root || ap.startsWith(f.root + '/'))
        if (folder?.isFile) void window.orchid.closeFolder(folder.root)
        else useStore.setState({ activePath: null, content: '', savedContent: '', editMode: false, conflict: false })
      }),
      window.orchid.onShortcuts(() => setShortcutsOpen(true)),
      window.orchid.onSettings(() => setSettingsOpen(true)),
      window.orchid.onCommandPalette(() => {
        if (s().folders.length) setPaletteOpen(true)
      }),
      window.orchid.onDeveloper(() => setDeveloperOpen(true)),
      window.orchid.onSelectFile((path) => {
        const st = useStore.getState()
        st.setSelectMode(true)
        if (!st.selected.includes(path)) st.toggleSelected(path)
      }),
      // A brand-new file (created with no folder open) opens ready to type.
      window.orchid.onNewFileCreated(() => s().setEditMode(true)),
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

  async function doExportPdf(opts: PdfOptions): Promise<void> {
    const s = useStore.getState()
    if (!s.activePath) return
    const base = baseName(s.activePath).replace(/\.(md|markdown|mdx)$/i, '')
    const html = await buildStandaloneHtml(base)
    if (!html) return
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    const sub = (t: string): string => t.replace(/\{title\}/g, base).replace(/\{date\}/g, date)
    await window.orchid.exportPdf(html, `${base}.pdf`, {
      header: sub(opts.header),
      footer: sub(opts.footer),
      pageNumbers: opts.pageNumbers
    })
  }

  // Fallback key handling for when a focused field swallows the menu accelerator.
  // Honours the user's custom shortcut map; ⌘F (find-in-preview) stays fixed so
  // code files keep CodeMirror's own ⌘F.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (shortcutMap.save && matchAccelerator(shortcutMap.save, e)) {
        e.preventDefault()
        void useStore.getState().save()
      } else if (shortcutMap.commandPalette && matchAccelerator(shortcutMap.commandPalette, e)) {
        e.preventDefault()
        if (useStore.getState().folders.length) setPaletteOpen(true)
      } else if (shortcutMap.searchAll && matchAccelerator(shortcutMap.searchAll, e)) {
        e.preventDefault()
        if (useStore.getState().folders.length) setSearchOpen(true)
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        // ⌘F = find in a rendered markdown preview or a PDF (code files keep
        // CodeMirror's own ⌘F).
        const st = useStore.getState()
        const ap = st.activePath
        if (ap && (isPdfFile(ap) || (isMarkdownFile(ap) && !st.editMode))) {
          e.preventDefault()
          setFindOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcutMap])

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

  const showSidebar = !focusMode
  const anyPanelShown = !focusMode || tocVisible
  const isPdf = !!activePath && isPdfFile(activePath)

  return (
    <div className="app">
      <div className={`titlebar ${activePath && editMode ? 'editing' : ''}`}>
        <div className="left">
          <button className="tbtn" onClick={() => window.orchid.open()} title="Open a folder or file (⌘O)">
            Open
          </button>
        </div>
        <div className="title">
          <span className="title-text">{title}</span>
          {activePath && (
            <span className={`mode-badge ${editMode ? 'is-editing' : 'is-reading'}`} aria-live="polite">
              <span className="mode-dot" aria-hidden="true" />
              {editMode ? 'Editing' : 'Reading'}
            </span>
          )}
        </div>
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
              disabled={!activePath || isPdf}
              onClick={() => !editMode && useStore.getState().toggleEdit()}
            >
              Edit
            </button>
          </div>
          <button
            className={`tbtn icon ${anyPanelShown ? '' : 'on'}`}
            disabled={!activePath}
            onClick={() => useStore.getState().toggleFullscreen()}
            title={anyPanelShown ? 'Focus mode — hide panels (⌘.)' : 'Exit focus mode (⌘.)'}
            aria-label="Toggle focus mode"
          >
            {anyPanelShown ? '⤢' : '⤡'}
          </button>
          <ThemePicker />
          <button
            className="tbtn icon"
            onClick={() => setSettingsOpen(true)}
            title="Settings (⌘,)"
            aria-label="Settings"
          >
            ⚙
          </button>
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
          className={`body ${showSidebar ? '' : 'focus'}`}
          style={{ gridTemplateColumns: showSidebar ? `${sidebarWidth}px 1fr` : '1fr' }}
        >
          {showSidebar && <Sidebar />}
          <MainPane />
          {focusMode && (
            <div className="reveal-divider left">
              <button
                className="divider-btn"
                title="Show sidebar"
                aria-label="Show sidebar"
                onClick={() => useStore.getState().toggleFocus()}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      <FindBar open={findOpen} onClose={() => setFindOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DeveloperPanel open={developerOpen} onClose={() => setDeveloperOpen(false)} />
      <PdfDialog
        open={pdfOpen}
        onConfirm={(o) => {
          setPdfOpen(false)
          void doExportPdf(o)
        }}
        onClose={() => setPdfOpen(false)}
      />
      <UpdateDialog
        info={update}
        onDownload={() => {
          if (update) window.orchid.openExternal(update.download)
          setUpdate(null)
        }}
        onClose={() => {
          if (update && !update.manual) localStorage.setItem('orchid.updateDismissed', update.version)
          setUpdate(null)
        }}
      />
    </div>
  )
}
