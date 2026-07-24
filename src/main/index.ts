import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  powerSaveBlocker,
  shell,
  Tray,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppSession, type NewAgent } from './session'

app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')

const dirname = path.dirname(fileURLToPath(import.meta.url))
const session = new AppSession()
let tray: Tray | null = null
let balloonShown = false
let resumed: Promise<unknown> = Promise.resolve()

// Without an application menu the standard clipboard accelerators (copy, cut,
// paste, select-all, undo, redo) are never registered, so they do nothing
// inside the app. Registering the roles wires them up on every platform.
function installMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
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
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Right-click clipboard actions for text fields and the doc editor,
// plus spellcheck suggestions (which Electron only exposes through the
// context menu — a custom menu must add them back itself).
function installContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const editable = params.isEditable
    const hasSelection = params.selectionText.trim().length > 0
    const misspelled = editable && params.misspelledWord.length > 0
    if (!editable && !hasSelection) return
    const items: MenuItemConstructorOptions[] = []
    if (misspelled) {
      for (const suggestion of params.dictionarySuggestions) {
        items.push({
          label: suggestion,
          click: () => win.webContents.replaceMisspelling(suggestion)
        })
      }
      if (params.dictionarySuggestions.length === 0) {
        items.push({ label: 'No spelling suggestions', enabled: false })
      }
      items.push({
        label: 'Add to Dictionary',
        click: () =>
          win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
      items.push({ type: 'separator' })
    }
    if (editable) items.push({ role: 'cut', enabled: hasSelection })
    if (editable || hasSelection) items.push({ role: 'copy', enabled: hasSelection })
    if (editable) items.push({ role: 'paste' }, { type: 'separator' }, { role: 'selectAll' })
    Menu.buildFromTemplate(items).popup({ window: win })
  })
}

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') return
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void contents.loadURL(url)
    return { action: 'deny' }
  })
})

function createWindow(): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'crew',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 27 },
    webPreferences: {
      preload: path.join(dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      sandbox: false,
      spellcheck: true,
      webviewTag: true
    }
  })
  const isAppUrl = (url: string) => url.startsWith('file://') || (devUrl ? url.startsWith(devUrl) : false)
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    if (/^https?:/i.test(url)) win.webContents.send('browser:open', url)
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) win.webContents.send('browser:open', url)
    return { action: 'deny' }
  })
  win.on('enter-full-screen', () => win.webContents.send('window:fullscreen', true))
  win.on('leave-full-screen', () => win.webContents.send('window:fullscreen', false))
  installContextMenu(win)
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(dirname, '../renderer/index.html'))
  }
}

function openWindow(): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// The app ships no icon asset, so the tray dot is drawn in memory. It follows
// the system theme: light dot on a dark taskbar, dark dot on a light one.
function trayIcon(): NativeImage {
  const size = 32
  const shade = nativeTheme.shouldUseDarkColors ? 255 : 0
  const center = (size - 1) / 2
  const radius = size * 0.34
  const buffer = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x - center, y - center)))
      const i = (y * size + x) * 4
      buffer[i] = shade
      buffer[i + 1] = shade
      buffer[i + 2] = shade
      buffer[i + 3] = Math.round(alpha * 255)
    }
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: 2 })
}

function refreshTray(): void {
  if (!tray) return
  const active = session.current() !== null
  tray.setToolTip(active ? 'crew is sharing your agents' : 'crew')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: active ? 'Sharing your agents' : 'Not in a session', enabled: false },
      { type: 'separator' },
      { label: 'Open crew', click: openWindow },
      { label: 'Quit crew', click: () => app.quit() }
    ])
  )
}

// On mac the dock already keeps the app alive without a window; everywhere
// else the tray is the handle back to a session running in the background.
function installTray(): void {
  if (process.platform === 'darwin') return
  tray = new Tray(trayIcon())
  tray.on('click', openWindow)
  nativeTheme.on('updated', () => tray?.setImage(trayIcon()))
  refreshTray()
}

app.whenReady().then(() => {
  powerSaveBlocker.start('prevent-app-suspension')
  installMenu()
  installTray()
  session.setAgentsPath(path.join(app.getPath('userData'), 'agents.json'))
  session.setSessionPath(path.join(app.getPath('userData'), 'session.json'))
  resumed = session.resume().then(() => refreshTray())
  ipcMain.handle('folder:pick', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('session:start', async (_event, folder: string, name: string) => {
    const info = await session.startHost(folder, name)
    refreshTray()
    return info
  })
  ipcMain.handle('session:join', async (_event, link: string, folder: string, name: string) => {
    const info = await session.startJoin(link, folder, name)
    refreshTray()
    return info
  })
  ipcMain.handle('session:leave', async () => {
    await session.leave()
    refreshTray()
  })
  ipcMain.handle('session:current', async () => {
    await resumed
    return session.current()
  })
  ipcMain.handle('agents:capabilities', () => session.capabilities())
  ipcMain.handle('agents:install', (_event, provider: string) => session.installProvider(provider))
  ipcMain.handle('agents:create', (_event, input: NewAgent) => session.createAgent(input))
  ipcMain.handle('agents:remove', (_event, instanceId: string) => session.removeAgent(instanceId))
  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle('file:read', (_event, target: string) => session.readFile(target))
  ipcMain.handle('file:reveal', (_event, target: string) => {
    const absolute = session.resolveFile(target)
    if (absolute) shell.showItemInFolder(absolute)
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Closing the window while in a session keeps the app alive so the crew can
// keep using this machine's agents. Quitting still shuts everything down.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  if (!session.current()) {
    app.quit()
    return
  }
  refreshTray()
  if (process.platform === 'win32' && tray && !balloonShown) {
    balloonShown = true
    tray.displayBalloon({
      title: 'crew is still running',
      content: 'Your agents stay shared with your crew. Quit from this icon to stop.'
    })
  }
})

app.on('before-quit', () => {
  void session.shutdown()
})
