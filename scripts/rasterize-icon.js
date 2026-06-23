// One-off: rasterize resources/icon.svg -> icon.png at 1024 with TRANSPARENT corners.
// Quick Look flattens alpha to white; this uses Electron's Chromium canvas instead.
// Run: npx electron scripts/rasterize-icon.js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const resDir = path.join(__dirname, '..', 'resources')
const svg = fs.readFileSync(path.join(resDir, 'icon.svg'), 'utf8')

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1100, height: 1100 })
  await win.loadURL('about:blank')
  const dataUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = 1024; c.height = 1024
        const x = c.getContext('2d')
        x.clearRect(0, 0, 1024, 1024)
        x.drawImage(img, 0, 0, 1024, 1024)
        try { resolve(c.toDataURL('image/png')) } catch (e) { resolve('ERR:' + e.message) }
      }
      img.onerror = () => resolve('ERR:load')
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)})
    })
  `)
  if (!dataUrl || dataUrl.startsWith('ERR:')) {
    console.error('FAILED', dataUrl)
    app.exit(1)
    return
  }
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
  fs.writeFileSync(path.join(resDir, 'icon.png'), buf)
  console.log('wrote icon.png', buf.length, 'bytes')
  app.quit()
})
