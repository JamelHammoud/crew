import type { BrowserWindowConstructorOptions } from 'electron'

// The tray panel. Never `skipTaskbar`: on macOS that turns the app into an
// accessory, and the icon leaves the dock and does not come back.
export function createPanelOptions(
  preload: string,
  size: { width: number; height: number }
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
      sandbox: false
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
  size: { width: number; height: number }
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
    focusable: !isMac,
    acceptFirstMouse: true,
    title: 'Crew',
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  }
}

export function createWindowOptions(
  platform: NodeJS.Platform,
  preload: string
): BrowserWindowConstructorOptions {
  const isWindows = platform === 'win32'

  return {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    transparent: !isWindows,
    backgroundColor: isWindows ? '#141414' : '#00000000',
    resizable: true,
    maximizable: true,
    title: 'Crew',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 27 },
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: false,
      spellcheck: true,
      webviewTag: true
    }
  }
}
