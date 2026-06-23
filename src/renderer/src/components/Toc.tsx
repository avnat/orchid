import { useEffect, useState, type RefObject } from 'react'
import { useStore } from '../store/useStore'

interface Heading {
  id: string
  text: string
  level: number
}

export default function Toc({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement> }): JSX.Element | null {
  const content = useStore((s) => s.content)
  const activePath = useStore((s) => s.activePath)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Collect headings from the rendered DOM after each render.
  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const raf = requestAnimationFrame(() => {
      const els = Array.from(
        root.querySelectorAll<HTMLElement>('.reading h1[id], .reading h2[id], .reading h3[id]')
      )
      setHeadings(
        els.map((el) => ({
          id: el.id,
          text: el.textContent ?? '',
          level: Number(el.tagName[1])
        }))
      )
    })
    return () => cancelAnimationFrame(raf)
  }, [content, activePath, scrollerRef])

  // Scroll-spy: highlight the heading nearest the top of the viewport.
  useEffect(() => {
    const root = scrollerRef.current
    if (!root || headings.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId((visible[0].target as HTMLElement).id)
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 }
    )
    headings.forEach((h) => {
      const el = root.querySelector(`#${CSS.escape(h.id)}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings, scrollerRef])

  if (headings.length < 2) return null

  const go = (id: string): void => {
    scrollerRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="toc" aria-label="Table of contents">
      <div className="toc-label">On this page</div>
      <ul>
        {headings.map((h) => (
          <li
            key={h.id}
            className={`toc-item lvl-${h.level} ${activeId === h.id ? 'active' : ''}`}
            onClick={() => go(h.id)}
          >
            {h.text}
          </li>
        ))}
      </ul>
    </nav>
  )
}
