import { accentByKey } from '../themes'

const lsGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

/** The accent's light-mode hex, so exports stay readable on white regardless of the app theme. */
function lightAccent(): string {
  const key = lsGet('orchid.accent') || 'orchid'
  if (key === 'custom') return lsGet('orchid.customAccent') || '#7c4dd6'
  return accentByKey(key).light
}

/** Collect every CSS rule currently applied in the app (app styles, KaTeX, CodeMirror). */
function collectCss(): string {
  let css = ''
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + '\n'
    } catch {
      /* cross-origin sheet — skip */
    }
  }
  return css
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

/** Inline orchid-asset images as data URIs so the file is portable. */
async function inlineImages(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') ?? ''
      if (!src.startsWith('orchid-asset:')) return
      try {
        const res = await fetch(src)
        const blob = await res.blob()
        img.setAttribute('src', await blobToDataUrl(blob))
      } catch {
        /* leave as-is */
      }
    })
  )
}

/**
 * Build a self-contained HTML document from the currently rendered preview.
 * Reuses the live `.reading` DOM + all applied CSS. Always exported in light
 * mode (white page, dark text) so PDFs and shared files print/read cleanly,
 * regardless of the app's current theme — the chosen accent is kept.
 */
export async function buildStandaloneHtml(title: string): Promise<string | null> {
  const reading = document.querySelector('.reading')
  if (!reading) return null

  const clone = reading.cloneNode(true) as HTMLElement
  await inlineImages(clone)

  const css = collectCss()

  return `<!doctype html>
<html data-theme="bloom" style="--accent:${lightAccent()}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
${css}
html, body { height: auto; overflow: visible; background: var(--bg); }
body { margin: 0; }
.reading { margin: 0 auto; }
</style>
</head>
<body>
<div class="reading">${clone.innerHTML}</div>
</body>
</html>`
}
