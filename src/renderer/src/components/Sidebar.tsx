import { useEffect, useMemo, useRef, useState } from 'react'
import type { MdNode, WorkspaceFolder } from '../types'
import { useStore, type SortMode } from '../store/useStore'
import Resizer from './Resizer'
import NameDialog from './NameDialog'

const DRAG_TYPE = 'application/orchid-path'

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

function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
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

/** Visible file paths in display order (respects sort, filter, and collapsed folders). */
function flattenVisible(
  folders: WorkspaceFolder[],
  filter: string,
  sortMode: SortMode,
  collapsed: Set<string>
): string[] {
  const out: string[] = []
  for (const folder of folders) {
    if (folder.isFile) {
      out.push(folder.tree[0].path)
      continue
    }
    if (collapsed.has(folder.root)) continue
    const walk = (ns: MdNode[]): void => {
      for (const n of ns) {
        if (n.type === 'file') out.push(n.path)
        else if (!collapsed.has(n.path)) walk(n.children ?? [])
      }
    }
    walk(sortTree(filterTree(folder.tree, filter), sortMode))
  }
  return out
}

/** Map every node path → node, across all open folders (for the pinned list). */
function buildNodeMap(folders: WorkspaceFolder[]): Map<string, MdNode> {
  const m = new Map<string, MdNode>()
  const walk = (ns: MdNode[]): void => {
    for (const n of ns) {
      m.set(n.path, n)
      if (n.children) walk(n.children)
    }
  }
  folders.forEach((f) => walk(f.tree))
  return m
}

/** Containing folder + each ancestor directory of a path (so we can expand them). */
function ancestorDirs(path: string, folders: WorkspaceFolder[]): string[] {
  const folder = folders.find((f) => path === f.root || path.startsWith(f.root + '/'))
  if (!folder) return []
  const rest = path.slice(folder.root.length + 1)
  const segs = rest.split('/').slice(0, -1)
  const dirs = [folder.root]
  let cur = folder.root
  for (const s of segs) {
    cur = cur + '/' + s
    dirs.push(cur)
  }
  return dirs
}

/** A short parent-folder hint for a pinned file (empty when it sits at a folder root). */
function parentHint(path: string, folders: WorkspaceFolder[]): string {
  const folder = folders.find((f) => path.startsWith(f.root + '/'))
  if (!folder) return ''
  const dir = path.slice(0, path.lastIndexOf('/'))
  return dir === folder.root ? '' : baseName(dir)
}

function PinIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  )
}

/** Inline rename field, shared by the tree and the single-file row. */
function RenameInput({ path }: { path: string }): JSX.Element {
  const commitRename = useStore((s) => s.commitRename)
  const setRenaming = useStore((s) => s.setRenaming)
  const [val, setVal] = useState(() => baseName(path))
  return (
    <input
      className="rename-input"
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => {
        const dot = val.lastIndexOf('.')
        e.target.setSelectionRange(0, dot > 0 ? dot : val.length)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void commitRename(path, val)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setRenaming(null)
        }
      }}
      onBlur={() => void commitRename(path, val)}
    />
  )
}

function TreeNodes({
  nodes,
  depth,
  collapsed,
  toggle,
  onNew,
  onFileClick,
  dropTarget,
  setDropTarget
}: {
  nodes: MdNode[]
  depth: number
  collapsed: Set<string>
  toggle: (path: string) => void
  onNew: (dir: string) => void
  onFileClick: (e: React.MouseEvent, path: string) => void
  dropTarget: string | null
  setDropTarget: (p: string | null) => void
}): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const selected = useStore((s) => s.selected)
  const toggleSelected = useStore((s) => s.toggleSelected)
  const selectMany = useStore((s) => s.selectMany)
  const selectMode = useStore((s) => s.selectMode)
  const pinned = useStore((s) => s.pinned)
  const togglePin = useStore((s) => s.togglePin)
  const renaming = useStore((s) => s.renaming)
  const setRenaming = useStore((s) => s.setRenaming)
  const commitMove = useStore((s) => s.commitMove)

  const dropProps = (
    dir: string
  ): {
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent) => void
  } => ({
    onDragOver: (e) => {
      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropTarget(dir)
      }
    },
    onDragLeave: () => setDropTarget(null),
    onDrop: (e) => {
      const src = e.dataTransfer.getData(DRAG_TYPE)
      setDropTarget(null)
      if (src) {
        e.preventDefault()
        void commitMove(src, dir)
      }
    }
  })

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
              {renaming === n.path ? (
                <div className="group" style={pad}>
                  <span className="twist">▾</span>
                  <RenameInput path={n.path} />
                </div>
              ) : (
                <div
                  className={`group ${isCollapsed ? 'collapsed' : ''} ${allSel ? 'selected' : ''} ${
                    dropTarget === n.path ? 'drop-target' : ''
                  }`}
                  style={pad}
                  onClick={() => (selectMode ? toggleDir() : toggle(n.path))}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    window.orchid.fileMenu(n.path, { pinned: pinned.includes(n.path), isFolder: true })
                  }}
                  {...dropProps(n.path)}
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
              )}
              {!isCollapsed && (
                <ul className="tree">
                  <TreeNodes
                    nodes={n.children ?? []}
                    depth={depth + 1}
                    collapsed={collapsed}
                    toggle={toggle}
                    onNew={onNew}
                    onFileClick={onFileClick}
                    dropTarget={dropTarget}
                    setDropTarget={setDropTarget}
                  />
                </ul>
              )}
            </li>
          )
        }
        const fileSel = selected.includes(n.path)
        const isPinned = pinned.includes(n.path)
        if (renaming === n.path) {
          return (
            <li key={n.path}>
              <div className="node" style={pad}>
                <span className="ic" />
                <RenameInput path={n.path} />
              </div>
            </li>
          )
        }
        return (
          <li key={n.path}>
            <div
              className={`node ${activePath === n.path ? 'active' : ''} ${fileSel ? 'selected' : ''}`}
              style={pad}
              title={n.name}
              data-path={n.path}
              draggable={!selectMode}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, n.path)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={(e) => onFileClick(e, n.path)}
              onDoubleClick={() => !selectMode && setRenaming(n.path)}
              onContextMenu={(e) => {
                e.preventDefault()
                window.orchid.fileMenu(n.path, { pinned: isPinned, isFolder: false })
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
              {!selectMode && (
                <button
                  className={`pin-btn ${isPinned ? 'pinned' : ''}`}
                  title={isPinned ? 'Unpin' : 'Pin'}
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePin(n.path)
                  }}
                >
                  <PinIcon />
                </button>
              )}
              <span className="ago">{relTime(n.mtimeMs)}</span>
            </div>
          </li>
        )
      })}
    </>
  )
}

function PinnedSection({ onNavigate }: { onNavigate: (path: string) => void }): JSX.Element | null {
  const folders = useStore((s) => s.folders)
  const pinned = useStore((s) => s.pinned)
  const activePath = useStore((s) => s.activePath)
  const togglePin = useStore((s) => s.togglePin)
  const nodeMap = useMemo(() => buildNodeMap(folders), [folders])

  const items = pinned.filter((p) => nodeMap.has(p))
  if (items.length === 0) return null

  return (
    <div className="pinned-section">
      <div className="pinned-head">
        <PinIcon />
        <span>Pinned</span>
      </div>
      <ul className="tree pinned-list">
        {items.map((path) => {
          const node = nodeMap.get(path)!
          const hint = parentHint(path, folders)
          return (
            <li key={path}>
              <div
                className={`node ${activePath === path ? 'active' : ''}`}
                title={path}
                onClick={() => onNavigate(path)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  window.orchid.fileMenu(path, { pinned: true, isFolder: node.type === 'dir' })
                }}
              >
                <span className="ic" />
                <span className="name">{node.name}</span>
                {hint && <span className="pin-hint">{hint}</span>}
                <button
                  className="pin-btn pinned"
                  title="Unpin"
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePin(path)
                  }}
                >
                  <PinIcon />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FolderSection({
  folder,
  filter,
  sortMode,
  collapsed,
  toggle,
  onNew,
  onFileClick,
  dropTarget,
  setDropTarget
}: {
  folder: WorkspaceFolder
  filter: string
  sortMode: SortMode
  collapsed: Set<string>
  toggle: (path: string) => void
  onNew: (dir: string) => void
  onFileClick: (e: React.MouseEvent, path: string) => void
  dropTarget: string | null
  setDropTarget: (p: string | null) => void
}): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const selectFile = useStore((s) => s.selectFile)
  const pinned = useStore((s) => s.pinned)
  const renaming = useStore((s) => s.renaming)
  const setRenaming = useStore((s) => s.setRenaming)
  const commitMove = useStore((s) => s.commitMove)
  const shown = useMemo(() => sortTree(filterTree(folder.tree, filter), sortMode), [folder.tree, filter, sortMode])
  const isCollapsed = collapsed.has(folder.root)

  // Single opened file: a row with its name + close.
  if (folder.isFile) {
    const f = folder.tree[0]
    return (
      <div className="folder-section">
        {renaming === f.path ? (
          <div className="node single">
            <span className="ic" />
            <RenameInput path={f.path} />
          </div>
        ) : (
          <div
            className={`node single ${activePath === f.path ? 'active' : ''}`}
            onClick={() => selectFile(f.path)}
            onDoubleClick={() => setRenaming(f.path)}
            onContextMenu={(e) => {
              e.preventDefault()
              window.orchid.fileMenu(f.path, { pinned: pinned.includes(f.path), isFolder: false })
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
        )}
      </div>
    )
  }

  return (
    <div className="folder-section">
      <div
        className={`folder-head ${isCollapsed ? 'collapsed' : ''} ${dropTarget === folder.root ? 'drop-target' : ''}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_TYPE)) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropTarget(folder.root)
          }
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => {
          const src = e.dataTransfer.getData(DRAG_TYPE)
          setDropTarget(null)
          if (src) {
            e.preventDefault()
            void commitMove(src, folder.root)
          }
        }}
      >
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
            <TreeNodes
              nodes={shown}
              depth={0}
              collapsed={collapsed}
              toggle={toggle}
              onNew={onNew}
              onFileClick={onFileClick}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
            />
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
  const activePath = useStore((s) => s.activePath)
  const selected = useStore((s) => s.selected)
  const clearSelected = useStore((s) => s.clearSelected)
  const setSelected = useStore((s) => s.setSelected)
  const toggleSelected = useStore((s) => s.toggleSelected)
  const selectMode = useStore((s) => s.selectMode)
  const setSelectMode = useStore((s) => s.setSelectMode)
  const setRenaming = useStore((s) => s.setRenaming)
  const togglePin = useStore((s) => s.togglePin)
  const toggleFocus = useStore((s) => s.toggleFocus)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dialogDir, setDialogDir] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const anchorRef = useRef<string | null>(null)
  const asideRef = useRef<HTMLElement>(null)

  // Flat list of visible files in display order — drives ↑/↓ navigation.
  const flatVisible = useMemo(
    () => flattenVisible(folders, filter, sortMode, collapsed),
    [folders, filter, sortMode, collapsed]
  )

  const scrollIntoView = (path: string): void => {
    requestAnimationFrame(() => {
      const rows = asideRef.current?.querySelectorAll<HTMLElement>('[data-path]')
      rows?.forEach((el) => {
        if (el.getAttribute('data-path') === path) el.scrollIntoView({ block: 'nearest' })
      })
    })
  }

  // Centralised row click: plain opens, ⌘/Ctrl toggles, ⇧ extends a contiguous range.
  const onFileClick = (e: React.MouseEvent, path: string): void => {
    if (e.shiftKey) {
      e.preventDefault()
      if (!selectMode) setSelectMode(true)
      const anchor = anchorRef.current ?? activePath ?? path
      anchorRef.current = anchor
      const ai = flatVisible.indexOf(anchor)
      const ci = flatVisible.indexOf(path)
      if (ai >= 0 && ci >= 0) {
        const [lo, hi] = ai < ci ? [ai, ci] : [ci, ai]
        setSelected(flatVisible.slice(lo, hi + 1))
      }
      setCursor(path)
    } else if (selectMode || e.metaKey || e.ctrlKey) {
      e.preventDefault()
      toggleSelected(path)
      anchorRef.current = path
      setCursor(path)
    } else {
      void selectFile(path)
      anchorRef.current = path
      setCursor(path)
    }
  }

  // ↑/↓ move through files (opening each); ⇧↑/⇧↓ extend a contiguous selection.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (flatVisible.length === 0) return
    e.preventDefault()
    const base = cursor ?? activePath ?? flatVisible[0]
    const idx = Math.max(0, flatVisible.indexOf(base))
    const nextIdx = Math.min(flatVisible.length - 1, Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)))
    const nextPath = flatVisible[nextIdx]
    if (e.shiftKey) {
      if (!selectMode) setSelectMode(true)
      if (!anchorRef.current) anchorRef.current = base
      const ai = flatVisible.indexOf(anchorRef.current)
      const [lo, hi] = ai < nextIdx ? [ai, nextIdx] : [nextIdx, ai]
      setSelected(flatVisible.slice(lo, hi + 1))
    } else {
      anchorRef.current = nextPath
      void selectFile(nextPath)
    }
    setCursor(nextPath)
    scrollIntoView(nextPath)
  }

  // Native context-menu actions that must run in the renderer.
  useEffect(() => {
    const offRename = window.orchid.onBeginRename((path) => setRenaming(path))
    const offPin = window.orchid.onTogglePin((path) => togglePin(path))
    return () => {
      offRename()
      offPin()
    }
  }, [setRenaming, togglePin])

  const toggle = (path: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const onNew = (dir: string): void => setDialogDir(dir)

  // From the pinned list: open the file and expand its ancestor folders so it's visible.
  const navigateTo = (path: string): void => {
    void selectFile(path)
    const dirs = ancestorDirs(path, folders)
    if (dirs.length) {
      setCollapsed((prev) => {
        const next = new Set(prev)
        dirs.forEach((d) => next.delete(d))
        return next
      })
    }
  }

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
    <aside className="sidebar" ref={asideRef} tabIndex={0} onKeyDown={onKeyDown}>
      <div className="side-toolbar">
        <input
          type="text"
          className="side-filter"
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="side-trow">
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
      </div>

      {selectMode && (
        <div className="select-bar">
          <span>{selected.length ? `${selected.length} selected` : 'Tick files & folders'}</span>
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
        {!selectMode && <PinnedSection onNavigate={navigateTo} />}
        {folders.map((f) => (
          <FolderSection
            key={f.root + (f.isFile ? ':file' : '')}
            folder={f}
            filter={filter}
            sortMode={sortMode}
            collapsed={collapsed}
            toggle={toggle}
            onNew={onNew}
            onFileClick={onFileClick}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
          />
        ))}
        <button className="add-folder" onClick={() => window.orchid.addFolder()}>
          + Add folder
        </button>
      </div>

      <NameDialog open={!!dialogDir} onSubmit={handleCreate} onClose={() => setDialogDir(null)} />

      <Resizer side="right" onResize={(x) => setSidebarWidth(x)} onCollapse={() => toggleFocus()} collapseDir="left" />
    </aside>
  )
}
