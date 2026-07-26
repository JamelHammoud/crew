import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useBrowser } from './state/browser'
import { applyPlatform } from './state/platform'
import { useCrew } from './state/store'
import { applyTheme, showTheme, storedTheme } from './state/theme'
import { publishPresence } from './state/trayPresence'
import TrayPanel from './views/TrayPanel'
import './styles.css'

const tray = window.location.hash === '#tray'
const root = document.getElementById('root')!

applyPlatform()
// The tray panel wears the theme the app picked rather than picking one itself.
if (tray) showTheme(storedTheme())
else applyTheme(storedTheme())

if (!tray) {
  void useCrew.getState().boot()
  publishPresence()
  window.crew.onFullScreen(full => root.classList.toggle('square', full))
  window.crew.onOpenUrl(url => useBrowser.getState().openUrl(url))
}

createRoot(root).render(<React.StrictMode>{tray ? <TrayPanel /> : <App />}</React.StrictMode>)
