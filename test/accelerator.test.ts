import { describe, it, expect } from 'vitest'
import { formatAccelerator, matchAccelerator, eventToAccelerator } from '../src/renderer/src/lib/accelerator'

const chord = (o: Partial<Parameters<typeof matchAccelerator>[1]> = {}): Parameters<typeof matchAccelerator>[1] => ({
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  key: '',
  ...o
})

describe('formatAccelerator', () => {
  it('renders modifier symbols', () => {
    expect(formatAccelerator('CmdOrCtrl+Shift+F')).toBe('⌘⇧F')
    expect(formatAccelerator('Control+S')).toBe('⌃S')
    expect(formatAccelerator('Alt+.')).toBe('⌥.')
    expect(formatAccelerator('Command+Enter')).toBe('⌘↵')
  })

  it('spells named keys and uppercases unknown tokens', () => {
    expect(formatAccelerator('CmdOrCtrl+Space')).toBe('⌘Space')
    expect(formatAccelerator('CmdOrCtrl+k')).toBe('⌘K')
  })
})

describe('matchAccelerator', () => {
  it('matches a Cmd-based accelerator on macOS', () => {
    expect(matchAccelerator('CmdOrCtrl+S', chord({ metaKey: true, key: 's' }))).toBe(true)
    expect(matchAccelerator('Command+S', chord({ metaKey: true, key: 's' }))).toBe(true)
  })

  it('distinguishes Control from Command', () => {
    expect(matchAccelerator('Control+S', chord({ ctrlKey: true, key: 's' }))).toBe(true)
    expect(matchAccelerator('Control+S', chord({ metaKey: true, key: 's' }))).toBe(false)
    expect(matchAccelerator('CmdOrCtrl+S', chord({ ctrlKey: true, key: 's' }))).toBe(false)
  })

  it('requires exact modifier set', () => {
    expect(matchAccelerator('CmdOrCtrl+Shift+F', chord({ metaKey: true, shiftKey: true, key: 'f' }))).toBe(true)
    expect(matchAccelerator('CmdOrCtrl+Shift+F', chord({ metaKey: true, key: 'f' }))).toBe(false)
    expect(matchAccelerator('CmdOrCtrl+S', chord({ metaKey: true, altKey: true, key: 's' }))).toBe(false)
  })

  it('handles alt/option and is case-insensitive on the key', () => {
    expect(matchAccelerator('Alt+.', chord({ altKey: true, key: '.' }))).toBe(true)
    expect(matchAccelerator('CmdOrCtrl+S', chord({ metaKey: true, key: 'S' }))).toBe(true)
  })
})

describe('eventToAccelerator', () => {
  it('captures the exact modifiers pressed', () => {
    expect(eventToAccelerator(chord({ metaKey: true, key: 's' }))).toBe('Command+S')
    expect(eventToAccelerator(chord({ ctrlKey: true, shiftKey: true, key: 'f' }))).toBe('Control+Shift+F')
    expect(eventToAccelerator(chord({ metaKey: true, altKey: true, key: 'k' }))).toBe('Command+Alt+K')
  })

  it('maps special keys', () => {
    expect(eventToAccelerator(chord({ metaKey: true, key: 'ArrowUp' }))).toBe('Command+Up')
    expect(eventToAccelerator(chord({ ctrlKey: true, key: ' ' }))).toBe('Control+Space')
    expect(eventToAccelerator(chord({ metaKey: true, key: 'Enter' }))).toBe('Command+Return')
    expect(eventToAccelerator(chord({ metaKey: true, key: '.' }))).toBe('Command+.')
  })

  it('rejects bare keys (no modifier)', () => {
    expect(eventToAccelerator(chord({ key: 'a' }))).toBeNull()
  })

  it('rejects a lone modifier press', () => {
    expect(eventToAccelerator(chord({ metaKey: true, key: 'Meta' }))).toBeNull()
    expect(eventToAccelerator(chord({ shiftKey: true, key: 'Shift' }))).toBeNull()
  })
})
