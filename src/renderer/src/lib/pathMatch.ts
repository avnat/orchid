// Fuzzy matching for the ⌘P palette, VS Code-style: the query matches against
// the file's whole workspace-relative path, not just its name. Space-separated
// terms must all match. Pure logic (no react/electron) so it's unit-testable.

/**
 * Subsequence match of `q` inside `t`. Returns a score (lower is better:
 * contiguous, early matches are cheapest) or -1 when `q` is not a
 * subsequence of `t`.
 */
function subseqScore(q: string, t: string): number {
  let qi = 0
  let score = 0
  let last = -1
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += i - last // 1 for a contiguous hit, more for each gap skipped
      last = i
      qi++
    }
  }
  return qi === q.length ? score : -1
}

/**
 * Score `query` against a file. Every whitespace-separated term must match —
 * against the file name if possible (cheap), else anywhere in the relative
 * path (penalised, so name hits always outrank path-only hits). Terms
 * containing "/" are matched against the path directly. Returns -1 for no
 * match; otherwise lower is better; the empty query matches everything at 0.
 */
export function pathMatchScore(query: string, name: string, relPath: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const base = name.toLowerCase()
  const path = relPath.toLowerCase()
  let total = 0
  for (const term of q.split(/\s+/)) {
    const nameHit = term.includes('/') ? -1 : subseqScore(term, base)
    if (nameHit >= 0) {
      total += nameHit
      continue
    }
    const pathHit = subseqScore(term, path)
    if (pathHit < 0) return -1
    total += 100 + pathHit // a path-only hit ranks below any name hit
  }
  return total
}
