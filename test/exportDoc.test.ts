import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildStandaloneHtml } from '../src/renderer/src/markdown/exportDoc'

function setReading(inner: string): void {
  const el = document.createElement('div')
  el.className = 'reading'
  el.innerHTML = inner
  document.body.appendChild(el)
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildStandaloneHtml', () => {
  it('returns null when there is no rendered preview', async () => {
    expect(await buildStandaloneHtml('Doc')).toBeNull()
  })

  it('embeds the title and the rendered content', async () => {
    setReading('<h1>Hello</h1><p>world</p>')
    const html = await buildStandaloneHtml('My Title')
    expect(html).toContain('<title>My Title</title>')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('world')
    expect(html).toContain('data-theme="bloom"')
  })

  it('uses the default Orchid accent when none is stored', async () => {
    setReading('<p>x</p>')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('--accent:#7c4dd6')
  })

  it('uses a stored preset accent (light hex)', async () => {
    localStorage.setItem('orchid.accent', 'teal')
    setReading('<p>x</p>')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('--accent:#0f9b91')
  })

  it('uses the custom hex when accent is custom', async () => {
    localStorage.setItem('orchid.accent', 'custom')
    localStorage.setItem('orchid.customAccent', '#abcdef')
    setReading('<p>x</p>')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('--accent:#abcdef')
  })

  it('falls back to the default hex when custom is set but no colour stored', async () => {
    localStorage.setItem('orchid.accent', 'custom')
    setReading('<p>x</p>')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('--accent:#7c4dd6')
  })

  it('falls back to the default accent when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setReading('<p>x</p>')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('--accent:#7c4dd6')
  })

  it('inlines the applied CSS rules', async () => {
    const style = document.createElement('style')
    style.textContent = '.reading { color: rgb(1, 2, 3); }'
    document.head.appendChild(style)
    setReading('<p>x</p>')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('rgb(1, 2, 3)')
  })

  it('skips stylesheets whose rules cannot be read (cross-origin)', async () => {
    const ok = document.createElement('style')
    ok.textContent = '.ok { color: green; }'
    document.head.appendChild(ok)
    const bad = document.createElement('style')
    bad.textContent = '.bad { color: red; }'
    document.head.appendChild(bad)
    // Simulate a cross-origin sheet that throws on access.
    Object.defineProperty(bad.sheet as CSSStyleSheet, 'cssRules', {
      get() {
        throw new Error('cross-origin')
      }
    })
    setReading('<p>x</p>')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('green') // readable sheet still collected
    expect(html).not.toContain('.bad') // unreadable one skipped, no throw
  })

  it('inlines orchid-asset images as data URIs', async () => {
    const blob = new Blob(['IMG'], { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) })
    vi.stubGlobal('fetch', fetchMock)
    setReading('<img src="orchid-asset://local/pic.png" />')
    const html = await buildStandaloneHtml('Doc')
    expect(fetchMock).toHaveBeenCalledWith('orchid-asset://local/pic.png')
    expect(html).toContain('src="data:')
    expect(html).not.toContain('orchid-asset:')
  })

  it('leaves non-orchid-asset images untouched', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setReading('<img src="https://example.com/p.png" />')
    const html = await buildStandaloneHtml('Doc')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(html).toContain('https://example.com/p.png')
  })

  it('leaves an image as-is when fetching it fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)
    setReading('<img src="orchid-asset://local/x.png" />')
    const html = await buildStandaloneHtml('Doc')
    expect(html).toContain('orchid-asset://local/x.png')
  })

  it('handles an image element with no src attribute', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    setReading('<img alt="no src" />')
    const html = await buildStandaloneHtml('Doc')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(html).toContain('alt="no src"')
  })
})
