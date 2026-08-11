import { useEffect, useState } from 'react'
import OrchidMark from './OrchidMark'
import type { RecentEntry } from '../types'

/** Small folder / document glyphs so recents read at a glance. */
function RecentIcon({ kind }: { kind: RecentEntry['kind'] }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'folder' ? (
        <path d="M2 4.2a1 1 0 0 1 1-1h3l1.3 1.5H13a1 1 0 0 1 1 1v5.6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Z" />
      ) : (
        <>
          <path d="M9 1.9H4.6a1.1 1.1 0 0 0-1.1 1.1v10a1.1 1.1 0 0 0 1.1 1.1h6.8a1.1 1.1 0 0 0 1.1-1.1V5.2z" />
          <path d="M9 1.9v3.3h3.3" />
        </>
      )}
    </svg>
  )
}

/** Parent folder of a path, with the home dir shortened to ~ for readability. */
function parentOf(path: string): string {
  const dir = path.slice(0, path.lastIndexOf('/')) || '/'
  return dir.replace(/^\/Users\/[^/]+/, '~')
}

export default function EmptyState(): JSX.Element {
  const [version, setVersion] = useState('')
  const [recents, setRecents] = useState<RecentEntry[]>([])
  useEffect(() => {
    void window.orchid.getVersion().then(setVersion)
    void window.orchid.getRecents().then(setRecents)
    return window.orchid.onRecentsChanged(setRecents)
  }, [])

  return (
    <div className="empty">
      <div className="lockup">
        {/* the glow lives on the static wrapper — filtering the spinning SVG
            itself makes Chromium rasterize it into a blurry bitmap */}
        <div className="mark">
          <OrchidMark size={82} />
        </div>
        <span className="wordmark">Orchid</span>
        <p className="tagline">A calm, native reader for the Markdown your tools generate.</p>
      </div>

      <div className="empty-actions">
        <button className="cta" onClick={() => window.orchid.open()}>
          Open a folder or file
        </button>
        <button className="cta ghost" onClick={() => window.orchid.newFile()}>
          New file
        </button>
      </div>
      <p className="hint">
        or drop a folder or file anywhere · <kbd>⌘O</kbd> open · <kbd>⌘N</kbd> new
      </p>

      {recents.length > 0 && (
        <div className="empty-recent">
          <div className="empty-recent-head">
            <span>Recent</span>
            <button className="recent-clear" onClick={() => void window.orchid.clearRecents()}>
              Clear
            </button>
          </div>
          <ul>
            {recents.slice(0, 8).map((r) => (
              <li key={r.path}>
                <button
                  className="recent-item"
                  data-tip={r.path}
                  onClick={() => void window.orchid.openRecent(r)}
                >
                  <span className={`recent-ic ${r.kind}`}>
                    <RecentIcon kind={r.kind} />
                  </span>
                  <span className="recent-name">{r.name}</span>
                  <span className="recent-path">{parentOf(r.path)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="byline">
        Concept by Avnee · Built by Claude · enjoying it?{' '}
        <a
          href="#"
          className="byline-link"
          onClick={(e) => {
            e.preventDefault()
            window.orchid.openExternal('https://twitter.com/AvneeNathani')
          }}
        >
          say hi @AvneeNathani
        </a>
        {version && <span className="version-tag"> · v{version}</span>}
      </div>
    </div>
  )
}
