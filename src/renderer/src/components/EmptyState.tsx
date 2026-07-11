import { useEffect, useState } from 'react'
import OrchidMark from './OrchidMark'

export default function EmptyState(): JSX.Element {
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.orchid.getVersion().then(setVersion)
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
