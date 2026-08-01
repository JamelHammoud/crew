import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyAppIcon, storedAppIcon } from './state/appIcon'
import { publishAwake } from './state/awake'
import { useBrowser } from './state/browser'
import { applyPlatform } from './state/platform'
import { publishScribe } from './state/scribeSettings'
import { useCrew } from './state/store'
import { applyTheme, showTheme, storedTheme } from './state/theme'
import { publishPresence } from './state/trayPresence'
import { setFullScreen } from './state/windowShape'
import ScribeWindow from './views/ScribeWindow'
import ThreadWindow from './views/ThreadWindow'
import TrayPanel from './views/TrayPanel'
import { threadIdInHash } from '../../shared/threadViews'
import './styles.css'

// One renderer, four windows. The app itself, a thread somebody popped out, the
// panel under the menu bar, and the pill that stands over whatever you are
// dictating into. The last two are this machine talking to itself and join
// nothing; a popped out thread is the app's own session seen through one thread,
// so it boots the way the app does.
const WINDOWS: Record<string, () => JSX.Element> = {
  '#tray': TrayPanel,
  '#scribe': ScribeWindow
}

const hash = window.location.hash
const popped = threadIdInHash(hash) !== null
const Aside = popped ? ThreadWindow : (WINDOWS[hash] ?? null)
const joins = Aside === null || popped
const root = document.getElementById('root')!

applyPlatform()
// The windows beside the app wear the theme the app picked rather than picking
// one of their own.
if (Aside === null) applyTheme(storedTheme())
else showTheme(storedTheme())
if (hash === '#scribe') root.classList.add('bare')

if (joins) {
  void useCrew.getState().boot()
  window.crew.onWindowShape(shape => {
    root.classList.toggle('square', shape.square)
    setFullScreen(shape.full)
  })
  window.crew.onOpenUrl(url => useBrowser.getState().openUrl(url))
}

// What this machine says about itself is said by the app's own window and not by
// a thread standing beside it. Two windows saying the same thing is one of them
// spending a message on nothing, and the dock has one icon however many windows
// are open.
if (Aside === null) {
  publishPresence()
  publishScribe()
  publishAwake()
  applyAppIcon(storedAppIcon())
}

createRoot(root).render(
  <React.StrictMode>{Aside === null ? <App /> : <Aside />}</React.StrictMode>
)
