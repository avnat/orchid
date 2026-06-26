// The single source of truth for remappable command accelerators. Pure logic
// (no electron/fs imports) so it's unit-testable; the main process loads/saves
// overrides and rebuilds the menu around these.

export interface ShortcutDef {
  id: string
  label: string
  /** Electron accelerator string, e.g. "CmdOrCtrl+S". */
  defaultAccelerator: string
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { id: 'newFile', label: 'New File', defaultAccelerator: 'CmdOrCtrl+N' },
  { id: 'newFolder', label: 'New Folder', defaultAccelerator: 'CmdOrCtrl+Shift+N' },
  { id: 'open', label: 'Open', defaultAccelerator: 'CmdOrCtrl+O' },
  { id: 'addFolder', label: 'Add Folder to Workspace', defaultAccelerator: 'CmdOrCtrl+Shift+O' },
  { id: 'closeFile', label: 'Close File', defaultAccelerator: 'CmdOrCtrl+W' },
  { id: 'refresh', label: 'Refresh', defaultAccelerator: 'CmdOrCtrl+R' },
  { id: 'toggleEdit', label: 'Toggle Edit Mode', defaultAccelerator: 'CmdOrCtrl+E' },
  { id: 'save', label: 'Save', defaultAccelerator: 'CmdOrCtrl+S' },
  { id: 'commandPalette', label: 'Jump to File', defaultAccelerator: 'CmdOrCtrl+P' },
  { id: 'searchAll', label: 'Find in Files', defaultAccelerator: 'CmdOrCtrl+Shift+F' },
  { id: 'toggleSidebar', label: 'Toggle Sidebar', defaultAccelerator: 'CmdOrCtrl+.' },
  { id: 'toggleToc', label: 'Toggle Table of Contents', defaultAccelerator: 'CmdOrCtrl+Alt+.' },
  { id: 'undo', label: 'Undo', defaultAccelerator: 'CmdOrCtrl+Z' },
  { id: 'redo', label: 'Redo', defaultAccelerator: 'CmdOrCtrl+Shift+Z' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', defaultAccelerator: 'CmdOrCtrl+/' }
]

const MODIFIERS = new Set([
  'command',
  'cmd',
  'control',
  'ctrl',
  'commandorcontrol',
  'cmdorctrl',
  'alt',
  'option',
  'altgr',
  'shift',
  'super',
  'meta'
])

const NAMED_KEYS = new Set([
  'plus',
  'space',
  'tab',
  'backspace',
  'delete',
  'insert',
  'return',
  'enter',
  'up',
  'down',
  'left',
  'right',
  'home',
  'end',
  'pageup',
  'pagedown',
  'escape',
  'esc'
])

/** True if `accel` is a structurally valid Electron accelerator (one key, optional modifiers). */
export function isValidAccelerator(accel: unknown): boolean {
  if (typeof accel !== 'string' || accel.length === 0) return false
  const parts = accel.split('+')
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)
  if (!key) return false // trailing '+' or empty key
  for (const m of mods) if (!MODIFIERS.has(m.toLowerCase())) return false
  const k = key.toLowerCase()
  if (MODIFIERS.has(k)) return false // a modifier alone isn't a key
  if (/^[a-z0-9]$/.test(k)) return true
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(k)) return true
  if (NAMED_KEYS.has(k)) return true
  if (key.length === 1) return true // punctuation like . / , ;
  return false
}

/** Resolved accelerator for every command: a valid override wins, else the default. */
export function mergeShortcuts(overrides: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const d of SHORTCUT_DEFS) {
    const o = overrides[d.id]
    out[d.id] = o && isValidAccelerator(o) ? o : d.defaultAccelerator
  }
  return out
}

/** Keep only known command ids mapped to valid, non-default accelerators. */
export function sanitizeOverrides(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  const byId = new Map(SHORTCUT_DEFS.map((d) => [d.id, d]))
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const def = byId.get(id)
    if (def && typeof v === 'string' && isValidAccelerator(v) && v !== def.defaultAccelerator) {
      out[id] = v
    }
  }
  return out
}
