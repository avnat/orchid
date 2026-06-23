import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { useStore } from '../store/useStore'

let initialized = false
let counter = 0

export default function Mermaid({ code }: { code: string }): JSX.Element {
  const appearance = useStore((s) => s.appearance)
  const systemDark = useStore((s) => s.systemDark)
  const dark = appearance === 'system' ? systemDark : appearance === 'dark'
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mmd-${counter++}`)

  useEffect(() => {
    let cancelled = false
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'neutral',
      fontFamily: 'inherit'
    })
    initialized = true
    mermaid
      .render(idRef.current, code.trim())
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [code, dark])

  if (error) {
    return <div className="mermaid-error">Diagram error: {error}</div>
  }
  return <div className="mermaid" ref={ref} />
}

export { initialized }
