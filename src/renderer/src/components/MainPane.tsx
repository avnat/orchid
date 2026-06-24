import { useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { useStore } from '../store/useStore'
import MarkdownView from '../markdown/MarkdownView'
import ConflictBanner from './ConflictBanner'
import Toc from './Toc'
import { isMarkdownFile, langForFile } from '../markdown/langs'

// CodeMirror + its language packages are sizeable; load the editor lazily so it
// stays out of the startup bundle until the user actually edits or opens code.
const Editor = lazy(() => import('./Editor'))

export default function MainPane(): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const content = useStore((s) => s.content)
  const editMode = useStore((s) => s.editMode)
  const conflict = useStore((s) => s.conflict)
  const unsupported = useStore((s) => s.unsupported)
  const tocVisible = useStore((s) => s.tocVisible)
  const appearance = useStore((s) => s.appearance)
  const systemDark = useStore((s) => s.systemDark)
  const dark = appearance === 'system' ? systemDark : appearance === 'dark'

  const scrollerRef = useRef<HTMLDivElement>(null)
  const splitPreviewRef = useRef<HTMLDivElement>(null)

  // Reset scroll to top when switching files (preview mode).
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }, [activePath])

  const syncPreview = (fraction: number): void => {
    const el = splitPreviewRef.current
    if (el) el.scrollTop = fraction * (el.scrollHeight - el.clientHeight)
  }

  const isMd = !!activePath && isMarkdownFile(activePath)
  const codeLang = useMemo(() => (activePath ? langForFile(activePath) : null), [activePath])

  if (!activePath) {
    return (
      <div className="main">
        <div className="scroller">
          <div className="reading">
            <p style={{ color: 'var(--muted)' }}>Select a file from the sidebar to preview it.</p>
          </div>
        </div>
      </div>
    )
  }

  // Files we can't read as text (binary / unsupported).
  if (unsupported) {
    return (
      <div className="main">
        <div className="scroller">
          <div className="unsupported">
            <div className="unsupported-mark">⌧</div>
            <p className="unsupported-title">Can't display this file</p>
            <p className="unsupported-sub">It looks like a binary or unsupported format — Orchid shows text and Markdown.</p>
            <button className="cta" onClick={() => activePath && window.orchid.reveal(activePath)}>
              Reveal in Finder
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Non-markdown (code/text): show it in the editor with syntax highlighting —
  // read-only in Preview, editable in Edit.
  if (!isMd) {
    return (
      <div className="main">
        {conflict && <ConflictBanner />}
        <div className="codeview">
          <Suspense fallback={<div className="editor-loading" />}>
            <Editor dark={dark} language={codeLang} readOnly={!editMode} showLineNumbers />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className="main">
      {conflict && <ConflictBanner />}
      {editMode ? (
        <div className="split">
          <div className="pane editor-pane">
            <Suspense fallback={<div className="editor-loading" />}>
              <Editor dark={dark} onScrollFraction={syncPreview} />
            </Suspense>
          </div>
          <div className="pane" ref={splitPreviewRef}>
            <MarkdownView source={content} />
          </div>
        </div>
      ) : (
        <div className="preview-wrap">
          <div className="scroller" ref={scrollerRef}>
            <MarkdownView source={content} />
          </div>
          {tocVisible && <Toc scrollerRef={scrollerRef} />}
        </div>
      )}
    </div>
  )
}
