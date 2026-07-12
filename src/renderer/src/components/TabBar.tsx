import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'

function baseName(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1)
}

interface TabMenu {
  x: number
  y: number
  path: string
}

/**
 * The open-files tab strip above the main pane. Click switches, × / middle-click
 * closes, drag reorders, double-click pins the preview tab (no visual marker —
 * it simply stops being reused by browsing). Right-click opens the standard
 * close menu (this / others / to the right / to the left / all). Dirty tabs show
 * a dot where the × sits (the × returns on hover). Tabs whose names collide are
 * disambiguated with their parent folder.
 */
export default function TabBar(): JSX.Element | null {
  const tabs = useStore((s) => s.tabs)
  const activePath = useStore((s) => s.activePath)
  const stash = useStore((s) => s.stash)
  const content = useStore((s) => s.content)
  const savedContent = useStore((s) => s.savedContent)
  const dragFrom = useRef<number | null>(null)
  const [menu, setMenu] = useState<TabMenu | null>(null)

  // dismiss the context menu on any outside click, scroll, or Escape
  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

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

  const menuItems = (path: string): { label: string; disabled: boolean; run: () => void }[] => {
    const i = tabs.indexOf(path)
    const store = useStore.getState()
    const right = tabs.slice(i + 1)
    const left = tabs.slice(0, i)
    const others = tabs.filter((t) => t !== path)
    return [
      { label: 'Close', disabled: false, run: () => store.closeTab(path) },
      { label: 'Close Others', disabled: others.length === 0, run: () => store.closeTabs(others) },
      { label: 'Close to the Right', disabled: right.length === 0, run: () => store.closeTabs(right) },
      { label: 'Close to the Left', disabled: left.length === 0, run: () => store.closeTabs(left) },
      { label: 'Close All', disabled: false, run: () => store.closeTabs([...tabs]) }
    ]
  }

  return (
    <>
      <div className="tabbar" role="tablist" aria-label="Open files">
        {tabs.map((p, i) => (
          <div
            key={p}
            role="tab"
            aria-selected={p === activePath}
            className={`tab ${p === activePath ? 'active' : ''} ${isDirty(p) ? 'dirty' : ''}`}
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
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ x: e.clientX, y: e.clientY, path: p })
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

      {menu && (
        <div
          className="tab-menu"
          role="menu"
          style={{ left: Math.min(menu.x, window.innerWidth - 184), top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menuItems(menu.path).map((it) => (
            <button
              key={it.label}
              className="tab-menu-item"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setMenu(null)
                it.run()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
