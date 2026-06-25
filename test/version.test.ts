// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { cmpVersions } from '../src/main/version'

describe('cmpVersions', () => {
  it('treats equal versions as 0', () => {
    expect(cmpVersions('1.2.3', '1.2.3')).toBe(0)
  })

  it('ignores a leading v on either side', () => {
    expect(cmpVersions('v1.2.3', '1.2.3')).toBe(0)
    expect(cmpVersions('1.2.3', 'v1.2.3')).toBe(0)
  })

  it('orders by major first', () => {
    expect(cmpVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(cmpVersions('1.0.0', '2.0.0')).toBeLessThan(0)
  })

  it('orders by minor when major ties', () => {
    expect(cmpVersions('1.3.0', '1.2.9')).toBeGreaterThan(0)
  })

  it('orders by patch when major+minor tie', () => {
    expect(cmpVersions('1.2.4', '1.2.3')).toBeGreaterThan(0)
    expect(cmpVersions('1.2.3', '1.2.4')).toBeLessThan(0)
  })

  it('handles a zero part on the deciding segment (falsy short-circuit)', () => {
    // i=1: left side is 0 (falsy → || 0), right side is 5
    expect(cmpVersions('1.0.0', '1.5.0')).toBeLessThan(0)
    expect(cmpVersions('1.5.0', '1.0.0')).toBeGreaterThan(0)
  })

  it('handles a missing part on the deciding segment', () => {
    // i=2: left side is undefined (→ || 0), right side is 5
    expect(cmpVersions('1.2', '1.2.5')).toBeLessThan(0)
  })

  it('treats missing parts as 0', () => {
    expect(cmpVersions('1.2', '1.2.0')).toBe(0)
    expect(cmpVersions('1', '1.0.0')).toBe(0)
    expect(cmpVersions('1.2.1', '1.2')).toBeGreaterThan(0)
  })

  it('coerces non-numeric parts to 0', () => {
    expect(cmpVersions('1.2.x', '1.2.0')).toBe(0)
    expect(cmpVersions('abc', '0.0.0')).toBe(0)
  })

  it('only compares the major.minor.patch triple (ignores a 4th segment)', () => {
    expect(cmpVersions('1.2.3.4', '1.2.3.9')).toBe(0)
  })
})
