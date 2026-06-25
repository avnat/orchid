// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanFolder, MD_EXTENSIONS, TEXT_EXTENSIONS } from '../src/main/fs-scan'

let root: string

async function write(rel: string, content = 'x'): Promise<void> {
  const full = join(root, rel)
  await fs.mkdir(join(full, '..'), { recursive: true })
  await fs.writeFile(full, content, 'utf8')
}

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'orchid-scan-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('extension lists', () => {
  it('TEXT_EXTENSIONS includes all markdown extensions', () => {
    for (const ext of MD_EXTENSIONS) expect(TEXT_EXTENSIONS).toContain(ext)
  })
})

describe('scanFolder', () => {
  it('returns [] for a non-existent directory', async () => {
    expect(await scanFolder(join(root, 'does-not-exist'))).toEqual([])
  })

  it('returns [] for an empty directory', async () => {
    expect(await scanFolder(root)).toEqual([])
  })

  it('surfaces markdown, code, and text files with mtime', async () => {
    await write('readme.md')
    await write('script.py')
    await write('notes.txt')
    const nodes = await scanFolder(root)
    expect(nodes.map((n) => n.name)).toEqual(['notes.txt', 'readme.md', 'script.py'])
    expect(nodes[0].type).toBe('file')
    expect(typeof nodes[0].mtimeMs).toBe('number')
    expect(nodes[0].mtimeMs).toBeGreaterThan(0)
  })

  it('sets relPath relative to the scan root', async () => {
    await write('sub/deep/a.md')
    const sub = (await scanFolder(root))[0]
    const deep = sub.children![0]
    const file = deep.children![0]
    expect(file.relPath).toBe(join('sub', 'deep', 'a.md'))
    expect(sub.relPath).toBe('sub')
  })

  it('ignores files without a surfaced extension', async () => {
    await write('image.png')
    await write('binary.bin')
    expect(await scanFolder(root)).toEqual([])
  })

  it('skips dotfiles and dot-directories', async () => {
    await write('.secret.md')
    await write('.config/a.md')
    await write('visible.md')
    const nodes = await scanFolder(root)
    expect(nodes.map((n) => n.name)).toEqual(['visible.md'])
  })

  it('skips noise directories like node_modules', async () => {
    await write('node_modules/pkg/readme.md')
    await write('dist/out.md')
    await write('keep.md')
    const nodes = await scanFolder(root)
    expect(nodes.map((n) => n.name)).toEqual(['keep.md'])
  })

  it('keeps directories that lead to markdown and prunes empty ones', async () => {
    await write('docs/guide.md')
    await fs.mkdir(join(root, 'empty'), { recursive: true })
    await write('assets/logo.png') // no surfaced files → pruned
    const nodes = await scanFolder(root)
    expect(nodes.map((n) => n.name)).toEqual(['docs'])
    expect(nodes[0].type).toBe('dir')
    expect(nodes[0].children!.map((c) => c.name)).toEqual(['guide.md'])
  })

  it('still lists a file with mtime 0 when stat fails', async () => {
    await write('a.md')
    const statSpy = vi.spyOn(fs, 'stat').mockRejectedValueOnce(new Error('stat failed'))
    const nodes = await scanFolder(root)
    expect(nodes.map((n) => n.name)).toEqual(['a.md'])
    expect(nodes[0].mtimeMs).toBe(0)
    statSpy.mockRestore()
  })

  it('sorts directories before files, then by natural name order', async () => {
    // adir sorts before the files, zdir after — so the comparator is exercised
    // with (dir, file) and (file, dir) in both directions.
    await write('adir/inner.md')
    await write('zdir/inner.md')
    await write('b.md')
    await write('a.md')
    await write('file10.md')
    await write('file2.md')
    const nodes = await scanFolder(root)
    expect(nodes.map((n) => n.name)).toEqual(['adir', 'zdir', 'a.md', 'b.md', 'file2.md', 'file10.md'])
  })
})
