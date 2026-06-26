import { promises as fs } from 'fs'
import { join, relative } from 'path'

export const MD_EXTENSIONS = ['.md', '.markdown', '.mdx']

// Files Orchid surfaces: markdown first, plus common text/code files so created
// files show up and code gets syntax highlighting.
export const TEXT_EXTENSIONS = [
  ...MD_EXTENSIONS,
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.csv',
  '.py',
  '.swift',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.hpp',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.sh',
  '.css',
  '.html',
  '.xml',
  '.sql'
]

// Binary formats Orchid can display but not read as text (rendered by a viewer).
export const MEDIA_EXTENSIONS = ['.pdf']

// Everything surfaced in the sidebar = readable text/code + viewable media.
const SHOWN_EXTENSIONS = [...TEXT_EXTENSIONS, ...MEDIA_EXTENSIONS]

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

function isShown(name: string): boolean {
  const lower = name.toLowerCase()
  return SHOWN_EXTENSIONS.some((ext) => lower.endsWith(ext))
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
      // Keep every non-ignored directory — even empty ones — so a folder you
      // just created shows up immediately (and stays visible as you fill it).
      const children = await scanFolder(root, fullPath)
      nodes.push({
        name,
        path: fullPath,
        relPath: relative(root, fullPath),
        type: 'dir',
        children
      })
    } else if (entry.isFile() && isShown(name)) {
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
