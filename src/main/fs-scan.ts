import { promises as fs } from 'fs'
import { join, relative } from 'path'

export const MD_EXTENSIONS = ['.md', '.markdown', '.mdx']

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'out',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.venv',
  'venv',
  '__pycache__'
])

export interface MdNode {
  name: string
  path: string
  relPath: string
  type: 'dir' | 'file'
  mtimeMs?: number
  children?: MdNode[]
}

function isMarkdown(name: string): boolean {
  const lower = name.toLowerCase()
  return MD_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/**
 * Recursively scan a folder, keeping only markdown files and the directories
 * that lead to them. Noise directories and dotfiles are skipped.
 */
export async function scanFolder(root: string, dir: string = root): Promise<MdNode[]> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: MdNode[] = []

  for (const entry of entries) {
    const name = entry.name
    if (name.startsWith('.')) continue
    const fullPath = join(dir, name)

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(name)) continue
      const children = await scanFolder(root, fullPath)
      if (children.length > 0) {
        nodes.push({
          name,
          path: fullPath,
          relPath: relative(root, fullPath),
          type: 'dir',
          children
        })
      }
    } else if (entry.isFile() && isMarkdown(name)) {
      let mtimeMs = 0
      try {
        mtimeMs = (await fs.stat(fullPath)).mtimeMs
      } catch {
        /* ignore */
      }
      nodes.push({
        name,
        path: fullPath,
        relPath: relative(root, fullPath),
        type: 'file',
        mtimeMs
      })
    }
  }

  // Folders first, then files; each group sorted by name.
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })

  return nodes
}
