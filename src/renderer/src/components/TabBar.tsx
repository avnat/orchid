import { useRef } from 'react'
import { useStore } from '../store/useStore'

function baseName(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1)
}

/**
 * The open-files tab strip above the main pane. Click switches, × / middle-click
 * closes, drag reorders, double-click pins the preview tab (italic title).
 * Dirty tabs show a dot where the × sits (the × returns on hover). Tabs whose
 * names collide are disambiguated with their parent folder.
 */
export default function TabBar(): JSX.Element | null {
  const tabs = useStore((s) => s.tabs)
  const activePath = useStore((s) => s.activePath)
  const previewPath = useStore((s) => s.previewPath)
  const stash = useStore((s) => s.stash)
  const content = useStore((s) => s.content)
  const savedContent = useStore((s) => s.savedContent)
  const dragFrom = useRef<number | null>(null)

  if (tabs.length === 0) return null

  const names = tabs.map(baseName)
  const label = (p: string, i: number): string => {
    const n = names[i]
    if (names.filter((x) => x === n).length > 1) {
      const parts = p.split('/')
      const parent = parts[parts.length - 2]
      if (parent) return `${parent}/${n}`
    }
    return n
  }
  const isDirty = (p: string): boolean =>
    p === activePath
      ? content !== savedContent
      : !!stash[p] && stash[p].content !== stash[p].savedContent

  return (
    <div className="tabbar" role="tablist" aria-label="Open files">
      {tabs.map((p, i) => (
        <div
          key={p}
          role="tab"
          aria-selected={p === activePath}
          className={`tab ${p === activePath ? 'active' : ''} ${isDirty(p) ? 'dirty' : ''} ${p === previewPath ? 'preview' : ''}`}
          title={p}
          draggable
          onDragStart={() => {
            dragFrom.current = i
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragFrom.current !== null) useStore.getState().moveTab(dragFrom.current, i)
            dragFrom.current = null
          }}
          onClick={() => void useStore.getState().selectFile(p)}
          onDoubleClick={() => useStore.getState().pinTab(p)}
          onAuxClick={(e) => {
            if (e.button === 1) useStore.getState().closeTab(p)
          }}
        >
          <span className="tab-label">{label(p, i)}</span>
          <span className="tab-dot" aria-hidden="true" />
          <button
            className="tab-close"
            title="Close tab (⌘W)"
            aria-label={`Close ${label(p, i)}`}
            onClick={(e) => {
              e.stopPropagation()
              useStore.getState().closeTab(p)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
