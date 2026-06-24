import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useStore } from './store/useStore'
import { buildStandaloneHtml } from './markdown/exportDoc'
import { accentByKey } from './themes'
import './styles/theme.css'
import './styles/app.css'
import './styles/markdown.css'

// Apply the saved theme + accent synchronously, before React's first paint, so
// the window never flashes the default Orchid purple/light before snapping to
// the remembered choice. (Falls through to CSS defaults on first ever launch.)
;(function bootTheme(): void {
  try {
    const appr = localStorage.getItem('orchid.appearance') || 'system'
    const dark =
      appr === 'dark' || (appr !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    const root = document.documentElement
    root.dataset.theme = dark ? 'dusk' : 'bloom'
    const accentKey = localStorage.getItem('orchid.accent') || 'orchid'
    const css =
      accentKey === 'custom'
        ? localStorage.getItem('orchid.customAccent') || '#7c4dd6'
        : (() => {
            const a = accentByKey(accentKey)
            return dark ? a.dark : a.light
          })()
    if (css) root.style.setProperty('--accent', css)
  } catch {
    /* localStorage unavailable — CSS defaults stand */
  }
})()

if (import.meta.env.DEV) {
  ;(window as unknown as { __store: typeof useStore }).__store = useStore
  ;(window as unknown as { __buildExport: typeof buildStandaloneHtml }).__buildExport =
    buildStandaloneHtml
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
