import { useEffect, useMemo, useRef, useState } from 'react'
import type { MdNode } from '../types'
import { useStore } from '../store/useStore'

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

/** subsequence fuzzy match; returns a score (lower is better) or -1 */
function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  let qi = 0
  let score = 0
  let lastIdx = -1
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) {
      score += i - lastIdx // reward contiguous matches
      lastIdx = i
      qi++
    }
  }
  return qi === query.length ? score : -1
}

export default function CommandPalette({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const folders = useStore((s) => s.folders)
  const selectFile = useStore((s) => s.selectFile)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const files = useMemo(() => folders.flatMap((f) => flatten(f.tree)), [folders])

  const results = useMemo(() => {
    const q = query.toLowerCase()
    return files
      .map((f) => ({ f, score: fuzzyScore(q, f.relPath.toLowerCase()) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((r) => r.f)
  }, [files, query])

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
    if (item) void selectFile(item.path)
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
          placeholder="Jump to a file…"
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
