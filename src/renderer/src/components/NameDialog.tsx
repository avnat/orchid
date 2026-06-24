import { useEffect, useRef, useState } from 'react'

/** Small modal to enter a name (for New File / New Folder). */
export default function NameDialog({
  open,
  title,
  placeholder,
  onSubmit,
  onClose
}: {
  open: boolean
  title: string
  placeholder: string
  onSubmit: (name: string) => void
  onClose: () => void
}): JSX.Element | null {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const submit = (): void => {
    const n = name.trim()
    if (n) {
      onSubmit(n)
      onClose()
    }
  }

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="name-dialog" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="name-title">{title}</div>
        <input
          ref={inputRef}
          className="name-input"
          placeholder={placeholder}
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
        <div className="name-hint">Tip: include a path like <code>notes/idea.md</code> to nest it.</div>
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
