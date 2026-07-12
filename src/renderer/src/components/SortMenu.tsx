import { useEffect, useRef, useState } from 'react'
import { useStore, type SortMode } from '../store/useStore'

const LABELS: Record<SortMode, string> = {
  recent: 'Recently edited',
  name: 'Name (A–Z)'
}
const ORDER: SortMode[] = ['recent', 'name']

/** Compact sort picker: a labelled trigger that opens a small checkmarked menu.
 *  `up` opens the menu above the trigger (for the sidebar footer). */
export default function SortMenu({ up = false }: { up?: boolean }): JSX.Element {
  const sortMode = useStore((s) => s.sortMode)
  const setSortMode = useStore((s) => s.setSortMode)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="sort-menu" ref={ref}>
      <button
        className="sort-trigger"
        onClick={() => setOpen((o) => !o)}
        title="Sort files"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="sort-ic" aria-hidden="true">
          ⇅
        </span>
        <span className="sort-label">{LABELS[sortMode]}</span>
        <span className="sort-caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className={`sort-pop ${up ? 'up' : ''}`} role="menu">
          {ORDER.map((m) => (
            <button
              key={m}
              className={`sort-opt ${sortMode === m ? 'on' : ''}`}
              role="menuitemradio"
              aria-checked={sortMode === m}
              onClick={() => {
                setSortMode(m)
                setOpen(false)
              }}
            >
              <span className="sort-check" aria-hidden="true">
                {sortMode === m ? '✓' : ''}
              </span>
              {LABELS[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
