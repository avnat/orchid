import { useEffect, useRef, useState } from 'react'
import { useStore, type TextSize } from '../store/useStore'
import { ACCENTS, accentByKey, type Appearance } from '../themes'

const APPEARANCES: { key: Appearance; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Bloom' },
  { key: 'dark', label: 'Dusk' }
]

const TEXT_SIZES: { key: TextSize; label: string }[] = [
  { key: 'sm', label: 'Small' },
  { key: 'md', label: 'Medium' },
  { key: 'lg', label: 'Large' }
]

export default function ThemePicker(): JSX.Element {
  const appearance = useStore((s) => s.appearance)
  const accentKey = useStore((s) => s.accentKey)
  const systemDark = useStore((s) => s.systemDark)
  const sidebarTextSize = useStore((s) => s.sidebarTextSize)
  const customAccent = useStore((s) => s.customAccent)
  const setAppearance = useStore((s) => s.setAppearance)
  const setAccent = useStore((s) => s.setAccent)
  const setCustomAccent = useStore((s) => s.setCustomAccent)
  const setSidebarTextSize = useStore((s) => s.setSidebarTextSize)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const dark = appearance === 'system' ? systemDark : appearance === 'dark'
  const current = accentByKey(accentKey)
  const swatch = (a: { light: string; dark: string }): string => (dark ? a.dark : a.light)

  return (
    <div className="theme-picker" ref={ref}>
      <button
        className="tbtn"
        onClick={() => setOpen((o) => !o)}
        title="Theme"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="swatch-dot" style={{ background: swatch(current) }} />
        Theme
      </button>

      {open && (
        <div className="popover" role="dialog" aria-label="Theme">
          <div className="pop-label">Appearance</div>
          <div className="segment">
            {APPEARANCES.map((a) => (
              <button
                key={a.key}
                className={appearance === a.key ? 'seg on' : 'seg'}
                onClick={() => setAppearance(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="pop-label">Accent</div>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                className={accentKey === a.key ? 'swatch on' : 'swatch'}
                title={a.name}
                aria-label={a.name}
                onClick={() => setAccent(a.key)}
              >
                <span className="ring" style={{ background: swatch(a) }} />
                <span className="swatch-name">{a.name}</span>
              </button>
            ))}
            <button
              className={accentKey === 'custom' ? 'swatch on' : 'swatch'}
              title="Use your custom colour"
              onClick={() => setAccent('custom')}
            >
              <span className="ring custom-ring" style={{ background: customAccent }} />
              <span className="swatch-name">Custom</span>
            </button>
          </div>

          <div className="custom-row">
            <label className="custom-well" title="Pick your colour">
              <span className="ring" style={{ background: customAccent }} />
              <input
                type="color"
                className="custom-color-input"
                value={customAccent}
                onChange={(e) => setCustomAccent(e.target.value)}
              />
            </label>
            <span className="custom-hex">{customAccent.toUpperCase()}</span>
            <span className="custom-cap">Pick your colour</span>
          </div>

          <div className="pop-label">Sidebar text size</div>
          <div className="segment">
            {TEXT_SIZES.map((t) => (
              <button
                key={t.key}
                className={sidebarTextSize === t.key ? 'seg on' : 'seg'}
                onClick={() => setSidebarTextSize(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
