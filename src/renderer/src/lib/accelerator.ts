// Pure helpers for working with Electron accelerator strings in the renderer:
// recording a pressed chord, matching one against a KeyboardEvent (for the
// fallback handlers that fire when a focused field swallows the menu
// accelerator), and formatting one for display.

/** Minimal shape of the bits of KeyboardEvent we use — keeps these testable. */
export interface KeyChord {
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  key: string
}

const META_MODS = ['command', 'cmd', 'meta', 'super', 'cmdorctrl', 'commandorcontrol']
const CTRL_MODS = ['control', 'ctrl']
const ALT_MODS = ['alt', 'option', 'altgr']

const DISPLAY: Record<string, string> = {
  command: '⌘',
  cmd: '⌘',
  cmdorctrl: '⌘',
  commandorcontrol: '⌘',
  meta: '⌘',
  super: '⌘',
  control: '⌃',
  ctrl: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  space: 'Space',
  escape: 'Esc',
  esc: 'Esc'
}

/** Pretty macOS-style rendering of an accelerator, e.g. "CmdOrCtrl+Shift+F" → "⌘⇧F". */
export function formatAccelerator(accel: string): string {
  return accel
    .split('+')
    .map((p) => DISPLAY[p.toLowerCase()] ?? p.toUpperCase())
    .join('')
}

/** Does this keyboard chord match the given accelerator? (macOS modifier mapping.) */
export function matchAccelerator(accel: string, e: KeyChord): boolean {
  const parts = accel.split('+')
  const key = parts[parts.length - 1].toLowerCase()
  const mods = parts.slice(0, -1).map((m) => m.toLowerCase())
  const wantMeta = mods.some((m) => META_MODS.includes(m))
  const wantCtrl = mods.some((m) => CTRL_MODS.includes(m))
  const wantAlt = mods.some((m) => ALT_MODS.includes(m))
  const wantShift = mods.includes('shift')
  return (
    e.metaKey === wantMeta &&
    e.ctrlKey === wantCtrl &&
    e.altKey === wantAlt &&
    e.shiftKey === wantShift &&
    e.key.toLowerCase() === key
  )
}

const KEY_NAMES: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Escape',
  Enter: 'Return',
  ' ': 'Space'
}

const PURE_MODIFIERS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'CapsLock'])

/**
 * Turn a pressed chord into an Electron accelerator string for remapping.
 * Records the exact modifier pressed (Command vs Control) so a Windows-style
 * keyboard user can bind Ctrl-based shortcuts. Returns null for a bare key
 * (no modifier) or a lone modifier press, so those don't get captured.
 */
export function eventToAccelerator(e: KeyChord): string | null {
  if (PURE_MODIFIERS.has(e.key)) return null
  const mods: string[] = []
  if (e.metaKey) mods.push('Command')
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (mods.length === 0) return null
  let k = KEY_NAMES[e.key] ?? e.key
  if (/^[a-z]$/.test(k)) k = k.toUpperCase()
  return [...mods, k].join('+')
}
