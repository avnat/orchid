import OrchidMark from './OrchidMark'

export default function EmptyState(): JSX.Element {
  return (
    <div className="empty">
      <div className="lockup">
        <OrchidMark size={82} />
        <span className="wordmark">Orchid</span>
        <p className="tagline">A calm, native reader for the Markdown your tools generate.</p>
      </div>

      <button className="cta" onClick={() => window.orchid.openFolder()}>
        Open a folder
      </button>
      <p className="hint">
        or drop a folder anywhere — press <kbd>⌘O</kbd>
      </p>

      <div className="byline">Concept by Avnee · Built by Claude</div>
    </div>
  )
}
