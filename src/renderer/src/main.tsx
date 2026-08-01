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

if (Aside === null) {
  void useCrew.getState().boot()
  publishPresence()
  publishScribe()
  publishAwake()
  // Which icon the dock wears is said again on every start, the way the awake
  // switch is, and only from the window that picked it: the windows beside the app
  // wear its theme without choosing one, and neither of them has a dock to set.
  applyAppIcon(storedAppIcon())
  window.crew.onWindowShape(shape => {
    root.classList.toggle('square', shape.square)
    setFullScreen(shape.full)
  })
  window.crew.onOpenUrl(url => useBrowser.getState().openUrl(url))
}

createRoot(root).render(
  <React.StrictMode>{Aside === null ? <App /> : <Aside />}</React.StrictMode>
)
