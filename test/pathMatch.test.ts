import { describe, it, expect } from 'vitest'
import { pathMatchScore } from '../src/renderer/src/lib/pathMatch'

const score = (q: string, rel: string): number =>
  pathMatchScore(q, rel.slice(rel.lastIndexOf('/') + 1), rel)

describe('pathMatchScore', () => {
  it('matches everything with an empty (or blank) query', () => {
    expect(score('', 'notes/prd.md')).toBe(0)
    expect(score('   ', 'notes/prd.md')).toBe(0)
  })

  it('matches a file-name subsequence', () => {
    expect(score('prd', 'notes/prd.md')).toBeGreaterThanOrEqual(0)
    expect(score('pdm', 'notes/prd.md')).toBeGreaterThanOrEqual(0) // p-r-d.-m-d subsequence
  })

  it('returns -1 when nothing matches', () => {
    expect(score('xyz', 'notes/prd.md')).toBe(-1)
  })

  it('matches against the full relative path, not just the name', () => {
    expect(score('notesprd', 'notes/prd.md')).toBeGreaterThanOrEqual(0)
    expect(score('nts', 'notes/prd.md')).toBeGreaterThanOrEqual(0)
  })

  it('supports explicit path queries with slashes', () => {
    expect(score('notes/prd', 'notes/prd.md')).toBeGreaterThanOrEqual(0)
    expect(score('other/prd', 'notes/prd.md')).toBe(-1)
  })

  it('space-separated terms must all match', () => {
    expect(score('notes prd', 'notes/prd.md')).toBeGreaterThanOrEqual(0)
    expect(score('notes zap', 'notes/prd.md')).toBe(-1)
  })

  it('ranks a name hit above a path-only hit', () => {
    // "prd" hits the NAME of notes/prd.md but only the PATH of prd/plan.md
    const nameHit = score('prd', 'notes/prd.md')
    const pathOnly = score('prd', 'prd/plan.md')
    expect(nameHit).toBeLessThan(pathOnly)
  })

  it('ranks contiguous matches above scattered ones', () => {
    expect(score('plan', 'plan.md')).toBeLessThan(score('plan', 'p-l-a-n.md'))
  })

  it('is case-insensitive', () => {
    expect(score('PRD', 'notes/prd.md')).toBeGreaterThanOrEqual(0)
    expect(pathMatchScore('readme', 'README.md', 'README.md')).toBeGreaterThanOrEqual(0)
  })
})
