import {
  app,
  BrowserWindow,
  clipboard,
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
import { fromSource } from './from-source'
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
import type { RepoCommand } from '../shared/repository'
import { cleanSettings, type ScribeSettings } from '../shared/scribe'
import { holdsBack, type Landing } from '../shared/scribeLanding'
import { askCaret } from './scribe-caret'
import { ScribeKeys } from './scribe-keys'
import { deliver } from './scribe-paste'
import { ScribeHistory } from './scribe-said'
import { ScribeWindow } from './scribe-window'
import { openRequestOf } from '../shared/cli'
import { Previews } from './preview'
import { AppSession, type NewAgent, type OpenOptions } from './session'
import { Terminals, type TerminalSize } from './terminal'
import { Updates } from './updates'
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
const previews = new Map<number, Previews>()
const rendererPage = {
  preload: path.join(dirname, '../preload/preload.mjs'),
  devUrl: process.env['ELECTRON_RENDERER_URL'],
  file: path.join(dirname, '../renderer/index.html')
}
const tray = new CrewTray({
  page: rendererPage,
  openWindow: () => openWindow(),
  quit: () => app.quit()
})
const scribe = new ScribeWindow(rendererPage)
const updates = new Updates(() => appWindows())
const said = new ScribeHistory()
let scribeSettings: ScribeSettings = cleanSettings(null, process.platform)
// What a dictation has written and not yet let go of. Nothing may be pasted
// while the key is still held down: the modifier being held is composed into the
// keystroke, so the app on the other side is handed a shortcut nobody pressed
// and the words land nowhere. Held to the end, a dictation on that key reads as
// it always did and the rest write as they are spoken.
let scribePending: string[] = []
// What had the caret when the key went down. It is asked then rather than at the
// moment the words are ready, so the whole of the wait sits behind somebody
// talking and a dictation is never slower for it.
let scribeAim: Promise<Landing> = Promise.resolve('unknown')
// Every landing in the order it was spoken. A dictation written as it is said
// lands a stretch at a time and each one now waits on an answer, so the walk down
// them is one chain: two stretches that came back the other way round would be
// two halves of a sentence swapped.
let scribeLanding: Promise<void> = Promise.resolve()
const scribeKeys = new ScribeKeys({
  onArm: () => {
    scribePending = []
    said.begin()
    // Starting to talk is letting go of the last card. Whoever is dictating has
    // moved on, and words held behind a dictation that is already running are
    // words nobody is coming back to copy.
    scribe.release()
    scribeAim = askCaret()
    scribe.show()
    scribe.send('scribe:arm')
  },
  onFinish: () => scribe.send('scribe:finish'),
  onCancel: () => {
    scribePending = []
    scribe.send('scribe:cancel')
    scribe.rest()
  }
})

function scribeWrite(text: string): void {
  scribePending.push(text)
  if (scribeKeys.holding) return
  scribeLand(scribePending.join(''))
  scribePending = []
}

// One at a time, in the order it was spoken. The caller stays synchronous because
// a stretch arrives off a socket and has nothing to wait on, and the order is the
// whole of what this chain is for.
function scribeLand(text: string): void {
  said.add(text)
  scribeLanding = scribeLanding.then(() => landScribe(text))
}

// A dictation with nowhere to go is held rather than pasted into the desk. It is
// asked twice before that happens: once as the key went down, which is free, and
// once here, because somebody who has clicked into a box since is somebody who
// wants their words in it, and this second ask only ever costs the case that was
// about to lose them anyway.
//
// Only an outright 'none' holds them back. A machine that would not say, and every
// machine that is not a Mac, pastes exactly the way it always did.
async function landScribe(text: string): Promise<void> {
  if (!text) return
  const finish = scribeSettings.finish
  if (holdsBack(finish, await scribeAim) && holdsBack(finish, await askCaret())) {
    scribe.hold(text)
    return
  }
  const landed = await deliver(text, scribeSettings.finish)
  if (!landed.ok) scribe.send('scribe:problem', landed.problem)
}

// A take that has ended, sealed into the one thing somebody said. The page that
// holds the list is told rather than asked, so it is right while it is open.
function scribeSaid(): void {
  if (said.seal()) saidChanged()
}

function saidChanged(): void {
  const list = said.all()
  for (const win of appWindows()) win.webContents.send('scribe:said', list)
}
let balloonShown = false
// What `crew` in a terminal asked for, read once and handed over once. A window
// launched for a folder opens that folder rather than the session the app was
// last in, so the last session is not resumed on top of it.
let opening = openRequestOf(process.argv)
let resumed: Promise<unknown> = Promise.resolve()
let iconTheme: IconTheme = 'dark'

// The tray panel is a window like any other as far as Electron is concerned,
// so everything that means "the app's own windows" asks for these.
function appWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter(win => !tray.owns(win) && !scribe.owns(win))
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

// A page being read belongs to the window reading it, the way a shell does, so
// closing a window takes the pages it stood up with it.
function previewsFor(sender: WebContents): Previews {
  const open = previews.get(sender.id)
  if (open) return open
  const made = new Previews()
  previews.set(sender.id, made)
  sender.once('destroyed', () => {
    made.clear()
    previews.delete(sender.id)
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

function createWindow(): BrowserWindow {
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
    scribe.warm()
    // A window opened after the check has already run would stand there saying
    // nothing, so it is told where the update has got to as it lands.
    updates.tell(win)
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
  return win
}

function openWindow(): BrowserWindow {
  tray.hidePanel()
  const win = appWindows()[0]
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

function openThreadIn(win: BrowserWindow, threadId: string): void {
  const send = () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('notification:open', threadId)
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
}

app.whenReady().then(() => {
  powerSaveBlocker.start('prevent-app-suspension')
  applyIcon(iconTheme)
  installMenu()
  tray.install()
  updates.start(!fromSource(app.getAppPath()))
  session.setAgentsPath(path.join(app.getPath('userData'), 'agents.json'))
  session.setSessionPath(path.join(app.getPath('userData'), 'session.json'))
  session.setProjectsPath(path.join(app.getPath('userData'), 'projects'))
  scribe.remember(path.join(app.getPath('userData'), 'scribe-spot.json'))
  said.remember(path.join(app.getPath('userData'), 'scribe-said.json'))
  resumed = opening
    ? Promise.resolve(null)
    : session.resume().then(() => {
        sharing()
        warmTerminals()
      })
  ipcMain.handle('cli:opening', () => {
    const asked = opening
    opening = null
    return asked
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
  ipcMain.handle('repo:work', () => session.repoWork())
  ipcMain.handle('repo:run', (_event, command: RepoCommand) => session.runRepo(command))
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
  // Everything about dictation is this machine's own, so the settings ride in
  // the window that holds them and are handed here to be acted on. Nothing about
  // it is written down, and nothing about it goes over the wire.
  ipcMain.handle('scribe:apply', (_event, input: unknown) => {
    scribeSettings = cleanSettings(input, process.platform)
    scribeKeys.apply(scribeSettings)
    scribe.apply(scribeSettings)
    return scribeKeys.state()
  })
  ipcMain.handle('scribe:state', () => scribeKeys.state())
  // What was recently said, so a dictation can be copied again after the fact.
  // It is this machine's own, beside where the pill was left, and nothing about
  // it is ever sent.
  ipcMain.handle('scribe:said', () => said.all())
  ipcMain.handle('scribe:forget', (_event, id?: string) => {
    said.forget(id)
    saidChanged()
    return said.all()
  })
  // The one permission macOS will not let an app grant itself. Both the key and
  // the paste need it, so the pane is opened and the person turns it on.
  ipcMain.handle('scribe:permission', () => {
    if (process.platform !== 'darwin') return
    void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
  })
  // A stretch of what somebody is saying, while they are still saying it. The
  // pill stays where it is: a dictation is over when the key says so, not when a
  // sentence lands.
  ipcMain.on('scribe:write', (_event, text: string) => scribeWrite(text))
  ipcMain.on('scribe:done', (_event, text: string) => {
    scribeKeys.stopped()
    // Whatever was held back because the key was down goes out with it, in the
    // order it was spoken. A dictation written as it was said hands nothing over
    // here, because the words are already where they were going.
    const rest = scribePending.join('') + text
    scribePending = []
    scribeLand(rest)
    // Resting waits for the words to have gone somewhere, because where they went
    // is what decides it: a dictation that found nothing to write into is a card
    // standing on this window, and put away on the way past it would be a window
    // hidden and shown again with somebody's only copy inside it.
    void scribeLanding.then(() => scribe.rest())
    // The take is one thing somebody said, however many stretches it landed in.
    scribeSaid()
  })
  ipcMain.on('scribe:dismiss', () => {
    scribeKeys.stopped()
    scribePending = []
    scribe.rest()
    // Whatever had already landed was said, so it is kept. Only the sound that
    // never got read is thrown away.
    scribeSaid()
  })
  // The card a dictation with nowhere to land is held on. Copy is answered here
  // rather than in the page, because the words are held here and the clipboard is
  // this machine's own: a window that never takes focus cannot reach one.
  ipcMain.on('scribe:copyHeld', () => {
    const words = scribe.heldWords()
    if (words) clipboard.writeText(words)
  })
  ipcMain.on('scribe:letGo', () => scribe.release())
  ipcMain.on('scribe:size', (_event, width: number, height: number) =>
    scribe.resize({ width, height })
  )
  // Where the pill stands is a decision somebody makes once by dragging it, so
  // it is this machine's own and is written down beside the rest of what the app
  // remembers for itself.
  ipcMain.on('scribe:grab', () => scribe.grab())
  ipcMain.on('scribe:drag', (_event, x: number, y: number, settled: boolean) =>
    scribe.drag({ x, y }, settled)
  )
  ipcMain.handle('app:notify', (_event, alert: AgentAlert) => {
    showAlert(alert, () => {
      const win = openWindow()
      app.focus({ steal: true })
      if (alert.threadId) openThreadIn(win, alert.threadId)
    })
  })
  ipcMain.handle('update:state', () => updates.now())
  ipcMain.handle('update:press', () => updates.press())
  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle('clipboard:image', (_event, src: string) => copyImage(src))
  ipcMain.handle('file:read', (_event, target: string) => session.readFile(target))
  ipcMain.handle('file:list', () => session.listFiles())
  ipcMain.handle('file:write', (_event, target: string, text: string) => session.writeFile(target, text))
  ipcMain.handle('file:locate', (_event, target: string) => session.locatePath(target))
  ipcMain.handle('preview:html', (event, id: string, target: string, text: string) => {
    const absolute = session.resolveFile(target)
    return absolute ? previewsFor(event.sender).show(id, absolute, text) : null
  })
  ipcMain.handle('preview:drop', (event, id: string) => previews.get(event.sender.id)?.drop(id))
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
  for (const open of previews.values()) open.clear()
  previews.clear()
  tray.close()
  scribeKeys.close()
  scribe.close()
  updates.close()
  void session.shutdown()
})
