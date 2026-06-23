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
    title: 'Files & folders',
    items: [
      { keys: ['⌘', 'O'], label: 'Open a folder' },
      { keys: ['⇧', '⌘', 'O'], label: 'Add a folder to the workspace' },
      { keys: ['⌃', '⌘', 'O'], label: 'Open a single file' },
      { keys: ['⌘', 'R'], label: 'Refresh (re-scan folders)' },
      { keys: ['⌘', 'S'], label: 'Save the current file' }
    ]
  },
  {
    title: 'Navigation',
    items: [
      { keys: ['⌘', 'P'], label: 'Jump to a file' },
      { keys: ['⌘', 'F'], label: 'Find in this file' },
      { keys: ['⇧', '⌘', 'F'], label: 'Find across all files' },
      { keys: ['↑', '↓'], label: 'Move through results' },
      { keys: ['↵'], label: 'Open / next match' }
    ]
  },
  {
    title: 'View',
    items: [
      { keys: ['⌘', 'E'], label: 'Switch between Preview and Edit' },
      { keys: ['⌘', '.'], label: 'Hide or show the sidebar' },
      { keys: ['⌥', '⌘', '.'], label: 'Hide or show the contents rail' },
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

const MOD_RANK: Record<string, number> = { '⌃': 0, '⌥': 1, '⇧': 2, '⌘': 3 }
const WORD: Record<string, string> = {
  '⌘': 'Command',
  '⇧': 'Shift',
  '⌥': 'Option',
  '⌃': 'Control',
  '↑': 'Up',
  '↓': 'Down',
  '↵': 'Return',
  '.': 'Period',
  '/': 'Slash',
  '+': 'Plus',
  '−': 'Minus'
}

/** Sort to Apple convention: ⌃ ⌥ ⇧ ⌘ then the key. */
function order(keys: string[]): string[] {
  const mods = keys.filter((k) => k in MOD_RANK).sort((a, b) => MOD_RANK[a] - MOD_RANK[b])
  const rest = keys.filter((k) => !(k in MOD_RANK))
  return [...mods, ...rest]
}

/** Plain-English spelling, e.g. "Shift + Command + O". Empty if no modifier. */
function spell(keys: string[]): string {
  if (!keys.some((k) => k in MOD_RANK)) return ''
  return order(keys)
    .map((k) => WORD[k] ?? k)
    .join(' + ')
}

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
              {g.items.map((s) => {
                const spelled = spell(s.keys)
                return (
                  <div className="sc-row" key={s.label}>
                    <span className="sc-text">
                      <span className="sc-label">{s.label}</span>
                      {spelled && <span className="sc-spelled">{spelled}</span>}
                    </span>
                    <span className="sc-keys">
                      {order(s.keys).map((k, i) => (
                        <kbd key={i}>{k}</kbd>
                      ))}
                    </span>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
        <div className="sc-tip">
          Tip: drag a folder or file onto the window, or right-click a file in the sidebar to reveal it in Finder.
        </div>
      </div>
    </div>
  )
}
