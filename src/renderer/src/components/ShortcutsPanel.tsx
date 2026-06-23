import { useEffect } from 'react'

interface Shortcut {
  keys: string[]
  label: string
}
interface Group {
  title: string
  items: Shortcut[]
}

const GROUPS: Group[] = [
  {
    title: 'Files',
    items: [
      { keys: ['⌘', 'O'], label: 'Open a folder' },
      { keys: ['⌘', 'S'], label: 'Save the current file' }
    ]
  },
  {
    title: 'Navigation',
    items: [
      { keys: ['⌘', 'P'], label: 'Jump to a file' },
      { keys: ['⌘', '⇧', 'F'], label: 'Find in files' },
      { keys: ['↑', '↓'], label: 'Move through results' },
      { keys: ['↵'], label: 'Open the selected result' }
    ]
  },
  {
    title: 'View',
    items: [
      { keys: ['⌘', 'E'], label: 'Switch between Preview and Edit' },
      { keys: ['⌘', '.'], label: 'Hide or show the sidebar' },
      { keys: ['⌘', '⌥', '.'], label: 'Hide or show the contents rail' },
      { keys: ['⌘', '+'], label: 'Zoom in' },
      { keys: ['⌘', '−'], label: 'Zoom out' },
      { keys: ['⌘', '0'], label: 'Reset zoom' }
    ]
  },
  {
    title: 'General',
    items: [
      { keys: ['⌘', '/'], label: 'Show this list' },
      { keys: ['Esc'], label: 'Close any dialog' }
    ]
  }
]

export default function ShortcutsPanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="shortcuts" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="shortcuts-head">Keyboard shortcuts</div>
        <div className="shortcuts-grid">
          {GROUPS.map((g) => (
            <section className="sc-group" key={g.title}>
              <h3>{g.title}</h3>
              {g.items.map((s) => (
                <div className="sc-row" key={s.label}>
                  <span className="sc-label">{s.label}</span>
                  <span className="sc-keys">
                    {s.keys.map((k, i) => (
                      <kbd key={i}>{k}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
