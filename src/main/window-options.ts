import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions } from 'electron'
import type { Theme } from '../shared/theme'

// The tray panel. Never `skipTaskbar`: on macOS that turns the app into an
// accessory, and the icon leaves the dock and does not come back.
export function createPanelOptions(
  preload: string,
  size: { width: number; height: number },
  devTools: boolean
): BrowserWindowConstructorOptions {
  return {
    ...size,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Crew',
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: false,
      devTools
    }
  }
}

// The dictation pill. It floats over whatever app is being typed into, so it
// never takes focus and never appears in the taskbar switcher, and the same
// warning above applies: `skipTaskbar` is what turns the app into an accessory
// on macOS, so only the platforms that need it get it.
//
// `backgroundThrottling` is off because this window runs whisper. Throttled, a
// window nobody is looking at gets a fraction of the frames and a fraction of
// the timers, and the dictation arrives long after the sentence ended.
export function createScribeOptions(
  platform: NodeJS.Platform,
  preload: string,
  size: { width: number; height: number },
  devTools: boolean
): BrowserWindowConstructorOptions {
  const isMac = platform === 'darwin'
  return {
    ...size,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: !isMac,
    // A panel on macOS takes a click without activating the app behind it, so
    // the X and the check work while the caret stays where the dictation is
    // going. Everywhere else the same thing is had by never being focusable.
    ...(isMac ? { type: 'panel' as const } : { focusable: false }),
    acceptFirstMouse: true,
    title: 'Crew',
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      devTools
    }
  }
}

// On a Mac the red button puts a window away rather than takes it down. The
// app is still running, the session is still up, and this machine's agents are
// still the crew's, so a window that was really destroyed would throw away
// everything on screen for a press that means come back to this later. Quitting
// is what ends it, and that is the one time a close is let through.
//
// Everywhere else the close is the way out, and `window-all-closed` is where
// what happens next is decided.
export function closePutsAway(platform: NodeJS.Platform, quitting: boolean): boolean {
  return platform === 'darwin' && !quitting
}

// Everything a window of the app's own wears but the size it opens at. A thread
// stood out on its own is the same window in a narrower column, so the shape,
// the transparency and what the page is allowed are decided once here rather
// than written down twice and left to drift apart.
function windowShell(
  platform: NodeJS.Platform,
  preload: string,
  devTools: boolean,
  theme: Theme | null
): BrowserWindowConstructorOptions {
  const isWindows = platform === 'win32'

  return {
    transparent: !isWindows,
    backgroundColor: isWindows ? '#141414' : '#00000000',
    resizable: true,
    maximizable: true,
    title: 'Crew',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 27 },
    ...(platform === 'darwin' ? { hasShadow: theme !== null && theme !== 'oled' } : {}),
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: false,
      spellcheck: true,
      webviewTag: true,
      devTools
    }
  }
}

export function createWindowOptions(
  platform: NodeJS.Platform,
  preload: string,
  devTools: boolean,
  theme: Theme | null = 'dark'
): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...windowShell(platform, preload, devTools, theme),
    ...(platform === 'darwin' ? { vibrancy: 'under-window' as const } : {})
  }
}

// One thread on its own. It holds a column of messages and nothing beside it,
// so it opens narrow and tall and may be taken in further than the app window
// ever goes.
export function createThreadWindowOptions(
  platform: NodeJS.Platform,
  preload: string,
  devTools: boolean,
  theme: Theme | null = 'dark'
): BrowserWindowConstructorOptions {
  return {
    width: 720,
    height: 900,
    minWidth: 460,
    minHeight: 520,
    ...windowShell(platform, preload, devTools, theme)
  }
}

// Without an application menu the standard clipboard accelerators (copy, cut,
// paste, select-all, undo, redo) are never registered, so they do nothing
// inside the app. Registering the roles wires them up on every platform.
//
// The View menu is written out rather than taken as the `viewMenu` role,
// because that role carries Toggle Developer Tools and its accelerator, and a
// shipped Crew has no dev tools to toggle. Reload and the zoom stay: `⌘R` is
// the app's own and the canvas is written around it.
export function appMenuTemplate(platform: NodeJS.Platform, devTools: boolean): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin'
  return [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    { role: 'fileMenu' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(devTools ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
}
