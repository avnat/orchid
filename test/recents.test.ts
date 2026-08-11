import { describe, it, expect } from 'vitest'
import { addRecent, pruneRecents, type RecentEntry } from '../src/main/recents'

const f = (p: string, kind: RecentEntry['kind'] = 'file'): RecentEntry => ({
  path: p,
  kind,
  name: p.slice(p.lastIndexOf('/') + 1)
})

describe('addRecent', () => {
  it('prepends a new entry (newest first)', () => {
    const out = addRecent([f('/a'), f('/b')], f('/c'), 20)
    expect(out.map((e) => e.path)).toEqual(['/c', '/a', '/b'])
  })

  it('moves an existing path back to the top without duplicating', () => {
    const out = addRecent([f('/a'), f('/b'), f('/c')], f('/c'), 20)
    expect(out.map((e) => e.path)).toEqual(['/c', '/a', '/b'])
  })

  it('caps the list, dropping the oldest', () => {
    const out = addRecent([f('/a'), f('/b'), f('/c')], f('/d'), 3)
    expect(out.map((e) => e.path)).toEqual(['/d', '/a', '/b'])
  })

  it('treats a cap of 0 (or negative) as an empty list', () => {
    expect(addRecent([f('/a')], f('/b'), 0)).toEqual([])
    expect(addRecent([f('/a')], f('/b'), -5)).toEqual([])
  })

  it('adds to an empty list', () => {
    expect(addRecent([], f('/a'), 20).map((e) => e.path)).toEqual(['/a'])
  })
})

describe('pruneRecents', () => {
  it('keeps only entries whose path exists', () => {
    const alive = new Set(['/a', '/c'])
    const out = pruneRecents([f('/a'), f('/b'), f('/c')], (p) => alive.has(p))
    expect(out.map((e) => e.path)).toEqual(['/a', '/c'])
  })

  it('returns an empty list when nothing exists', () => {
    expect(pruneRecents([f('/a'), f('/b')], () => false)).toEqual([])
  })

  it('returns everything when all exist', () => {
    expect(pruneRecents([f('/a')], () => true).map((e) => e.path)).toEqual(['/a'])
  })

  it('handles an empty input', () => {
    expect(pruneRecents([], () => true)).toEqual([])
  })
})
