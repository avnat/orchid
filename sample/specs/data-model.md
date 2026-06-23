# Data Model

A nested file, to confirm the sidebar preserves folder structure.

## MdNode

```ts
interface MdNode {
  name: string
  path: string
  relPath: string
  type: 'dir' | 'file'
  mtimeMs?: number
  children?: MdNode[]
}
```

Back to [architecture](../architecture.md).
