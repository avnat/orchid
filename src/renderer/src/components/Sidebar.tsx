import { useMemo, useState } from 'react'
import type { MdNode } from '../types'
import { useStore } from '../store/useStore'

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
              <div
                className={`group ${isCollapsed ? 'collapsed' : ''}`}
                style={pad}
                onClick={() => toggle(n.path)}
              >
                <span className="twist">▾</span>
                {n.name}
              </div>
              {!isCollapsed && (
                <TreeNodes
                  nodes={n.children ?? []}
                  depth={depth + 1}
                  collapsed={collapsed}
                  toggle={toggle}
                />
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

export default function Sidebar(): JSX.Element {
  const tree = useStore((s) => s.tree)
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const shown = useMemo(() => filterTree(tree, filter), [tree, filter])

  const toggle = (path: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  return (
    <aside className="sidebar">
      <div className="filter">
        <input
          type="text"
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <ul className="tree">
        <TreeNodes nodes={shown} depth={0} collapsed={collapsed} toggle={toggle} />
      </ul>
    </aside>
  )
}
