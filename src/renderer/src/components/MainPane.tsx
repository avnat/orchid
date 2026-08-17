import { useEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode } from 'react'
import { useStore } from '../store/useStore'
import type { CursorPos } from './Editor'
import type { WorkspaceFolder } from '../types'
import MarkdownView from '../markdown/MarkdownView'
import ConflictBanner from './ConflictBanner'
import Toc from './Toc'
import { isMarkdownFile, isPdfFile, langForFile } from '../markdown/langs'

// CodeMirror + its language packages are sizeable; load the editor lazily so it
// stays out of the startup bundle until the user actually edits or opens code.
const Editor = lazy(() => import('./Editor'))
// pdf.js is large too — only pulled in when a PDF is opened.
const PdfView = lazy(() => import('./PdfView'))

/** Workspace-relative path of the open file, top folder included (e.g.
 *  "docs/projects/notes/handover.md"). Loose single files show just their name. */
function locationLabel(activePath: string, folders: WorkspaceFolder[]): string {
  const base = activePath.slice(activePath.lastIndexOf('/') + 1)
  const f = folders.find((w) => activePath === w.root || activePath.startsWith(w.root + '/'))
  if (!f || f.isFile) return base
  return `${f.name}/${activePath.slice(f.root.length + 1)}`
}

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

  const splitRatio = useStore((s) => s.splitRatio)
  const setSplitRatio = useStore((s) => s.setSplitRatio)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const splitPreviewRef = useRef<HTMLDivElement>(null)
  const splitRef = useRef<HTMLDivElement>(null)

  // Sublime-style caret position for the status bar (set by the editor).
  const [caret, setCaret] = useState<CursorPos | null>(null)
  const folders = useStore((s) => s.folders)

  // File location, shown right-aligned in the status bar in every mode.
  const location = useMemo(
    () => (activePath ? locationLabel(activePath, folders) : ''),
    [activePath, folders]
  )
  // Total line count — the read-mode bar (a rendered file has no caret).
  const lineCount = useMemo(() => (content ? content.split(/\r?\n/).length : 0), [content])

  // One bar: a left slot (caret or line count) plus the file location on the right.
  const renderStatus = (left: ReactNode): JSX.Element | null =>
    left || location ? (
      <div className="editor-statusbar">
        {left}
        {location && (
          <span className="stat-loc" data-tip={activePath ?? undefined}>
            {location}
          </span>
        )}
      </div>
    ) : null

  const caretSlot = caret ? (
    <>
      <span>
        Line {caret.line}, Column {caret.col}
      </span>
      {caret.sel > 0 && <span className="stat-sel">{caret.sel} selected</span>}
    </>
  ) : null
  const lineSlot = (
    <span>
      {lineCount} {lineCount === 1 ? 'line' : 'lines'}
    </span>
  )

  // Drag the editor↔preview divider (clamped to 25–75% by the store).
  const startSplitDrag = (e: React.MouseEvent): void => {
    e.preventDefault()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const move = (ev: globalThis.MouseEvent): void => {
      const r = splitRef.current?.getBoundingClientRect()
      if (r && r.width) setSplitRatio((ev.clientX - r.left) / r.width)
    }
    const up = (): void => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

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

  // PDFs render in the pdf.js viewer (read-only).
  if (isPdfFile(activePath)) {
    return (
      <div className="main">
        <Suspense fallback={<div className="pdf-loading">Loading PDF…</div>}>
          <PdfView path={activePath} />
        </Suspense>
        {renderStatus(null)}
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
            {/* keyed by path so each tab gets its own editor (and undo history) */}
            <Editor
              key={activePath}
              dark={dark}
              language={codeLang}
              readOnly={!editMode}
              showLineNumbers
              onCursor={setCaret}
            />
          </Suspense>
        </div>
        {renderStatus(caretSlot)}
      </div>
    )
  }

  return (
    <div className="main">
      {conflict && <ConflictBanner />}
      {editMode ? (
        <div
          className="split"
          ref={splitRef}
          style={{ gridTemplateColumns: `minmax(0,${splitRatio}fr) 7px minmax(0,${1 - splitRatio}fr)` }}
        >
          <div className="pane editor-pane">
            <Suspense fallback={<div className="editor-loading" />}>
              <Editor
                key={activePath}
                dark={dark}
                showLineNumbers
                onScrollFraction={syncPreview}
                onCursor={setCaret}
              />
            </Suspense>
          </div>
          <div className="split-divider" onMouseDown={startSplitDrag} aria-hidden="true" />
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
          {!tocVisible && (
            <div className="reveal-divider right">
              <button
                className="divider-btn"
                data-tip="Show contents"
                aria-label="Show table of contents"
                onClick={() => useStore.getState().toggleToc()}
              >
                ‹
              </button>
            </div>
          )}
        </div>
      )}
      {editMode ? renderStatus(caretSlot) : renderStatus(lineSlot)}
    </div>
  )
}
