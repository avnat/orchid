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
 * Reuses the live `.reading` DOM + all applied CSS, so the export looks exactly
 * like Orchid (current theme + accent included).
 */
export async function buildStandaloneHtml(title: string): Promise<string | null> {
  const reading = document.querySelector('.reading')
  if (!reading) return null

  const clone = reading.cloneNode(true) as HTMLElement
  await inlineImages(clone)

  const css = collectCss()
  const theme = document.documentElement.dataset.theme ?? 'bloom'
  const rootStyle = document.documentElement.getAttribute('style') ?? ''

  return `<!doctype html>
<html data-theme="${theme}" style="${rootStyle}">
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
