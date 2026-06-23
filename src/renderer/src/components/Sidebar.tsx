import { useMemo, useState } from 'react'
import type { MdNode, WorkspaceFolder } from '../types'
import { useStore, type SortMode } from '../store/useStore'
import Resizer from './Resizer'

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
              className={`node ${activePath === n.path ? 'active' : ''}`}
              style={pad}
              title={n.relPath}
              onClick={() => selectFile(n.path)}
              onContextMenu={(e) => {
                e.preventDefault()
                window.orchid.reveal(n.path)
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
  toggle
}: {
  folder: WorkspaceFolder
  filter: string
  sortMode: SortMode
  collapsed: Set<string>
  toggle: (path: string) => void
}): JSX.Element {
  const multi = useStore((s) => s.folders.length > 1)
  const shown = useMemo(() => sortTree(filterTree(folder.tree, filter), sortMode), [folder.tree, filter, sortMode])
  const isCollapsed = collapsed.has(folder.root)

  // Single opened file: render just the file, no folder header.
  if (folder.isFile) {
    return (
      <ul className="tree">
        <TreeNodes nodes={shown} depth={0} collapsed={collapsed} toggle={toggle} />
      </ul>
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
        {multi && (
          <button
            className="folder-close"
            title="Remove from workspace"
            onClick={() => window.orchid.closeFolder(folder.root)}
          >
            ✕
          </button>
        )}
      </div>
      {!isCollapsed && (
        <ul className="tree">
          {shown.length ? (
            <TreeNodes nodes={shown} depth={0} collapsed={collapsed} toggle={toggle} />
          ) : (
            <li className="tree-empty">No markdown files</li>
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (path: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

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

      <div className="side-scroll">
        {folders.map((f) => (
          <FolderSection
            key={f.root + (f.isFile ? ':file' : '')}
            folder={f}
            filter={filter}
            sortMode={sortMode}
            collapsed={collapsed}
            toggle={toggle}
          />
        ))}
        <button className="add-folder" onClick={() => window.orchid.addFolder()}>
          + Add folder
        </button>
      </div>
      <Resizer side="right" onResize={(x) => setSidebarWidth(x)} />
    </aside>
  )
}
