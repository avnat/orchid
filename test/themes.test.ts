import { describe, it, expect } from 'vitest'
import { ACCENTS, accentByKey } from '../src/renderer/src/themes'

describe('ACCENTS', () => {
  it('ships 13 curated presets', () => {
    expect(ACCENTS).toHaveLength(13)
  })

  it('every preset has a key, name, and light/dark hex', () => {
    for (const a of ACCENTS) {
      expect(a.key).toBeTruthy()
      expect(a.name).toBeTruthy()
      expect(a.light).toMatch(/^#[0-9a-f]{6}$/i)
      expect(a.dark).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('has unique keys', () => {
    const keys = ACCENTS.map((a) => a.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('includes Orchid as the first/default preset', () => {
    expect(ACCENTS[0].key).toBe('orchid')
  })

  it('no longer includes the dropped presets', () => {
    const keys = ACCENTS.map((a) => a.key)
    expect(keys).not.toContain('periwinkle')
    expect(keys).not.toContain('jade')
    expect(keys).not.toContain('slate')
  })
})

describe('accentByKey', () => {
  it('returns the matching accent', () => {
    expect(accentByKey('teal').name).toBe('Teal')
  })

  it('falls back to the first accent for an unknown key', () => {
    expect(accentByKey('nope')).toBe(ACCENTS[0])
    expect(accentByKey('custom')).toBe(ACCENTS[0])
  })
})
