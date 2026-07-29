import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useBrowser } from './state/browser'
import { applyPlatform } from './state/platform'
import { publishScribe } from './state/scribeSettings'
import { useCrew } from './state/store'
import { applyTheme, showTheme, storedTheme } from './state/theme'
import { publishPresence } from './state/trayPresence'
import { setFullScreen } from './state/windowShape'
import ScribeWindow from './views/ScribeWindow'
import TrayPanel from './views/TrayPanel'
import './styles.css'

// One renderer, three windows. The app itself, the panel under the menu bar, and
// the pill that stands over whatever you are dictating into. Only the first of
// them joins the session: the other two are this machine talking to itself.
const WINDOWS: Record<string, () => JSX.Element> = {
  '#tray': TrayPanel,
  '#scribe': ScribeWindow
}

const hash = window.location.hash
const Aside: (() => JSX.Element) | undefined = WINDOWS[hash]
const root = document.getElementById('root')!

applyPlatform()
// The windows beside the app wear the theme the app picked rather than picking
// one of their own.
if (Aside) showTheme(storedTheme())
else applyTheme(storedTheme())
if (hash === '#scribe') root.classList.add('bare')

if (!Aside) {
  void useCrew.getState().boot()
  publishPresence()
  publishScribe()
  window.crew.onWindowShape(shape => {
    root.classList.toggle('square', shape.square)
    setFullScreen(shape.full)
  })
  window.crew.onOpenUrl(url => useBrowser.getState().openUrl(url))
}

createRoot(root).render(<React.StrictMode>{Aside ? <Aside /> : <App />}</React.StrictMode>)
