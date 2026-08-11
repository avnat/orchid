// Pure helpers for the "Open Recent" list. All disk / menu / IPC wiring lives
// in index.ts; keeping the list logic here makes it unit-testable.

export type RecentKind = 'folder' | 'file'

export interface RecentEntry {
  path: string
  kind: RecentKind
  name: string
}

/**
 * Add an entry to the front of the recents list: newest first, de-duplicated by
 * path (re-opening a path moves it back to the top), and capped in length.
 */
export function addRecent(list: RecentEntry[], entry: RecentEntry, cap: number): RecentEntry[] {
  const deduped = list.filter((e) => e.path !== entry.path)
  return [entry, ...deduped].slice(0, Math.max(0, cap))
}

/** Drop entries whose path no longer exists on disk (checked via `exists`). */
export function pruneRecents(list: RecentEntry[], exists: (path: string) => boolean): RecentEntry[] {
  return list.filter((e) => exists(e.path))
}
