import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { cpp } from '@codemirror/lang-cpp'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { StreamLanguage } from '@codemirror/language'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import type { Extension } from '@codemirror/state'

export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(name)
}

/** CodeMirror language extension for a filename, or null for plain text. */
export function langForFile(name: string): Extension | null {
  const parts = name.toLowerCase().split('.')
  const ext = parts[parts.length - 1]
  switch (ext) {
    case 'md':
    case 'markdown':
    case 'mdx':
      return markdown()
    case 'py':
      return python()
    case 'c':
    case 'h':
    case 'cpp':
    case 'cc':
    case 'hpp':
      return cpp()
    case 'js':
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'json':
      return json()
    case 'swift':
      return StreamLanguage.define(swift)
    case 'sh':
    case 'bash':
    case 'zsh':
      return StreamLanguage.define(shell)
    case 'yml':
    case 'yaml':
      return StreamLanguage.define(yaml)
    default:
      return null
  }
}
