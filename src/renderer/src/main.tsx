import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyAppIcon, storedAppIcon } from './state/appIcon'
import { publishAwake } from './state/awake'
import { useBrowser } from './state/browser'
import { applyPlatform } from './state/platform'
import { publishScribe } from './state/scribeSettings'
import { watchShift } from './state/shift'
import { useCrew } from './state/store'
import { applyTheme, showTheme, storedTheme } from './state/theme'
import { publishPresence } from './state/trayPresence'
import { setFullScreen, setWindowPinned } from './state/windowShape'
import { recoverMissingPreload } from './preloadRecovery'
import ScribeWindow from './views/ScribeWindow'
import ThreadWindow from './views/ThreadWindow'
import PersonalChatWindow from './views/PersonalChatWindow'
import BrowserWindow from './views/BrowserWindow'
import StickiesWindow from './views/StickiesWindow'
import TrayPanel from './views/TrayPanel'
import {
  BROWSER_WINDOW_HASH,
  PERSONAL_CHAT_HASH,
  STICKIES_HASH,
  stickyIdInHash,
  threadIdInHash
} from '../../shared/threadViews'
import './styles.css'

recoverMissingPreload(window)

// One renderer, four windows. The app itself, a thread somebody popped out, the
// panel under the menu bar, and the pill that stands over whatever you are
// dictating into. The last two are this machine talking to itself and join
// nothing; a popped out thread is the app's own session seen through one thread,
// so it boots the way the app does.
const WINDOWS: Record<string, () => JSX.Element> = {
  '#tray': TrayPanel,
  '#scribe': ScribeWindow,
  [PERSONAL_CHAT_HASH]: PersonalChatWindow,
  [BROWSER_WINDOW_HASH]: BrowserWindow,
  [STICKIES_HASH]: StickiesWindow
}

const hash = window.location.hash
const popped = threadIdInHash(hash) !== null
const sticky = stickyIdInHash(hash) !== null
const Aside = popped ? ThreadWindow : sticky ? StickiesWindow : (WINDOWS[hash] ?? null)
const joins = Aside === null || popped || sticky || hash === PERSONAL_CHAT_HASH || hash === BROWSER_WINDOW_HASH || hash === STICKIES_HASH
const root = document.getElementById('root')!

if (joins) root.classList.add('native-shell')

applyPlatform()
// The windows beside the app wear the theme the app picked rather than picking
// one of their own.
if (Aside === null) applyTheme(storedTheme())
else showTheme(storedTheme())
if (hash === '#scribe') root.classList.add('bare')

if (joins) {
  watchShift()
  if (!sticky && hash !== STICKIES_HASH) void useCrew.getState().boot()
  window.crew.onWindowShape(shape => {
    root.classList.toggle('square', shape.square)
    setFullScreen(shape.full)
    setWindowPinned(shape.pinned)
  })
  window.crew.onOpenUrl(url => useBrowser.getState().openUrl(url))
  window.crew.onOpenBrowserTab(tab => useBrowser.getState().openWindowTab(tab))
  window.crew.onInsertBrowserTab((tab, to) => useBrowser.getState().insertWindowTab(tab, to))
  window.crew.onMoveBrowserTab((id, to) => useBrowser.getState().dropTab(id, to))
  window.crew.onRemoveBrowserTab(id => {
    useBrowser.getState().closeTab(id)
    if (hash === BROWSER_WINDOW_HASH && useBrowser.getState().tabs.length === 0) window.crew.closeBrowserWindow()
  })
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

createRoot(root).render(<React.StrictMode>{Aside === null ? <App /> : <Aside />}</React.StrictMode>)
