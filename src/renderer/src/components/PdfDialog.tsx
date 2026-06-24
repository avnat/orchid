import { useState } from 'react'

export interface PdfOptions {
  header: string
  footer: string
  pageNumbers: boolean
}

const lsGet = (k: string, d: string): string => {
  try {
    return localStorage.getItem(k) ?? d
  } catch {
    return d
  }
}

/** Configure header / footer before exporting to PDF. Choices are remembered. */
export default function PdfDialog({
  open,
  onConfirm,
  onClose
}: {
  open: boolean
  onConfirm: (opts: PdfOptions) => void
  onClose: () => void
}): JSX.Element | null {
  const [header, setHeader] = useState(() => lsGet('orchid.pdfHeader', ''))
  const [footer, setFooter] = useState(() => lsGet('orchid.pdfFooter', '{title}'))
  const [pageNumbers, setPageNumbers] = useState(() => lsGet('orchid.pdfPageNums', 'true') !== 'false')

  if (!open) return null

  const confirm = (): void => {
    try {
      localStorage.setItem('orchid.pdfHeader', header)
      localStorage.setItem('orchid.pdfFooter', footer)
      localStorage.setItem('orchid.pdfPageNums', String(pageNumbers))
    } catch {
      /* ignore */
    }
    onConfirm({ header, footer, pageNumbers })
  }

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="name-dialog" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Export to PDF">
        <div className="name-title">Export to PDF</div>

        <label className="pdf-field">
          <span>Header</span>
          <input
            className="name-input"
            placeholder="Leave blank for none"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
          />
        </label>

        <label className="pdf-field">
          <span>Footer</span>
          <input
            className="name-input"
            placeholder="Leave blank for none"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
          />
        </label>

        <label className="pdf-check">
          <input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} />
          <span>Page numbers (bottom-right)</span>
        </label>

        <div className="name-hint">
          Use <code>{'{title}'}</code> for the document name and <code>{'{date}'}</code> for today’s date.
        </div>

        <div className="name-actions">
          <button className="name-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="name-btn primary" onClick={confirm}>
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
