import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import 'katex/dist/katex.min.css'
import { useStore } from '../store/useStore'
import Mermaid from './Mermaid'

// Allow task-list checkboxes, highlight.js / KaTeX / math class names, and heading ids
// through the sanitizer. (KaTeX & highlight run after sanitize, so their output is trusted.)
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'input'],
  attributes: {
    ...defaultSchema.attributes,
    input: ['type', 'checked', 'disabled'],
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
    div: [...(defaultSchema.attributes?.div ?? []), 'className'],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id']
  }
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(0, i) : path
}

/** Resolve a relative path against a base directory, collapsing ./ and ../ */
function resolvePath(baseDir: string, rel: string): string {
  if (rel.startsWith('/')) return rel
  const parts = baseDir.split('/').concat(rel.split('/'))
  const out: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  return '/' + out.join('/')
}

const isExternal = (href: string): boolean => /^([a-z]+:)?\/\//i.test(href) || href.startsWith('mailto:')

/** Parse and remove a leading YAML frontmatter block. */
function splitFrontmatter(src: string): { meta: [string, string][]; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src)
  if (!m) return { meta: [], body: src }
  const meta: [string, string][] = []
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (kv) meta.push([kv[1], kv[2].replace(/^["']|["']$/g, '')])
  }
  return { meta, body: src.slice(m[0].length) }
}

export default function MarkdownView({ source }: { source: string }): JSX.Element {
  const activePath = useStore((s) => s.activePath)
  const selectFile = useStore((s) => s.selectFile)
  const baseDir = activePath ? dirOf(activePath) : ''

  const components = useMemo(
    () => ({
      // Task-list checkboxes: render uncontrolled + disabled (display only) to
      // avoid React's controlled→uncontrolled warning when `checked` flips.
      input({ type, checked }: { type?: string; checked?: boolean }) {
        if (type === 'checkbox') {
          return <input type="checkbox" defaultChecked={!!checked} disabled />
        }
        return <input type={type} />
      },
      // Render ```mermaid fences as diagrams instead of code blocks.
      pre({ children }: { children?: React.ReactNode }) {
        const child = Array.isArray(children) ? children[0] : children
        const cls: string =
          (child as { props?: { className?: string } })?.props?.className ?? ''
        if (/language-mermaid/.test(cls)) {
          const raw = (child as { props?: { children?: React.ReactNode } }).props?.children
          return <Mermaid code={String(raw)} />
        }
        return <pre>{children}</pre>
      },
      img({ src = '', ...props }: { src?: string; alt?: string }) {
        let resolved = src
        if (src && !isExternal(src) && !src.startsWith('data:') && baseDir) {
          const abs = resolvePath(baseDir, src)
          resolved = `orchid-asset://local/${encodeURIComponent(abs)}`
        }
        return <img src={resolved} {...props} />
      },
      a({ href = '', children, ...props }: { href?: string; children?: React.ReactNode }) {
        const onClick = (e: React.MouseEvent): void => {
          if (isExternal(href)) {
            e.preventDefault()
            window.orchid.openExternal(href)
          } else if (/\.(md|markdown|mdx)$/i.test(href) && baseDir) {
            e.preventDefault()
            void selectFile(resolvePath(baseDir, href))
          }
          // anchors (#…) fall through to default in-page scroll
        }
        return (
          <a href={href} onClick={onClick} {...props}>
            {children}
          </a>
        )
      }
    }),
    [baseDir, selectFile]
  )

  const { meta, body } = useMemo(() => splitFrontmatter(source), [source])

  return (
    <div className="reading">
      {meta.length > 0 && (
        <div className="frontmatter">
          {meta.map(([k, v]) => (
            <span className="fm-item" key={k}>
              <span className="fm-key">{k}</span>
              <span className="fm-val">{v}</span>
            </span>
          ))}
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, schema],
          rehypeSlug,
          rehypeKatex,
          [rehypeHighlight, { ignoreMissing: true }]
        ]}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
