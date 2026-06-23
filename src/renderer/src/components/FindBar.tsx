import { useEffect, useRef, useState } from 'react'

/**
 * In-file find (⌘F), scoped to the rendered document (not the sidebar/TOC).
 * Uses the CSS Custom Highlight API: matches are highlighted without mutating
 * the DOM, the count is exact, and next/prev scroll the active match into view.
 */
const ALL = 'orchid-find'
const ACTIVE = 'orchid-find-active'

function clearHighlights(): void {
  try {
    CSS.highlights.delete(ALL)
    CSS.highlights.delete(ACTIVE)
  } catch {
    /* Highlight API unavailable */
  }
}

function collectRanges(query: string): Range[] {
  const root = document.querySelector('.reading')
  if (!root || !query) return []
  const q = query.toLowerCase()
  const ranges: Range[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = (node.nodeValue ?? '').toLowerCase()
    let i = text.indexOf(q)
    while (i !== -1) {
      const r = document.createRange()
      r.setStart(node, i)
      r.setEnd(node, i + q.length)
      ranges.push(r)
      i = text.indexOf(q, i + q.length)
    }
    node = walker.nextNode()
  }
  return ranges
}

export default function FindBar({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState(0) // 1-based
  const rangesRef = useRef<Range[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
  }, [open])

  useEffect(() => {
    if (!open) clearHighlights()
  }, [open])

  const paint = (idx: number): void => {
    const ranges = rangesRef.current
    try {
      CSS.highlights.set(ALL, new Highlight(...ranges))
      if (idx >= 1 && ranges[idx - 1]) {
        const h = new Highlight(ranges[idx - 1])
        h.priority = 1
        CSS.highlights.set(ACTIVE, h)
        ;(ranges[idx - 1].startContainer.parentElement as HTMLElement | null)?.scrollIntoView({
          block: 'center',
          behavior: 'smooth'
        })
      } else {
        CSS.highlights.delete(ACTIVE)
      }
    } catch {
      /* ignore */
    }
  }

  // Recompute matches as the query (or document) changes.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const ranges = collectRanges(query)
      rangesRef.current = ranges
      setTotal(ranges.length)
      const a = ranges.length ? 1 : 0
      setActive(a)
      paint(a)
    }, 110)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  if (!open) return null

  const step = (forward: boolean): void => {
    const n = rangesRef.current.length
    if (!n) return
    const next = forward ? (active % n) + 1 : ((active - 2 + n) % n) + 1
    setActive(next)
    paint(next)
  }
  const close = (): void => {
    clearHighlights()
    onClose()
  }

  return (
    <div className="find-bar" role="search">
      <input
        ref={inputRef}
        className="find-input"
        placeholder="Find in file…"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            step(!e.shiftKey)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
      />
      <span className="find-count">{query ? (total ? `${active}/${total}` : 'No results') : ''}</span>
      <button className="find-btn" title="Previous (⇧⏎)" onClick={() => step(false)} disabled={!total}>
        ↑
      </button>
      <button className="find-btn" title="Next (⏎)" onClick={() => step(true)} disabled={!total}>
        ↓
      </button>
      <button className="find-btn" title="Close (Esc)" onClick={close}>
        ✕
      </button>
    </div>
  )
}
