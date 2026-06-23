import { useEffect, useRef, useState } from 'react'
import type { SearchHit } from '../types'
import { useStore } from '../store/useStore'

function Snippet({ text, query }: { text: string; query: string }): JSX.Element {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0 || !query) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SearchPanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const selectFile = useStore((s) => s.selectFile)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Debounced search.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await window.orchid.search(q)
      setHits(res)
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  if (!open) return null

  const fileCount = hits.length
  const matchCount = hits.reduce((n, h) => n + h.matches.length, 0)

  const choose = (path: string): void => {
    void selectFile(path)
    onClose()
  }

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div
        className="search-panel"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Find in files"
      >
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Find in files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
        {query.trim().length >= 2 && (
          <div className="search-meta">
            {loading ? 'Searching…' : `${matchCount} match${matchCount === 1 ? '' : 'es'} in ${fileCount} file${fileCount === 1 ? '' : 's'}`}
          </div>
        )}
        <div className="search-results">
          {hits.map((h) => (
            <div className="search-file" key={h.path}>
              <div className="search-file-head" onClick={() => choose(h.path)}>
                <span className="search-file-name">{h.name}</span>
                <span className="search-file-path">{h.relPath}</span>
              </div>
              {h.matches.map((m) => (
                <div className="search-line" key={m.lineNumber} onClick={() => choose(h.path)}>
                  <span className="search-lineno">{m.lineNumber}</span>
                  <span className="search-text">
                    <Snippet text={m.text} query={query.trim()} />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
