/**
 * Compare semver-ish release tags (leading `v` optional). Returns a positive
 * number when `a` is newer than `b`, negative when older, 0 when equal. Only the
 * major.minor.patch triple is considered; missing parts count as 0.
 */
export function cmpVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  }
  return 0
}
