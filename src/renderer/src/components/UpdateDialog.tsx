export interface UpdateInfo {
  version: string
  notes: string
  url: string
  download: string
  manual: boolean
}

/** Trim release notes to the first chunk so the dialog stays compact. */
function preview(notes: string): string {
  const body = notes.split(/##\s*Download/i)[0].trim() // drop the install instructions block
  return body.length > 700 ? body.slice(0, 700).trimEnd() + '…' : body
}

export default function UpdateDialog({
  info,
  onDownload,
  onClose
}: {
  info: UpdateInfo | null
  onDownload: () => void
  onClose: () => void
}): JSX.Element | null {
  if (!info) return null
  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="update-dialog" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Update available">
        <div className="update-badge">Update available</div>
        <div className="update-title">Orchid {info.version.replace(/^v/, '')}</div>
        {preview(info.notes) && <pre className="update-notes">{preview(info.notes)}</pre>}
        <p className="update-hint">
          Orchid isn’t signed with an Apple certificate, so the update downloads as a <code>.dmg</code> you drag into
          Applications — same as the first install.
        </p>
        <div className="update-actions">
          <button className="name-btn" onClick={onClose}>
            Later
          </button>
          <button className="name-btn primary" onClick={onDownload}>
            Download update
          </button>
        </div>
      </div>
    </div>
  )
}
