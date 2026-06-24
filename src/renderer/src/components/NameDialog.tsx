import { useEffect, useRef, useState } from 'react'

/** Modal to create a new file or folder (toggle inside). */
export default function NameDialog({
  open,
  onSubmit,
  onClose
}: {
  open: boolean
  onSubmit: (name: string, mode: 'file' | 'folder') => void
  onClose: () => void
}): JSX.Element | null {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'file' | 'folder'>('file')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setMode('file')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const submit = (): void => {
    const n = name.trim()
    if (n) {
      onSubmit(n, mode)
      onClose()
    }
  }

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="name-dialog" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Create">
        <div className="name-title">Create new</div>
        <div className="segment" style={{ marginBottom: 12 }}>
          <button className={mode === 'file' ? 'seg on' : 'seg'} onClick={() => setMode('file')}>
            File
          </button>
          <button className={mode === 'folder' ? 'seg on' : 'seg'} onClick={() => setMode('folder')}>
            Folder
          </button>
        </div>
        <input
          ref={inputRef}
          className="name-input"
          placeholder={mode === 'folder' ? 'folder-name' : 'filename.md'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <div className="name-hint">
          {mode === 'file' ? (
            <>
              No extension defaults to <code>.txt</code>. Nest with a path like <code>notes/idea.md</code>.
            </>
          ) : (
            <>
              Nest with a path like <code>specs/api</code>.
            </>
          )}
        </div>
        <div className="name-actions">
          <button className="name-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="name-btn primary" onClick={submit}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
