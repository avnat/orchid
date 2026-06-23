import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import MarkdownView from '../markdown/MarkdownView'
import ConflictBanner from './ConflictBanner'
import Toc from './Toc'
import Editor from './Editor'

export default function MainPane(): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const content = useStore((s) => s.content)
  const editMode = useStore((s) => s.editMode)
  const conflict = useStore((s) => s.conflict)
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

  return (
    <div className="main">
      {conflict && <ConflictBanner />}
      {editMode ? (
        <div className="split">
          <div className="pane editor-pane">
            <Editor dark={dark} onScrollFraction={syncPreview} />
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
