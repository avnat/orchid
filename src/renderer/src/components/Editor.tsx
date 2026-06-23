import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { createTheme } from '@uiw/codemirror-themes'
import { useStore } from '../store/useStore'

export default function Editor({
  dark,
  onScrollFraction
}: {
  dark: boolean
  onScrollFraction?: (fraction: number) => void
}): JSX.Element {
  const content = useStore((s) => s.content)
  const setContent = useStore((s) => s.setContent)
  const accentKey = useStore((s) => s.accentKey)

  const theme = useMemo(() => {
    const root = getComputedStyle(document.documentElement)
    const accent = root.getPropertyValue('--accent').trim() || '#7e6bb8'
    return createTheme({
      theme: dark ? 'dark' : 'light',
      settings: {
        background: dark ? '#1c1a22' : '#ffffff',
        foreground: dark ? '#e8e5ef' : '#1b1a21',
        caret: accent,
        selection: accent + '33',
        selectionMatch: accent + '22',
        lineHighlight: 'transparent',
        gutterBackground: 'transparent',
        gutterForeground: dark ? '#928ca0' : '#6e6a78'
      },
      styles: []
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, accentKey])

  return (
    <CodeMirror
      className="cm-host"
      value={content}
      height="100%"
      theme={theme}
      extensions={[markdown(), EditorView.lineWrapping]}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
      onChange={(v) => setContent(v)}
      onCreateEditor={(view) => {
        view.scrollDOM.addEventListener('scroll', () => {
          const el = view.scrollDOM
          const frac = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
          onScrollFraction?.(frac)
        })
      }}
    />
  )
}
