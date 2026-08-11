import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Anchor {
  text: string
  left: number
  top: number
  bottom: number
}

/**
 * A single fast tooltip for the whole app. Any element with a `data-tip`
 * attribute shows its text on hover after a short delay — far quicker than the
 * OS's ~1.5s native `title` tooltip, and it renders above overflow-clipped
 * panels (the sidebar) where a CSS-only tooltip would be cut off.
 */
export default function Tooltip(): JSX.Element | null {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const DELAY = 320 // fast, but not so eager it flickers while sweeping the cursor

    const clear = (): void => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
    const hide = (): void => {
      clear()
      targetRef.current = null
      setAnchor(null)
      setPos(null)
    }

    const show = (el: HTMLElement): void => {
      const text = el.getAttribute('data-tip')?.trim()
      if (!text) return
      const r = el.getBoundingClientRect()
      setPos(null) // re-measure before showing at the new spot
      setAnchor({ text, left: r.left, top: r.top, bottom: r.bottom })
    }

    const onOver = (e: MouseEvent): void => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]') ?? null
      if (el === targetRef.current) return
      clear()
      targetRef.current = el
      if (!el) {
        setAnchor(null)
        setPos(null)
        return
      }
      timerRef.current = window.setTimeout(() => show(el), DELAY)
    }

    // Any of these should dismiss immediately — a lingering tip over a changed
    // layout is worse than none.
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mousedown', hide, true)
    document.addEventListener('wheel', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      clear()
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mousedown', hide, true)
      document.removeEventListener('wheel', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // Measure the rendered tip and clamp it fully inside the window — anchored to
  // the element's left edge, flipped above if it would fall off the bottom.
  useLayoutEffect(() => {
    if (!anchor || !tipRef.current) return
    const M = 8
    const w = tipRef.current.offsetWidth
    const h = tipRef.current.offsetHeight
    const left = Math.max(M, Math.min(anchor.left, window.innerWidth - w - M))
    const below = anchor.bottom + 6
    const top = below + h <= window.innerHeight - M ? below : Math.max(M, anchor.top - h - 6)
    setPos({ left, top })
  }, [anchor])

  if (!anchor) return null
  return (
    <div
      ref={tipRef}
      className="app-tooltip"
      role="tooltip"
      style={{
        // render off-screen (invisible) for the first measuring pass
        left: pos ? pos.left : -9999,
        top: pos ? pos.top : 0,
        opacity: pos ? 1 : 0
      }}
    >
      {anchor.text}
    </div>
  )
}
