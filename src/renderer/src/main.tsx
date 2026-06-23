import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useStore } from './store/useStore'
import { buildStandaloneHtml } from './markdown/exportDoc'
import './styles/theme.css'
import './styles/app.css'
import './styles/markdown.css'

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
