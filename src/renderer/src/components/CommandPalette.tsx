import { useEffect, useMemo, useRef, useState } from 'react'
import type { MdNode } from '../types'
import { useStore } from '../store/useStore'
import { pathMatchScore } from '../lib/pathMatch'

interface FileItem {
  name: string
  path: string
  relPath: string
}

function flatten(nodes: MdNode[], out: FileItem[] = []): FileItem[] {
  for (const n of nodes) {
    if (n.type === 'file') out.push({ name: n.name, path: n.path, relPath: n.relPath })
    else if (n.children) flatten(n.children, out)
  }
  return out
}

export default function CommandPalette({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const folders = useStore((s) => s.folders)
  const tabs = useStore((s) => s.tabs)
  const selectFile = useStore((s) => s.selectFile)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const files = useMemo(() => folders.flatMap((f) => flatten(f.tree)), [folders])

  const results = useMemo(() => {
    return files
      .map((f) => {
        let score = pathMatchScore(query, f.name, f.relPath)
        // files already open in a tab float above equal matches
        if (score >= 0 && tabs.includes(f.path)) score -= 0.5
        return { f, score }
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.f.relPath.length - b.f.relPath.length)
      .slice(0, 40)
      .map((r) => r.f)
  }, [files, tabs, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => setIndex(0), [query])

  useEffect(() => {
    listRef.current?.querySelector('.cmd-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  const choose = (item?: FileItem): void => {
    // a deliberate jump always gets its own tab (never hijacks the preview tab)
    if (item) void selectFile(item.path, { newTab: true })
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[index])
    }
  }

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="cmd-palette" onMouseDown={(e) => e.stopPropagation()} role="dialog">
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Jump to a file — name or path, e.g. notes/prd…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="cmd-list" ref={listRef}>
          {results.length === 0 ? (
            <li className="cmd-empty">No matching files</li>
          ) : (
            results.map((f, i) => (
              <li
                key={f.path}
                className={`cmd-item ${i === index ? 'active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(f)}
              >
                <span className="cmd-name">{f.name}</span>
                <span className="cmd-path">{f.relPath}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
