import OrchidMark from './OrchidMark'

export default function EmptyState(): JSX.Element {
  return (
    <div className="empty">
      <div className="lockup">
        <OrchidMark size={82} />
        <span className="wordmark">Orchid</span>
        <p className="tagline">A calm, native reader for the Markdown your tools generate.</p>
      </div>

      <button className="cta" onClick={() => window.orchid.open()}>
        Open a folder or file
      </button>
      <p className="hint">
        or drop a folder or file anywhere · <kbd>⌘O</kbd>
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
      </div>
    </div>
  )
}
