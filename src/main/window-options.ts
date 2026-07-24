import type { BrowserWindowConstructorOptions } from 'electron'

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
    title: 'crew',
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
