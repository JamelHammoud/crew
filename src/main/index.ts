import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  powerSaveBlocker,
  shell,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setBadge, showAlert } from './alerts'
import type { AgentAlert } from '../shared/alerts'
import { copyImage } from './clipboard'
import type { Present } from '../shared/presence'
import { appIcon, type IconTheme } from './icon'
import { CrewTray } from './tray'
import {
  askForMedia,
  installDisplayMedia,
  mediaAccess,
  openMediaSettings,
  pickScreenSource,
  screenSources
} from './media'
import type { MediaKind } from '../shared/media'
import { AppSession, type NewAgent, type OpenOptions } from './session'
import { Terminals, type TerminalSize } from './terminal'
import { createWindowOptions } from './window-options'

app.setName('Crew')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
// Huddle audio arrives without anyone clicking play, and Chromium blocks that
// by default.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const dirname = path.dirname(fileURLToPath(import.meta.url))
const session = new AppSession()
const terminals = new Map<number, Terminals>()
const tray = new CrewTray({
  page: {
    preload: path.join(dirname, '../preload/preload.mjs'),
    devUrl: process.env['ELECTRON_RENDERER_URL'],
    file: path.join(dirname, '../renderer/index.html')
  },
  openWindow: () => openWindow(),
  quit: () => app.quit()
})
let balloonShown = false
let resumed: Promise<unknown> = Promise.resolve()
let iconTheme: IconTheme = 'dark'

// The tray panel is a window like any other as far as Electron is concerned,
// so everything that means "the app's own windows" asks for these.
function appWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter(win => !tray.owns(win))
}

function sharing(): void {
  tray.update({ sharing: session.current() !== null })
}

// The icon is a white mark on black, or the inverse, so it follows the theme
// chosen inside the app rather than the one the system is wearing.
function applyIcon(theme: IconTheme): void {
  iconTheme = theme
  tray.theme(theme)
  if (process.platform === 'darwin') {
    app.dock?.setIcon(appIcon(theme))
    return
  }
  for (const win of appWindows()) win.setIcon(appIcon(theme))
}

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

// Shells belong to the window that opened them, so closing a window takes its
// terminals with it rather than leaving them running with nobody watching.
function terminalsFor(sender: WebContents): Terminals {
  const open = terminals.get(sender.id)
  if (open) return open
  const made = new Terminals()
  terminals.set(sender.id, made)
  sender.once('destroyed', () => {
    made.closeAll()
    terminals.delete(sender.id)
  })
  return made
}

// A login shell reads the whole profile before it says anything, so one is
// started for every window as soon as the folder a terminal would open in is
// known, rather than when somebody asks for a tab and watches it blink.
function warmTerminals(): void {
  const folder = session.projectFolder()
  for (const win of appWindows()) {
    if (!win.webContents.isDestroyed()) terminalsFor(win.webContents).warm(folder)
  }
}

function createWindow(): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const win = new BrowserWindow(
    createWindowOptions(process.platform, path.join(dirname, '../preload/preload.mjs'))
  )
  if (process.platform !== 'darwin') win.setIcon(appIcon(iconTheme))
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
  const syncWindowShape = () =>
    win.webContents.send('window:shape', {
      square: win.isFullScreen() || win.isMaximized(),
      full: win.isFullScreen()
    })
  win.on('maximize', syncWindowShape)
  win.on('unmaximize', syncWindowShape)
  win.on('enter-full-screen', syncWindowShape)
  win.on('leave-full-screen', syncWindowShape)
  installContextMenu(win)
  installDisplayMedia(win.webContents.session)
  win.webContents.on('did-finish-load', syncWindowShape)
  win.webContents.once('did-finish-load', () => {
    warmTerminals()
    tray.warm()
  })
  // Who is here is read from a window's own view of the session, so with none
  // open the tray says so rather than showing a list that stopped moving.
  win.on('closed', () => {
    if (appWindows().length === 0) tray.update({ here: [], known: false })
  })
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(dirname, '../renderer/index.html'))
  }
}

function openWindow(): void {
  tray.hidePanel()
  const win = appWindows()[0]
  if (!win) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

app.whenReady().then(() => {
  powerSaveBlocker.start('prevent-app-suspension')
  applyIcon(iconTheme)
  installMenu()
  tray.install()
  session.setAgentsPath(path.join(app.getPath('userData'), 'agents.json'))
  session.setSessionPath(path.join(app.getPath('userData'), 'session.json'))
  session.setProjectsPath(path.join(app.getPath('userData'), 'projects'))
  resumed = session.resume().then(() => {
    sharing()
    warmTerminals()
  })
  ipcMain.handle('folder:pick', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('session:start', async (_event, folder: string, name: string, opts?: OpenOptions) => {
    const info = await session.startHost(folder, name, opts ?? {})
    sharing()
    warmTerminals()
    return info
  })
  ipcMain.handle('session:plan', (_event, folder: string) => session.projectPlan(folder))
  ipcMain.handle('session:projects', () => session.recentProjects())
  ipcMain.handle('session:forget', (_event, folder: string) => session.forgetProject(folder))
  ipcMain.handle('session:forget-join', (_event, link: string) => session.forgetJoin(link))
  ipcMain.handle('session:share', async (_event, shared: boolean) => {
    const info = await session.setShared(shared)
    sharing()
    return info
  })
  ipcMain.handle('session:join', async (_event, link: string, folder: string, name: string) => {
    const info = await session.startJoin(link, folder, name)
    sharing()
    warmTerminals()
    return info
  })
  ipcMain.handle('session:leave', async () => {
    await session.leave()
    sharing()
  })
  ipcMain.handle('session:current', async () => {
    await resumed
    return session.current()
  })
  ipcMain.handle('session:recent', () => session.recentJoins())
  ipcMain.handle('agents:capabilities', () => session.capabilities())
  ipcMain.handle('agents:install', (_event, provider: string) => session.installProvider(provider))
  ipcMain.handle('agents:create', (_event, input: NewAgent) => session.createAgent(input))
  ipcMain.handle('agents:remove', (_event, instanceId: string) => session.removeAgent(instanceId))
  ipcMain.handle('repo:status', () => session.repoStatus())
  ipcMain.handle('repo:changes', () => session.repoChanges())
  ipcMain.handle('repo:pull', () => session.pullRepo())
  ipcMain.handle('repo:push', () => session.pushRepo())
  ipcMain.handle('media:access', (_event, kind: MediaKind) => mediaAccess(kind))
  ipcMain.handle('media:ask', (_event, kind: 'microphone' | 'camera') => askForMedia(kind))
  ipcMain.handle('media:settings', (_event, kind: MediaKind) => openMediaSettings(kind))
  ipcMain.handle('media:sources', () => screenSources())
  ipcMain.handle('media:pickSource', (_event, id: string | null) => pickScreenSource(id))
  ipcMain.handle('app:badge', (_event, count: number) => {
    setBadge(count)
    tray.update({ waiting: count })
  })
  ipcMain.handle('app:theme', (_event, theme: IconTheme) => applyIcon(theme))
  ipcMain.on('presence:publish', (_event, here: Present[]) => tray.update({ here, known: true }))
  ipcMain.on('tray:size', (_event, height: number) => tray.resizePanel(height))
  ipcMain.on('tray:open', () => openWindow())
  ipcMain.on('tray:hide', () => tray.hidePanel())
  ipcMain.handle('app:notify', (_event, alert: AgentAlert) => {
    showAlert(alert, () => {
      openWindow()
      if (alert.threadId) {
        appWindows()[0]?.webContents.send('notification:open', alert.threadId)
      }
    })
  })
  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle('clipboard:image', (_event, src: string) => copyImage(src))
  ipcMain.handle('file:read', (_event, target: string) => session.readFile(target))
  ipcMain.handle('file:list', () => session.listFiles())
  ipcMain.handle('file:write', (_event, target: string, text: string) => session.writeFile(target, text))
  ipcMain.handle('file:locate', (_event, target: string) => session.locatePath(target))
  ipcMain.handle('file:reveal', (_event, target: string) => {
    const absolute = session.resolveFile(target)
    if (absolute) shell.showItemInFolder(absolute)
  })
  ipcMain.on('terminal:open', (event, id: string, wanted: TerminalSize) => {
    const sender = event.sender
    terminalsFor(sender).open(id, session.projectFolder(), wanted, {
      data: (opened, chunk) => {
        if (!sender.isDestroyed()) sender.send('terminal:data', opened, chunk)
      },
      exit: opened => {
        if (!sender.isDestroyed()) sender.send('terminal:exit', opened)
      }
    })
  })
  ipcMain.on('terminal:write', (event, id: string, data: string) =>
    terminalsFor(event.sender).write(id, data)
  )
  ipcMain.on('terminal:resize', (event, id: string, wanted: TerminalSize) =>
    terminalsFor(event.sender).resize(id, wanted)
  )
  ipcMain.on('terminal:close', (event, id: string) => terminalsFor(event.sender).close(id))
  createWindow()
  app.on('activate', () => {
    if (appWindows().length === 0) createWindow()
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
  sharing()
  if (process.platform === 'win32' && !balloonShown) {
    balloonShown = true
    tray.balloon(
      'Crew is still running',
      'Your agents stay shared with your crew. Quit from this icon to stop.'
    )
  }
})

app.on('before-quit', () => {
  for (const open of terminals.values()) open.closeAll()
  terminals.clear()
  tray.close()
  void session.shutdown()
})
