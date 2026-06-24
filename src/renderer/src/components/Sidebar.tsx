import { useMemo, useState } from 'react'
import type { MdNode, WorkspaceFolder } from '../types'
import { useStore, type SortMode } from '../store/useStore'
import Resizer from './Resizer'
import NameDialog from './NameDialog'

function relAge(mtimeMs?: number): { isNew: boolean; label: string | null } {
  if (!mtimeMs) return { isNew: false, label: null }
  const min = (Date.now() - mtimeMs) / 60000
  if (min < 10) return { isNew: true, label: null }
  if (min < 60) return { isNew: false, label: `${Math.round(min)}m` }
  const hr = min / 60
  if (hr < 24) return { isNew: false, label: `${Math.round(hr)}h` }
  const d = hr / 24
  if (d < 14) return { isNew: false, label: `${Math.round(d)}d` }
  return { isNew: false, label: null }
}

function filterTree(nodes: MdNode[], q: string): MdNode[] {
  if (!q) return nodes
  const lower = q.toLowerCase()
  const walk = (list: MdNode[]): MdNode[] => {
    const out: MdNode[] = []
    for (const n of list) {
      if (n.type === 'file') {
        if (n.name.toLowerCase().includes(lower)) out.push(n)
      } else {
        const kids = walk(n.children ?? [])
        if (kids.length) out.push({ ...n, children: kids })
      }
    }
    return out
  }
  return walk(nodes)
}

function sortTree(nodes: MdNode[], mode: SortMode): MdNode[] {
  const dirs = nodes.filter((n) => n.type === 'dir')
  const files = nodes.filter((n) => n.type === 'file')
  dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  if (mode === 'recent') files.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0))
  else files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return [...dirs.map((d) => ({ ...d, children: sortTree(d.children ?? [], mode) })), ...files]
}

function TreeNodes({
  nodes,
  depth,
  collapsed,
  toggle
}: {
  nodes: MdNode[]
  depth: number
  collapsed: Set<string>
  toggle: (path: string) => void
}): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const selectFile = useStore((s) => s.selectFile)
  const selected = useStore((s) => s.selected)
  const toggleSelected = useStore((s) => s.toggleSelected)

  return (
    <>
      {nodes.map((n) => {
        const pad = { paddingLeft: 9 + depth * 12 }
        if (n.type === 'dir') {
          const isCollapsed = collapsed.has(n.path)
          return (
            <li key={n.path}>
              <div className={`group ${isCollapsed ? 'collapsed' : ''}`} style={pad} onClick={() => toggle(n.path)}>
                <span className="twist">▾</span>
                {n.name}
              </div>
              {!isCollapsed && (
                <ul className="tree">
                  <TreeNodes nodes={n.children ?? []} depth={depth + 1} collapsed={collapsed} toggle={toggle} />
                </ul>
              )}
            </li>
          )
        }
        const { isNew, label } = relAge(n.mtimeMs)
        return (
          <li key={n.path}>
            <div
              className={`node ${activePath === n.path ? 'active' : ''} ${selected.includes(n.path) ? 'selected' : ''}`}
              style={pad}
              title={n.relPath}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) {
                  e.preventDefault()
                  toggleSelected(n.path)
                } else {
                  selectFile(n.path)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                window.orchid.fileMenu(n.path)
              }}
            >
              <span className="ic" />
              <span className="name">{n.name}</span>
              {isNew ? <span className="dot" /> : label ? <span className="ago">{label}</span> : null}
            </div>
          </li>
        )
      })}
    </>
  )
}

function FolderSection({
  folder,
  filter,
  sortMode,
  collapsed,
  toggle,
  onNew
}: {
  folder: WorkspaceFolder
  filter: string
  sortMode: SortMode
  collapsed: Set<string>
  toggle: (path: string) => void
  onNew: (mode: 'file' | 'folder', dir: string) => void
}): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const selectFile = useStore((s) => s.selectFile)
  const shown = useMemo(() => sortTree(filterTree(folder.tree, filter), sortMode), [folder.tree, filter, sortMode])
  const isCollapsed = collapsed.has(folder.root)
  const [menuOpen, setMenuOpen] = useState(false)

  // Single opened file: a row with its name + close.
  if (folder.isFile) {
    const f = folder.tree[0]
    return (
      <div className="folder-section">
        <div
          className={`node single ${activePath === f.path ? 'active' : ''}`}
          onClick={() => selectFile(f.path)}
          onContextMenu={(e) => {
            e.preventDefault()
            window.orchid.fileMenu(f.path)
          }}
        >
          <span className="ic" />
          <span className="name">{f.name}</span>
          <button
            className="folder-close"
            title="Close"
            onClick={(e) => {
              e.stopPropagation()
              window.orchid.closeFolder(folder.root)
            }}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="folder-section">
      <div className={`folder-head ${isCollapsed ? 'collapsed' : ''}`}>
        <span className="twist" onClick={() => toggle(folder.root)}>
          ▾
        </span>
        <span className="folder-name" onClick={() => toggle(folder.root)} title={folder.root}>
          {folder.name}
        </span>
        <span className="folder-actions">
          <button
            className="folder-add"
            title="New file or folder"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((o) => !o)
            }}
          >
            +
          </button>
          <button
            className="folder-close"
            title="Close folder"
            onClick={(e) => {
              e.stopPropagation()
              window.orchid.closeFolder(folder.root)
            }}
          >
            ✕
          </button>
          {menuOpen && (
            <>
              <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="mini-menu">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onNew('file', folder.root)
                  }}
                >
                  New file…
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onNew('folder', folder.root)
                  }}
                >
                  New folder…
                </button>
              </div>
            </>
          )}
        </span>
      </div>
      {!isCollapsed && (
        <ul className="tree">
          {shown.length ? (
            <TreeNodes nodes={shown} depth={0} collapsed={collapsed} toggle={toggle} />
          ) : (
            <li className="tree-empty">No files yet</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function Sidebar(): JSX.Element {
  const folders = useStore((s) => s.folders)
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const sortMode = useStore((s) => s.sortMode)
  const setSortMode = useStore((s) => s.setSortMode)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  const selectFile = useStore((s) => s.selectFile)
  const selected = useStore((s) => s.selected)
  const clearSelected = useStore((s) => s.clearSelected)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<{ mode: 'file' | 'folder'; dir: string } | null>(null)

  const toggle = (path: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const onNew = (mode: 'file' | 'folder', dir: string): void => setDialog({ mode, dir })

  const handleCreate = async (name: string): Promise<void> => {
    if (!dialog) return
    try {
      if (dialog.mode === 'file') {
        const path = await window.orchid.createFile(dialog.dir, name)
        await selectFile(path)
      } else {
        await window.orchid.createFolder(dialog.dir, name)
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <aside className="sidebar">
      <div className="side-toolbar">
        <input
          type="text"
          className="side-filter"
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="sort-toggle" title="Sort order">
          <button className={sortMode === 'name' ? 'on' : ''} onClick={() => setSortMode('name')}>
            Name
          </button>
          <button className={sortMode === 'recent' ? 'on' : ''} onClick={() => setSortMode('recent')}>
            Recent
          </button>
        </div>
        <button className="side-refresh" title="Refresh (⌘R)" aria-label="Refresh" onClick={() => window.orchid.refresh()}>
          ↻
        </button>
      </div>

      {selected.length > 0 && (
        <div className="select-bar">
          <span>
            {selected.length} selected <span className="select-hint">(⌘-click)</span>
          </span>
          <span className="select-actions">
            <button
              className="select-trash"
              onClick={async () => {
                if (window.confirm(`Move ${selected.length} item(s) to Trash?`)) {
                  await window.orchid.trashMany(selected)
                  clearSelected()
                }
              }}
            >
              Move to Trash
            </button>
            <button className="select-clear" onClick={clearSelected}>
              Clear
            </button>
          </span>
        </div>
      )}

      <div className="side-scroll">
        {folders.map((f) => (
          <FolderSection
            key={f.root + (f.isFile ? ':file' : '')}
            folder={f}
            filter={filter}
            sortMode={sortMode}
            collapsed={collapsed}
            toggle={toggle}
            onNew={onNew}
          />
        ))}
        <button className="add-folder" onClick={() => window.orchid.addFolder()}>
          + Add folder
        </button>
      </div>

      <NameDialog
        open={!!dialog}
        title={dialog?.mode === 'folder' ? 'New folder' : 'New file'}
        placeholder={dialog?.mode === 'folder' ? 'folder-name' : 'filename.md'}
        onSubmit={handleCreate}
        onClose={() => setDialog(null)}
      />

      <Resizer side="right" onResize={(x) => setSidebarWidth(x)} />
    </aside>
  )
}
