import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useBrowser } from './state/browser'
import { useCrew } from './state/store'
import { applyTheme, storedTheme } from './state/theme'
import './styles.css'

applyTheme(storedTheme())
void useCrew.getState().boot()

const root = document.getElementById('root')!
window.crew.onFullScreen(full => root.classList.toggle('square', full))
window.crew.onOpenUrl(url => useBrowser.getState().openUrl(url))

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
