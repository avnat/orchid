import { useMemo, useState } from 'react'
import type { MdNode, WorkspaceFolder } from '../types'
import { useStore, type SortMode } from '../store/useStore'
import Resizer from './Resizer'
import NameDialog from './NameDialog'

/** A node's path plus every descendant path (for selecting a whole folder). */
function collectPaths(node: MdNode): string[] {
  const out = [node.path]
  for (const c of node.children ?? []) out.push(...collectPaths(c))
  return out
}

/** Compact relative time, always shown (no live timer — recomputed on re-render). */
function relTime(mtimeMs?: number): string {
  if (!mtimeMs) return ''
  const s = (Date.now() - mtimeMs) / 1000
  if (s < 60) return 'now'
  const m = s / 60
  if (m < 60) return `${Math.round(m)}m`
  const h = m / 60
  if (h < 24) return `${Math.round(h)}h`
  const d = h / 24
  if (d < 7) return `${Math.round(d)}d`
  const w = d / 7
  if (w < 5) return `${Math.round(w)}w`
  const mo = d / 30
  if (mo < 12) return `${Math.round(mo)}mo`
  return `${Math.round(d / 365)}y`
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

/** Most-recent mtime among a node and its descendants (folders bubble up by their newest file). */
function recencyOf(n: MdNode): number {
  if (n.type === 'file') return n.mtimeMs ?? 0
  return (n.children ?? []).reduce((max, c) => Math.max(max, recencyOf(c)), 0)
}

function sortTree(nodes: MdNode[], mode: SortMode): MdNode[] {
  const withSortedChildren = nodes.map((n) =>
    n.type === 'dir' ? { ...n, children: sortTree(n.children ?? [], mode) } : n
  )
  if (mode === 'recent') {
    // newest first — files and folders interleaved, so a just-created/dropped file is on top
    return withSortedChildren.sort((a, b) => recencyOf(b) - recencyOf(a))
  }
  // name mode: folders first, then files, each alphabetical
  const dirs = withSortedChildren.filter((n) => n.type === 'dir')
  const files = withSortedChildren.filter((n) => n.type === 'file')
  const byName = (a: MdNode, b: MdNode): number => a.name.localeCompare(b.name, undefined, { numeric: true })
  dirs.sort(byName)
  files.sort(byName)
  return [...dirs, ...files]
}

function TreeNodes({
  nodes,
  depth,
  collapsed,
  toggle,
  onNew
}: {
  nodes: MdNode[]
  depth: number
  collapsed: Set<string>
  toggle: (path: string) => void
  onNew: (dir: string) => void
}): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const selectFile = useStore((s) => s.selectFile)
  const selected = useStore((s) => s.selected)
  const toggleSelected = useStore((s) => s.toggleSelected)
  const selectMany = useStore((s) => s.selectMany)
  const selectMode = useStore((s) => s.selectMode)

  return (
    <>
      {nodes.map((n) => {
        const pad = { paddingLeft: 9 + depth * 12 }
        if (n.type === 'dir') {
          const isCollapsed = collapsed.has(n.path)
          const descPaths = collectPaths(n)
          const allSel = descPaths.every((p) => selected.includes(p))
          const someSel = descPaths.some((p) => selected.includes(p))
          const toggleDir = (): void => selectMany(descPaths, !allSel)
          return (
            <li key={n.path}>
              <div
                className={`group ${isCollapsed ? 'collapsed' : ''} ${allSel ? 'selected' : ''}`}
                style={pad}
                onClick={() => (selectMode ? toggleDir() : toggle(n.path))}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    className="sel-check"
                    checked={allSel}
                    ref={(el) => {
                      if (el) el.indeterminate = someSel && !allSel
                    }}
                    onChange={toggleDir}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <span
                  className="twist"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle(n.path)
                  }}
                >
                  ▾
                </span>
                <span className="group-name">{n.name}</span>
                {!selectMode && (
                  <button
                    className="node-add"
                    title="New file or folder here"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNew(n.path)
                    }}
                  >
                    +
                  </button>
                )}
              </div>
              {!isCollapsed && (
                <ul className="tree">
                  <TreeNodes nodes={n.children ?? []} depth={depth + 1} collapsed={collapsed} toggle={toggle} onNew={onNew} />
                </ul>
              )}
            </li>
          )
        }
        const fileSel = selected.includes(n.path)
        return (
          <li key={n.path}>
            <div
              className={`node ${activePath === n.path ? 'active' : ''} ${fileSel ? 'selected' : ''}`}
              style={pad}
              title={n.name}
              onClick={(e) => {
                if (selectMode || e.metaKey || e.ctrlKey) {
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
              {selectMode && (
                <input
                  type="checkbox"
                  className="sel-check"
                  checked={fileSel}
                  onChange={() => toggleSelected(n.path)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <span className="ic" />
              <span className="name">{n.name}</span>
              <span className="ago">{relTime(n.mtimeMs)}</span>
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
  onNew: (dir: string) => void
}): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const selectFile = useStore((s) => s.selectFile)
  const shown = useMemo(() => sortTree(filterTree(folder.tree, filter), sortMode), [folder.tree, filter, sortMode])
  const isCollapsed = collapsed.has(folder.root)

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
              onNew(folder.root)
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
        </span>
      </div>
      {!isCollapsed && (
        <ul className="tree">
          {shown.length ? (
            <TreeNodes nodes={shown} depth={0} collapsed={collapsed} toggle={toggle} onNew={onNew} />
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
  const selectMode = useStore((s) => s.selectMode)
  const setSelectMode = useStore((s) => s.setSelectMode)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dialogDir, setDialogDir] = useState<string | null>(null)

  const toggle = (path: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const onNew = (dir: string): void => setDialogDir(dir)

  const handleCreate = async (name: string, mode: 'file' | 'folder'): Promise<void> => {
    if (!dialogDir) return
    try {
      if (mode === 'file') {
        const path = await window.orchid.createFile(dialogDir, name)
        await selectFile(path)
        useStore.getState().setEditMode(true) // new files open ready to type
      } else {
        await window.orchid.createFolder(dialogDir, name)
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
        <button
          className="side-refresh"
          title="New file or folder"
          aria-label="New"
          disabled={folders.length === 0}
          onClick={() => folders[0] && onNew(folders[0].root)}
        >
          +
        </button>
        <button
          className={`side-refresh ${selectMode ? 'on' : ''}`}
          title="Select multiple files to delete"
          aria-label="Select"
          onClick={() => setSelectMode(!selectMode)}
        >
          ☑
        </button>
        <button className="side-refresh" title="Refresh (⌘R)" aria-label="Refresh" onClick={() => window.orchid.refresh()}>
          ↻
        </button>
      </div>

      {selectMode && (
        <div className="select-bar">
          <span>
            {selected.length ? `${selected.length} selected` : 'Tick files & folders'}
          </span>
          <span className="select-actions">
            <button
              className="select-trash"
              disabled={selected.length === 0}
              onClick={async () => {
                // keep only top-level picks (a selected folder covers its children)
                const roots = selected.filter((p) => !selected.some((q) => q !== p && p.startsWith(q + '/')))
                if (window.confirm(`Move ${roots.length} item(s) to Trash?`)) {
                  await window.orchid.trashMany(roots)
                  clearSelected()
                }
              }}
            >
              Trash
            </button>
            <button className="select-clear" onClick={() => setSelectMode(false)}>
              Done
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

      <NameDialog open={!!dialogDir} onSubmit={handleCreate} onClose={() => setDialogDir(null)} />

      <Resizer side="right" onResize={(x) => setSidebarWidth(x)} />
    </aside>
  )
}
