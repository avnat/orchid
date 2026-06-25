import { useEffect, useState, useCallback } from 'react'
import type { ShortcutDef } from '../types'
import { formatAccelerator, eventToAccelerator } from '../lib/accelerator'

interface ShortcutData {
  defs: ShortcutDef[]
  map: Record<string, string>
}

export default function SettingsPanel({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): JSX.Element | null {
  const [data, setData] = useState<ShortcutData | null>(null)
  const [recording, setRecording] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load the live shortcut map whenever the panel opens, and track changes
  // pushed from the main process (e.g. another reset).
  useEffect(() => {
    if (!open) return
    void window.orchid.getShortcuts().then(setData)
    return window.orchid.onShortcutsChanged(setData)
  }, [open])

  useEffect(() => {
    if (!open) {
      setRecording(null)
      setError(null)
    }
  }, [open])

  // While recording, capture the next chord and assign it.
  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      const accel = eventToAccelerator(e)
      if (!accel) return // bare key / lone modifier — keep listening
      void window.orchid.setShortcut(recording, accel).then((res) => {
        if (res.ok && res.defs && res.map) {
          setData({ defs: res.defs, map: res.map })
          setError(null)
        } else {
          setError(res.error ?? 'Could not set that shortcut')
        }
        setRecording(null)
      })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording])

  // Esc closes the panel (when not mid-recording).
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !recording) onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, recording, onClose])

  const resetOne = useCallback((id: string, def: string) => {
    void window.orchid.setShortcut(id, def).then((res) => {
      if (res.ok && res.defs && res.map) setData({ defs: res.defs, map: res.map })
    })
  }, [])

  const resetAll = useCallback(() => {
    void window.orchid.resetShortcuts().then(setData)
  }, [])

  if (!open) return null

  // Flag accelerators bound to more than one command.
  const counts: Record<string, number> = {}
  if (data) for (const id of Object.keys(data.map)) counts[data.map[id]] = (counts[data.map[id]] ?? 0) + 1

  return (
    <div className="cmd-overlay" onMouseDown={onClose}>
      <div className="settings" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="settings-head">
          <span>Keyboard shortcuts</span>
          <button className="tbtn" onClick={resetAll} title="Reset every shortcut to its default">
            Reset all
          </button>
        </div>
        <p className="settings-note">
          Click a shortcut, then press the keys you want. On a Windows-style keyboard you can bind
          <kbd>Ctrl</kbd>-based shortcuts here. Press <kbd>Esc</kbd> to cancel.
        </p>
        {error && <div className="settings-error">{error}</div>}
        <div className="settings-list">
          {data?.defs.map((d) => {
            const current = data.map[d.id]
            const isDefault = current === d.defaultAccelerator
            const conflict = counts[current] > 1
            return (
              <div className="settings-row" key={d.id}>
                <span className="settings-label">{d.label}</span>
                <span className="settings-controls">
                  {conflict && !recording && (
                    <span className="settings-conflict" title="Used by more than one command">
                      conflict
                    </span>
                  )}
                  {!isDefault && (
                    <button
                      className="settings-reset"
                      onClick={() => resetOne(d.id, d.defaultAccelerator)}
                      title={`Reset to ${formatAccelerator(d.defaultAccelerator)}`}
                    >
                      ↺
                    </button>
                  )}
                  <button
                    className={`settings-key ${recording === d.id ? 'recording' : ''}`}
                    onClick={() => {
                      setError(null)
                      setRecording(d.id)
                    }}
                  >
                    {recording === d.id ? 'Press keys…' : formatAccelerator(current)}
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
