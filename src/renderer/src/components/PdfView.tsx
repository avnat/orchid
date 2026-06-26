import { useEffect, useRef, useState, useCallback } from 'react'
// Legacy build: transpiled for broad compatibility — the default v6 build uses
// JS features (e.g. Map.getOrInsertComputed) not yet in Electron's Chromium.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

// pdf.js renders off the main thread; the worker is bundled as a same-origin asset.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const MIN_SCALE = 0.25
const MAX_SCALE = 5

/** One lazily-rendered page: canvas + a transparent text layer for selection. */
function PdfPage({ doc, pageNumber, scale }: { doc: PDFDocumentProxy; pageNumber: number; scale: number }): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const taskRef = useRef<RenderTask | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [visible, setVisible] = useState(false)

  // Size the placeholder so scrolling is stable before the page renders.
  useEffect(() => {
    let cancelled = false
    void doc.getPage(pageNumber).then((page) => {
      const vp = page.getViewport({ scale })
      if (!cancelled) setSize({ w: vp.width, h: vp.height })
    })
    return () => {
      cancelled = true
    }
  }, [doc, pageNumber, scale])

  // Only render pages near the viewport.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setVisible(true),
      { rootMargin: '800px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void (async () => {
      const page = await doc.getPage(pageNumber)
      if (cancelled) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      const vp = page.getViewport({ scale })
      canvas.width = Math.floor(vp.width * dpr)
      canvas.height = Math.floor(vp.height * dpr)
      canvas.style.width = `${vp.width}px`
      canvas.style.height = `${vp.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      taskRef.current?.cancel()
      const task = page.render({ canvas, canvasContext: ctx, viewport: vp })
      taskRef.current = task
      try {
        await task.promise
      } catch {
        return // render cancelled (scale changed / unmounted)
      }
      const textEl = textRef.current
      if (textEl && !cancelled) {
        textEl.replaceChildren()
        textEl.style.setProperty('--scale-factor', String(scale))
        const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textEl, viewport: vp })
        await layer.render().catch(() => {})
      }
    })()
    return () => {
      cancelled = true
      taskRef.current?.cancel()
    }
  }, [visible, doc, pageNumber, scale])

  return (
    <div className="pdf-page" ref={wrapRef} style={size ? { width: size.w, height: size.h } : undefined}>
      <canvas ref={canvasRef} />
      <div className="textLayer" ref={textRef} />
    </div>
  )
}

export default function PdfView({ path }: { path: string }): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const fitRef = useRef(1)

  // (Re)load the document when the file changes.
  useEffect(() => {
    let cancelled = false
    let task: ReturnType<typeof pdfjs.getDocument> | null = null
    setDoc(null)
    setError(null)
    void (async () => {
      try {
        const bytes = await window.orchid.readBinary(path)
        task = pdfjs.getDocument({ data: bytes })
        const loaded = await task.promise
        if (cancelled) return
        // Fit page width to the container on first load.
        const page = await loaded.getPage(1)
        const w = page.getViewport({ scale: 1 }).width
        const avail = (scrollRef.current?.clientWidth ?? 800) - 48
        const fit = Math.max(MIN_SCALE, Math.min(MAX_SCALE, avail / w))
        fitRef.current = fit
        setScale(fit)
        setDoc(loaded)
      } catch {
        if (!cancelled) setError("This PDF couldn't be opened.")
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [path])

  const zoom = useCallback((factor: number) => {
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor)))
  }, [])
  const fit = useCallback(() => setScale(fitRef.current), [])

  return (
    <div className="pdf-view">
      <div className="pdf-toolbar">
        <span className="pdf-meta">{doc ? `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}` : ''}</span>
        <span className="pdf-zoom">
          <button className="tbtn icon" onClick={() => zoom(1 / 1.2)} title="Zoom out" aria-label="Zoom out">
            −
          </button>
          <button className="tbtn" onClick={fit} title="Fit width">
            {Math.round(scale * 100)}%
          </button>
          <button className="tbtn icon" onClick={() => zoom(1.2)} title="Zoom in" aria-label="Zoom in">
            +
          </button>
        </span>
      </div>
      <div className="pdf-scroll" ref={scrollRef}>
        {error ? (
          <div className="unsupported">
            <div className="unsupported-mark">⌧</div>
            <p className="unsupported-title">{error}</p>
            <button className="cta" onClick={() => window.orchid.reveal(path)}>
              Reveal in Finder
            </button>
          </div>
        ) : !doc ? (
          <div className="pdf-loading">Loading PDF…</div>
        ) : (
          <div className="pdf-pages">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={`${path}:${i + 1}`} doc={doc} pageNumber={i + 1} scale={scale} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
