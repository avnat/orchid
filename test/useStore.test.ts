import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WorkspaceFolder, MdNode } from '../src/renderer/src/types'

// Each test gets a fresh module instance so the singleton store re-reads
// localStorage at creation time (covers the persisted-init branches).
async function freshStore(seed?: Record<string, string>) {
  vi.resetModules()
  localStorage.clear()
  if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v)
  const mod = await import('../src/renderer/src/store/useStore')
  return mod.useStore
}

function file(path: string, extra: Partial<MdNode> = {}): MdNode {
  return { name: path.split('/').pop()!, path, relPath: path, type: 'file', ...extra }
}
function dir(path: string, children: MdNode[]): MdNode {
  return { name: path.split('/').pop()!, path, relPath: path, type: 'dir', children }
}
function folder(root: string, tree: MdNode[], extra: Partial<WorkspaceFolder> = {}): WorkspaceFolder {
  return { root, name: root.split('/').pop()!, tree, ...extra }
}

const orchidMock = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  move: vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { orchid: typeof orchidMock }).orchid = orchidMock
})

describe('initial state', () => {
  it('uses sensible defaults with empty localStorage', async () => {
    const useStore = await freshStore()
    const s = useStore.getState()
    expect(s.appearance).toBe('system')
    expect(s.accentKey).toBe('orchid')
    expect(s.customAccent).toBe('#7c4dd6')
    expect(s.sortMode).toBe('name')
    expect(s.tocVisible).toBe(true)
    expect(s.sidebarWidth).toBe(248)
    expect(s.tocWidth).toBe(210)
    expect(s.splitRatio).toBe(0.5)
    expect(s.pinned).toEqual([])
  })

  it('hydrates persisted values', async () => {
    const useStore = await freshStore({
      'orchid.appearance': 'dark',
      'orchid.accent': 'teal',
      'orchid.toc': 'false',
      'orchid.sort': 'recent',
      'orchid.pinned': JSON.stringify(['/a.md'])
    })
    const s = useStore.getState()
    expect(s.appearance).toBe('dark')
    expect(s.accentKey).toBe('teal')
    expect(s.tocVisible).toBe(false)
    expect(s.sortMode).toBe('recent')
    expect(s.pinned).toEqual(['/a.md'])
  })

  it('clamps persisted widths and split ratio into range', async () => {
    const tooBig = await freshStore({
      'orchid.sidebarW': '9999',
      'orchid.tocW': '9999',
      'orchid.split': '0.99'
    })
    expect(tooBig.getState().sidebarWidth).toBe(520)
    expect(tooBig.getState().tocWidth).toBe(420)
    expect(tooBig.getState().splitRatio).toBe(0.75)

    const tooSmall = await freshStore({
      'orchid.sidebarW': '1',
      'orchid.tocW': '1',
      'orchid.split': '0.01'
    })
    expect(tooSmall.getState().sidebarWidth).toBe(180)
    expect(tooSmall.getState().tocWidth).toBe(140)
    expect(tooSmall.getState().splitRatio).toBe(0.25)
  })

  it('falls back to defaults for non-numeric persisted widths', async () => {
    const useStore = await freshStore({ 'orchid.sidebarW': 'abc', 'orchid.tocW': 'abc', 'orchid.split': 'xyz' })
    expect(useStore.getState().sidebarWidth).toBe(248)
    expect(useStore.getState().tocWidth).toBe(210)
    expect(useStore.getState().splitRatio).toBe(0.5)
  })

  it('recovers from corrupt pinned JSON', async () => {
    const useStore = await freshStore({ 'orchid.pinned': 'not-json{' })
    expect(useStore.getState().pinned).toEqual([])
  })

  it('survives localStorage that throws (private mode)', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const useStore = await freshStore()
    expect(useStore.getState().appearance).toBe('system')
    expect(useStore.getState().pinned).toEqual([])
    getItem.mockRestore()
  })
})

describe('setWorkspace', () => {
  it('stores folders', async () => {
    const useStore = await freshStore()
    useStore.getState().setWorkspace([folder('/w', [file('/w/a.md')])])
    expect(useStore.getState().folders).toHaveLength(1)
  })

  it('prunes pinned paths whose files left the workspace', async () => {
    const useStore = await freshStore({ 'orchid.pinned': JSON.stringify(['/w/a.md', '/w/gone.md']) })
    useStore.getState().setWorkspace([folder('/w', [file('/w/a.md')])])
    expect(useStore.getState().pinned).toEqual(['/w/a.md'])
    expect(JSON.parse(localStorage.getItem('orchid.pinned')!)).toEqual(['/w/a.md'])
  })

  it('keeps pinned untouched when nothing was pruned', async () => {
    const useStore = await freshStore({ 'orchid.pinned': JSON.stringify(['/w/a.md']) })
    useStore.getState().setWorkspace([folder('/w', [file('/w/a.md')])])
    expect(useStore.getState().pinned).toEqual(['/w/a.md'])
  })

  it('clears the active file when it no longer exists', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/w/a.md', content: 'hi', savedContent: 'hi', editMode: true })
    useStore.getState().setWorkspace([folder('/w', [file('/w/b.md')])])
    expect(useStore.getState().activePath).toBeNull()
    expect(useStore.getState().content).toBe('')
    expect(useStore.getState().editMode).toBe(false)
  })

  it('keeps the active file when it still exists (nested in a dir)', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/w/sub/a.md', content: 'hi', savedContent: 'hi' })
    useStore.getState().setWorkspace([folder('/w', [dir('/w/sub', [file('/w/sub/a.md')])])])
    expect(useStore.getState().activePath).toBe('/w/sub/a.md')
  })

  it('does not drop the active file while a select is in flight', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/w/a.md' })
    useStore.getState().setWorkspace([folder('/w', [file('/w/b.md')])], '/w/b.md')
    expect(useStore.getState().activePath).toBe('/w/a.md')
  })
})

describe('persisted setters', () => {
  it('setSortMode persists', async () => {
    const useStore = await freshStore()
    useStore.getState().setSortMode('recent')
    expect(useStore.getState().sortMode).toBe('recent')
    expect(localStorage.getItem('orchid.sort')).toBe('recent')
  })

  it('setSidebarWidth rounds and clamps', async () => {
    const useStore = await freshStore()
    useStore.getState().setSidebarWidth(300.6)
    expect(useStore.getState().sidebarWidth).toBe(301)
    useStore.getState().setSidebarWidth(9999)
    expect(useStore.getState().sidebarWidth).toBe(520)
  })

  it('setTocWidth rounds and clamps', async () => {
    const useStore = await freshStore()
    useStore.getState().setTocWidth(50)
    expect(useStore.getState().tocWidth).toBe(140)
  })

  it('setSidebarTextSize / setTocTextSize persist', async () => {
    const useStore = await freshStore()
    useStore.getState().setSidebarTextSize('lg')
    useStore.getState().setTocTextSize('sm')
    expect(useStore.getState().sidebarTextSize).toBe('lg')
    expect(useStore.getState().tocTextSize).toBe('sm')
    expect(localStorage.getItem('orchid.sideText')).toBe('lg')
    expect(localStorage.getItem('orchid.tocText')).toBe('sm')
  })

  it('setSplitRatio clamps', async () => {
    const useStore = await freshStore()
    useStore.getState().setSplitRatio(0.9)
    expect(useStore.getState().splitRatio).toBe(0.75)
  })

  it('setSplitRatio ignores localStorage failures', async () => {
    const useStore = await freshStore()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => useStore.getState().setSplitRatio(0.4)).not.toThrow()
    expect(useStore.getState().splitRatio).toBe(0.4)
    setItem.mockRestore()
  })
})

describe('pinning', () => {
  it('togglePin adds then removes', async () => {
    const useStore = await freshStore()
    useStore.getState().togglePin('/a.md')
    expect(useStore.getState().pinned).toEqual(['/a.md'])
    useStore.getState().togglePin('/a.md')
    expect(useStore.getState().pinned).toEqual([])
  })
})

describe('renamePath', () => {
  it('rewrites a pinned path and the active path', async () => {
    const useStore = await freshStore({ 'orchid.pinned': JSON.stringify(['/a.md']) })
    useStore.setState({ activePath: '/a.md' })
    useStore.getState().renamePath('/a.md', '/b.md')
    expect(useStore.getState().pinned).toEqual(['/b.md'])
    expect(useStore.getState().activePath).toBe('/b.md')
  })

  it('leaves an unrelated active path alone', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/other.md' })
    useStore.getState().renamePath('/a.md', '/b.md')
    expect(useStore.getState().activePath).toBe('/other.md')
  })

  it('leaves a pin list untouched when none of the pins were renamed', async () => {
    const useStore = await freshStore({ 'orchid.pinned': JSON.stringify(['/keep.md']) })
    localStorage.setItem('orchid.pinned', JSON.stringify(['/keep.md']))
    useStore.getState().renamePath('/a.md', '/b.md')
    expect(useStore.getState().pinned).toEqual(['/keep.md'])
  })
})

describe('setRenaming', () => {
  it('sets and clears the inline-rename target', async () => {
    const useStore = await freshStore()
    useStore.getState().setRenaming('/a.md')
    expect(useStore.getState().renaming).toBe('/a.md')
    useStore.getState().setRenaming(null)
    expect(useStore.getState().renaming).toBeNull()
  })
})

describe('commitRename', () => {
  it('clears renaming and no-ops on an empty name', async () => {
    const useStore = await freshStore()
    useStore.setState({ renaming: '/a.md' })
    await useStore.getState().commitRename('/a.md', '   ')
    expect(useStore.getState().renaming).toBeNull()
    expect(orchidMock.rename).not.toHaveBeenCalled()
  })

  it('no-ops when the name is unchanged', async () => {
    const useStore = await freshStore()
    await useStore.getState().commitRename('/dir/a.md', 'a.md')
    expect(orchidMock.rename).not.toHaveBeenCalled()
  })

  it('renames via the bridge and repoints state', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/dir/a.md' })
    orchidMock.rename.mockResolvedValue('/dir/b.md')
    await useStore.getState().commitRename('/dir/a.md', 'b.md')
    expect(orchidMock.rename).toHaveBeenCalledWith('/dir/a.md', 'b.md')
    expect(useStore.getState().activePath).toBe('/dir/b.md')
  })

  it('alerts on a rename error', async () => {
    const useStore = await freshStore()
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    orchidMock.rename.mockRejectedValue(new Error('name taken'))
    await useStore.getState().commitRename('/dir/a.md', 'b.md')
    expect(alert).toHaveBeenCalledWith('name taken')
    alert.mockRestore()
  })

  it('stringifies non-Error rejections', async () => {
    const useStore = await freshStore()
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    orchidMock.rename.mockRejectedValue('boom')
    await useStore.getState().commitRename('/dir/a.md', 'b.md')
    expect(alert).toHaveBeenCalledWith('boom')
    alert.mockRestore()
  })
})

describe('commitMove', () => {
  it('repoints when the path changed', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md' })
    orchidMock.move.mockResolvedValue('/sub/a.md')
    await useStore.getState().commitMove('/a.md', '/sub')
    expect(useStore.getState().activePath).toBe('/sub/a.md')
  })

  it('does nothing extra when the path is unchanged', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md' })
    orchidMock.move.mockResolvedValue('/a.md')
    await useStore.getState().commitMove('/a.md', '/')
    expect(useStore.getState().activePath).toBe('/a.md')
  })

  it('alerts on a move error', async () => {
    const useStore = await freshStore()
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    orchidMock.move.mockRejectedValue(new Error('cannot move'))
    await useStore.getState().commitMove('/a.md', '/sub')
    expect(alert).toHaveBeenCalledWith('cannot move')
    alert.mockRestore()
  })

  it('stringifies a non-Error move rejection', async () => {
    const useStore = await freshStore()
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    orchidMock.move.mockRejectedValue('nope')
    await useStore.getState().commitMove('/a.md', '/sub')
    expect(alert).toHaveBeenCalledWith('nope')
    alert.mockRestore()
  })
})

describe('selectFile', () => {
  it('loads content for a readable file', async () => {
    const useStore = await freshStore()
    orchidMock.readFile.mockResolvedValue('# hi')
    await useStore.getState().selectFile('/a.md')
    const s = useStore.getState()
    expect(s.activePath).toBe('/a.md')
    expect(s.content).toBe('# hi')
    expect(s.savedContent).toBe('# hi')
    expect(s.unsupported).toBe(false)
  })

  it('opens a PDF without reading it as text', async () => {
    const useStore = await freshStore()
    useStore.setState({ editMode: true })
    await useStore.getState().selectFile('/report.pdf')
    const s = useStore.getState()
    expect(s.activePath).toBe('/report.pdf')
    expect(s.content).toBe('')
    expect(s.unsupported).toBe(false)
    expect(s.editMode).toBe(false)
    expect(orchidMock.readFile).not.toHaveBeenCalled()
  })

  it('marks unsupported when the read fails (binary)', async () => {
    const useStore = await freshStore()
    orchidMock.readFile.mockRejectedValue(new Error('binary'))
    await useStore.getState().selectFile('/img.png')
    const s = useStore.getState()
    expect(s.unsupported).toBe(true)
    expect(s.content).toBe('')
    expect(s.editMode).toBe(false)
  })

  it('confirms before discarding unsaved edits, and aborts on cancel', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'edited', savedContent: 'orig' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await useStore.getState().selectFile('/b.md')
    expect(confirm).toHaveBeenCalled()
    expect(orchidMock.readFile).not.toHaveBeenCalled()
    expect(useStore.getState().activePath).toBe('/a.md')
    confirm.mockRestore()
  })

  it('proceeds when the discard is confirmed', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'edited', savedContent: 'orig' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    orchidMock.readFile.mockResolvedValue('B')
    await useStore.getState().selectFile('/b.md')
    expect(useStore.getState().activePath).toBe('/b.md')
    expect(useStore.getState().content).toBe('B')
    confirm.mockRestore()
  })

  it('does not prompt when re-selecting the same file', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'edited', savedContent: 'orig' })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    orchidMock.readFile.mockResolvedValue('A')
    await useStore.getState().selectFile('/a.md')
    expect(confirm).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
})

describe('content + save + reload', () => {
  it('reloadActive no-ops without an active file', async () => {
    const useStore = await freshStore()
    await useStore.getState().reloadActive()
    expect(orchidMock.readFile).not.toHaveBeenCalled()
  })

  it('reloadActive refreshes content from disk', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'old', savedContent: 'old', conflict: true })
    orchidMock.readFile.mockResolvedValue('new')
    await useStore.getState().reloadActive()
    expect(useStore.getState().content).toBe('new')
    expect(useStore.getState().conflict).toBe(false)
  })

  it('setContent updates the buffer', async () => {
    const useStore = await freshStore()
    useStore.getState().setContent('typing')
    expect(useStore.getState().content).toBe('typing')
  })

  it('save no-ops without an active file', async () => {
    const useStore = await freshStore()
    await useStore.getState().save()
    expect(orchidMock.writeFile).not.toHaveBeenCalled()
  })

  it('save writes content and clears the dirty/conflict flags', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'new', savedContent: 'old', conflict: true })
    orchidMock.writeFile.mockResolvedValue(true)
    await useStore.getState().save()
    expect(orchidMock.writeFile).toHaveBeenCalledWith('/a.md', 'new')
    expect(useStore.getState().savedContent).toBe('new')
    expect(useStore.getState().conflict).toBe(false)
  })
})

describe('view toggles', () => {
  it('toggleEdit / setEditMode', async () => {
    const useStore = await freshStore()
    useStore.getState().toggleEdit()
    expect(useStore.getState().editMode).toBe(true)
    useStore.getState().setEditMode(false)
    expect(useStore.getState().editMode).toBe(false)
  })

  it('toggleFocus', async () => {
    const useStore = await freshStore()
    useStore.getState().toggleFocus()
    expect(useStore.getState().focusMode).toBe(true)
  })

  it('toggleToc persists', async () => {
    const useStore = await freshStore()
    useStore.getState().toggleToc()
    expect(useStore.getState().tocVisible).toBe(false)
    expect(localStorage.getItem('orchid.toc')).toBe('false')
  })

  it('toggleFullscreen hides everything when something is shown', async () => {
    const useStore = await freshStore()
    useStore.setState({ focusMode: false, tocVisible: true })
    useStore.getState().toggleFullscreen()
    expect(useStore.getState().focusMode).toBe(true)
    expect(useStore.getState().tocVisible).toBe(false)
  })

  it('toggleFullscreen brings everything back when all hidden', async () => {
    const useStore = await freshStore()
    useStore.setState({ focusMode: true, tocVisible: false })
    useStore.getState().toggleFullscreen()
    expect(useStore.getState().focusMode).toBe(false)
    expect(useStore.getState().tocVisible).toBe(true)
  })
})

describe('appearance + accent', () => {
  it('setSystemDark', async () => {
    const useStore = await freshStore()
    useStore.getState().setSystemDark(true)
    expect(useStore.getState().systemDark).toBe(true)
  })

  it('setAppearance persists', async () => {
    const useStore = await freshStore()
    useStore.getState().setAppearance('light')
    expect(localStorage.getItem('orchid.appearance')).toBe('light')
  })

  it('setAccent persists', async () => {
    const useStore = await freshStore()
    useStore.getState().setAccent('rose')
    expect(useStore.getState().accentKey).toBe('rose')
    expect(localStorage.getItem('orchid.accent')).toBe('rose')
  })

  it('setCustomAccent stores the hex and switches accent to custom', async () => {
    const useStore = await freshStore()
    useStore.getState().setCustomAccent('#123456')
    expect(useStore.getState().customAccent).toBe('#123456')
    expect(useStore.getState().accentKey).toBe('custom')
    expect(localStorage.getItem('orchid.customAccent')).toBe('#123456')
    expect(localStorage.getItem('orchid.accent')).toBe('custom')
  })
})

describe('multi-selection', () => {
  it('toggleSelected adds then removes', async () => {
    const useStore = await freshStore()
    useStore.getState().toggleSelected('/a')
    expect(useStore.getState().selected).toEqual(['/a'])
    useStore.getState().toggleSelected('/a')
    expect(useStore.getState().selected).toEqual([])
  })

  it('selectMany adds and removes a batch without duplicates', async () => {
    const useStore = await freshStore()
    useStore.setState({ selected: ['/a'] })
    useStore.getState().selectMany(['/a', '/b', '/c'], true)
    expect(useStore.getState().selected.sort()).toEqual(['/a', '/b', '/c'])
    useStore.getState().selectMany(['/b'], false)
    expect(useStore.getState().selected.sort()).toEqual(['/a', '/c'])
  })

  it('setSelected / clearSelected', async () => {
    const useStore = await freshStore()
    useStore.getState().setSelected(['/x', '/y'])
    expect(useStore.getState().selected).toEqual(['/x', '/y'])
    useStore.getState().clearSelected()
    expect(useStore.getState().selected).toEqual([])
  })

  it('setSelectMode(false) also clears the selection', async () => {
    const useStore = await freshStore()
    useStore.setState({ selected: ['/a'], selectMode: true })
    useStore.getState().setSelectMode(false)
    expect(useStore.getState().selectMode).toBe(false)
    expect(useStore.getState().selected).toEqual([])
  })

  it('setSelectMode(true) keeps the selection', async () => {
    const useStore = await freshStore()
    useStore.setState({ selected: ['/a'] })
    useStore.getState().setSelectMode(true)
    expect(useStore.getState().selected).toEqual(['/a'])
  })
})

describe('filter + external changes + conflicts', () => {
  it('setFilter', async () => {
    const useStore = await freshStore()
    useStore.getState().setFilter('readme')
    expect(useStore.getState().filter).toBe('readme')
  })

  it('onExternalChange ignores changes to non-active files', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md' })
    useStore.getState().onExternalChange('/b.md')
    expect(orchidMock.readFile).not.toHaveBeenCalled()
    expect(useStore.getState().conflict).toBe(false)
  })

  it('onExternalChange raises a conflict when there are unsaved edits', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'edited', savedContent: 'orig' })
    useStore.getState().onExternalChange('/a.md')
    expect(useStore.getState().conflict).toBe(true)
    expect(orchidMock.readFile).not.toHaveBeenCalled()
  })

  it('onExternalChange live-reloads when not editing', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'same', savedContent: 'same' })
    orchidMock.readFile.mockResolvedValue('fresh')
    useStore.getState().onExternalChange('/a.md')
    await vi.waitFor(() => expect(useStore.getState().content).toBe('fresh'))
  })

  it('resolveConflict("theirs") reloads from disk', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'mine', savedContent: 'orig', conflict: true })
    orchidMock.readFile.mockResolvedValue('theirs')
    await useStore.getState().resolveConflict('theirs')
    expect(useStore.getState().content).toBe('theirs')
    expect(useStore.getState().conflict).toBe(false)
  })

  it('resolveConflict("mine") saves over the external change', async () => {
    const useStore = await freshStore()
    useStore.setState({ activePath: '/a.md', content: 'mine', savedContent: 'orig', conflict: true })
    orchidMock.writeFile.mockResolvedValue(true)
    await useStore.getState().resolveConflict('mine')
    expect(orchidMock.writeFile).toHaveBeenCalledWith('/a.md', 'mine')
    expect(useStore.getState().conflict).toBe(false)
  })
})
