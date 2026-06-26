// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  SHORTCUT_DEFS,
  isValidAccelerator,
  mergeShortcuts,
  sanitizeOverrides
} from '../src/main/shortcuts'

describe('SHORTCUT_DEFS', () => {
  it('has unique ids', () => {
    const ids = SHORTCUT_DEFS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every default accelerator is valid', () => {
    for (const d of SHORTCUT_DEFS) expect(isValidAccelerator(d.defaultAccelerator)).toBe(true)
  })
})

describe('isValidAccelerator', () => {
  it('accepts a modifier + letter/number', () => {
    expect(isValidAccelerator('CmdOrCtrl+S')).toBe(true)
    expect(isValidAccelerator('Control+Shift+F')).toBe(true)
    expect(isValidAccelerator('Command+1')).toBe(true)
  })

  it('accepts function keys and named keys', () => {
    expect(isValidAccelerator('F5')).toBe(true)
    expect(isValidAccelerator('CmdOrCtrl+Space')).toBe(true)
    expect(isValidAccelerator('Alt+Up')).toBe(true)
  })

  it('accepts punctuation keys', () => {
    expect(isValidAccelerator('CmdOrCtrl+.')).toBe(true)
    expect(isValidAccelerator('CmdOrCtrl+Alt+.')).toBe(true)
    expect(isValidAccelerator('/')).toBe(true)
  })

  it('is case-insensitive on modifiers and keys', () => {
    expect(isValidAccelerator('cmdorctrl+s')).toBe(true)
    expect(isValidAccelerator('CONTROL+f5')).toBe(true)
  })

  it('rejects non-strings and empties', () => {
    expect(isValidAccelerator('')).toBe(false)
    expect(isValidAccelerator(123)).toBe(false)
    expect(isValidAccelerator(null)).toBe(false)
    expect(isValidAccelerator(undefined)).toBe(false)
  })

  it('rejects a lone modifier', () => {
    expect(isValidAccelerator('Shift')).toBe(false)
    expect(isValidAccelerator('CmdOrCtrl+Shift')).toBe(false)
  })

  it('rejects a trailing plus / empty key', () => {
    expect(isValidAccelerator('CmdOrCtrl+')).toBe(false)
  })

  it('rejects unknown modifiers', () => {
    expect(isValidAccelerator('Hyper+S')).toBe(false)
  })

  it('rejects invalid keys', () => {
    expect(isValidAccelerator('CmdOrCtrl+ab')).toBe(false) // multi-char non-named
    expect(isValidAccelerator('F25')).toBe(false) // out of F1–F24
    expect(isValidAccelerator('CmdOrCtrl+F0')).toBe(false)
  })
})

describe('mergeShortcuts', () => {
  it('returns all defaults with no overrides', () => {
    const m = mergeShortcuts({})
    for (const d of SHORTCUT_DEFS) expect(m[d.id]).toBe(d.defaultAccelerator)
  })

  it('applies a valid override', () => {
    const m = mergeShortcuts({ save: 'Control+S' })
    expect(m.save).toBe('Control+S')
  })

  it('falls back to default for an invalid override', () => {
    const m = mergeShortcuts({ save: 'Nonsense++' })
    expect(m.save).toBe('CmdOrCtrl+S')
  })

  it('ignores overrides for unknown ids', () => {
    const m = mergeShortcuts({ nope: 'Control+Q' })
    expect(m.nope).toBeUndefined()
    expect(Object.keys(m)).toHaveLength(SHORTCUT_DEFS.length)
  })
})

describe('sanitizeOverrides', () => {
  it('keeps known ids with valid, non-default accelerators', () => {
    expect(sanitizeOverrides({ save: 'Control+S' })).toEqual({ save: 'Control+S' })
  })

  it('drops accelerators equal to the default', () => {
    expect(sanitizeOverrides({ save: 'CmdOrCtrl+S' })).toEqual({})
  })

  it('drops invalid accelerators', () => {
    expect(sanitizeOverrides({ save: 'bogus++' })).toEqual({})
  })

  it('drops unknown command ids', () => {
    expect(sanitizeOverrides({ mystery: 'Control+Q' })).toEqual({})
  })

  it('drops non-string values', () => {
    expect(sanitizeOverrides({ save: 42 })).toEqual({})
  })

  it('returns {} for non-object input', () => {
    expect(sanitizeOverrides(null)).toEqual({})
    expect(sanitizeOverrides('x')).toEqual({})
    expect(sanitizeOverrides(undefined)).toEqual({})
  })
})
