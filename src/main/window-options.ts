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
