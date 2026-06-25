import { useEffect, useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { EditorState, type Extension } from '@codemirror/state'
import { createTheme } from '@uiw/codemirror-themes'
import { tags as t } from '@lezer/highlight'
import { useStore } from '../store/useStore'

/** Blend two #rrggbb colors (ratio 0 = a, 1 = b). */
function mix(a: string, b: string, r: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * r))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export default function Editor({
  dark,
  language,
  readOnly = false,
  showLineNumbers = false,
  onScrollFraction
}: {
  dark: boolean
  language?: Extension | null
  readOnly?: boolean
  showLineNumbers?: boolean
  onScrollFraction?: (fraction: number) => void
}): JSX.Element {
  const content = useStore((s) => s.content)
  const setContent = useStore((s) => s.setContent)
  const accentKey = useStore((s) => s.accentKey)
  const viewRef = useRef<EditorView | null>(null)

  // Undo/Redo are routed from the Edit menu so they drive CodeMirror's own
  // history (Electron's native execCommand undo doesn't).
  useEffect(() => {
    if (readOnly) return
    const off = [
      window.orchid.onEditUndo(() => viewRef.current && undo(viewRef.current)),
      window.orchid.onEditRedo(() => viewRef.current && redo(viewRef.current))
    ]
    return () => off.forEach((f) => f())
  }, [readOnly])

  const theme = useMemo(() => {
    const root = getComputedStyle(document.documentElement)
    let accent = root.getPropertyValue('--accent').trim() || '#7e6bb8'
    if (accent.length === 4) accent = '#' + accent.slice(1).replace(/./g, (c) => c + c) // #abc → #aabbcc
    const fg = dark ? '#e8e5ef' : '#1b1a21'
    const muted = dark ? '#928ca0' : '#6e6a78'
    const str = mix(accent, fg, 0.5)
    const lit = mix(accent, fg, 0.25)
    return createTheme({
      theme: dark ? 'dark' : 'light',
      settings: {
        background: dark ? '#1c1a22' : '#ffffff',
        foreground: fg,
        caret: accent,
        selection: accent + '33',
        selectionMatch: accent + '22',
        lineHighlight: 'transparent',
        gutterBackground: 'transparent',
        gutterForeground: muted
      },
      styles: [
        { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: accent, fontWeight: '600' },
        { tag: [t.comment, t.lineComment, t.blockComment], color: muted, fontStyle: 'italic' },
        { tag: [t.string, t.special(t.string), t.regexp], color: str },
        { tag: [t.number, t.bool, t.null, t.atom], color: lit },
        { tag: [t.className, t.typeName, t.definition(t.typeName)], color: fg, fontWeight: '600' },
        { tag: [t.function(t.variableName), t.definition(t.variableName)], color: fg },
        { tag: [t.propertyName, t.attributeName], color: mix(accent, fg, 0.4) },
        { tag: [t.operator, t.punctuation, t.bracket], color: muted },
        { tag: [t.tagName], color: accent },
        { tag: [t.heading], color: accent, fontWeight: '600' }
      ]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, accentKey])

  const extensions = useMemo(() => {
    const exts: Extension[] = [language ?? markdown(), EditorView.lineWrapping]
    if (readOnly) exts.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
    return exts
  }, [language, readOnly])

  return (
    <CodeMirror
      className="cm-host"
      value={content}
      height="100%"
      theme={theme}
      extensions={extensions}
      editable={!readOnly}
      autoFocus={!readOnly}
      basicSetup={{ lineNumbers: showLineNumbers, foldGutter: false, highlightActiveLine: false }}
      onChange={(v) => {
        if (!readOnly) setContent(v)
      }}
      onCreateEditor={(view) => {
        viewRef.current = view
        // Land the cursor at the very start (0,0) and focus, so editing begins immediately.
        if (!readOnly) {
          view.dispatch({ selection: { anchor: 0, head: 0 } })
          view.focus()
        }
        view.scrollDOM.addEventListener('scroll', () => {
          const el = view.scrollDOM
          const frac = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
          onScrollFraction?.(frac)
        })
      }}
    />
  )
}
