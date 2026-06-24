import { useEffect } from 'react'

const REPO = 'https://github.com/avnat/orchid'

function ext(url: string): (e: React.MouseEvent) => void {
  return (e) => {
    e.preventDefault()
    window.orchid.openExternal(url)
  }
}

export default function DeveloperPanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="dev-panel" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Contributing">
        <div className="dev-head">Contributing to Orchid</div>

        <p className="dev-lead">
          Orchid is free and open source under the MIT license. Issues and pull requests are
          welcome — here's how to get going.
        </p>

        <section className="dev-section">
          <h3>Repository</h3>
          <p>
            <a href={REPO} onClick={ext(REPO)}>
              github.com/avnat/orchid
            </a>{' '}
            ·{' '}
            <a href={`${REPO}/issues`} onClick={ext(`${REPO}/issues`)}>
              Open an issue
            </a>{' '}
            ·{' '}
            <a href={`${REPO}/blob/main/CHANGELOG.md`} onClick={ext(`${REPO}/blob/main/CHANGELOG.md`)}>
              Changelog
            </a>
          </p>
        </section>

        <section className="dev-section">
          <h3>Build from source</h3>
          <pre>
            <code>{`git clone ${REPO}.git
cd orchid
npm install
npm run dev      # launch with hot reload
npm run build    # bundle to out/
npm run dist     # package a signed .dmg into dist/`}</code>
          </pre>
        </section>

        <section className="dev-section">
          <h3>Project layout</h3>
          <pre>
            <code>{`src/main/      Electron main: window, menu, fs, watcher, IPC
src/preload/   Typed contextBridge API (sandboxed)
src/renderer/  React UI: sidebar, preview/editor, markdown, store, themes`}</code>
          </pre>
        </section>

        <section className="dev-section">
          <h3>Before you push</h3>
          <p>
            Run <code>npm run typecheck</code>; keep new code in the style of its neighbours. Small,
            focused PRs are easiest to review.
          </p>
        </section>

        <section className="dev-section">
          <h3>Built with</h3>
          <p className="dev-credits">
            Electron · React · Vite · react-markdown (remark / rehype) · KaTeX · Mermaid ·
            highlight.js · CodeMirror 6 · chokidar · Zustand — all open source. Full credits in the{' '}
            <a href={`${REPO}#acknowledgements`} onClick={ext(`${REPO}#acknowledgements`)}>
              README
            </a>
            .
          </p>
        </section>

        <div className="dev-foot">MIT © 2026 Avnee · Concept by Avnee · Built by Claude 🌸</div>
      </div>
    </div>
  )
}
