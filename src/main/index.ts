import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
  webContents,
  type WebContents
} from 'electron'
import os from 'node:os'
import path from 'node:path'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  connectPlugin as connectCatalogPlugin,
  disconnectPlugin as disconnectCatalogPlugin,
  pluginConnected,
  setPluginOauthPath
} from '../runner/pluginOauth'
import { setBadge, showAlert } from './alerts'
import { KeepAwake } from './awake'
import { openBrowserTabWindow } from './browser-tab-window'
import { BrowserTabTransfers } from './browser-tab-transfer'
import { windowForAlert, type AgentAlert } from '../shared/alerts'
import { cleanAppIcon, DEFAULT_APP_ICON, type AppIconId } from '../shared/appIcon'
import type { BrowserTab } from '../shared/browserTab'
import type { SystemDetails } from '../shared/feedback'
import { pluginForConnection, type PluginConnectionInput, type PluginConnectionResult } from '../shared/plugins'
import { copyImage } from './clipboard'
import { installContextMenu } from './context-menu'
import type { Present } from '../shared/presence'
import { isThere } from './files'
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
import { FOCUSED_IN_PAGE, holdsBack, landingInPage, type Landing } from '../shared/scribeLanding'
import { askCaret } from './scribe-caret'
import { ScribeKeys } from './scribe-keys'
import { deliver } from './scribe-paste'
import { ScribeHistory } from './scribe-said'
import { ScribeWindow } from './scribe-window'
import { openRequestOf } from '../shared/cli'
import { commandScript } from '../shared/crewCommand'
import { CrewCommand } from './crew-command'
import { Previews } from './preview'
import { Media } from './media-file'
import { registerMediaScheme, serveMediaScheme } from './media-scheme'
import { registerMailScheme } from './mail/scheme'
import {
  createCrewMailRuntime,
  type CrewMailRuntime,
  type MailNotification,
  type MailThreadView,
  type StoredMailAttachment
} from './mail/service'
import { MAIL_RENDERER_EVENTS } from '../shared/mail'
import { OtherInstances } from './instances'
import { Crews } from './crews'
import { cloneRepository } from './repository-clone'
import type { LivePlace } from '../shared/places'
import { popOutTarget, poppedKey } from '../shared/popOut'
import { type NewAgent, type OpenOptions } from './session'
import { Terminals, type TerminalSize } from './terminal'
import {
  BROWSER_WINDOW_HASH,
  PERSONAL_CHAT_HASH,
  STICKIES_HASH,
  stickyWindowHash,
  threadWindowHash
} from '../shared/threadViews'
import { Updates } from './updates'
import { runtimeStateDir } from './runtime-state'
import {
  appMenuTemplate,
  closePutsAway,
  createPersonalChatWindowOptions,
  createStickiesWindowOptions,
  createThreadWindowOptions,
  createWindowOptions
} from './window-options'
import { showWhenReady } from './window-launch'
import { installBrowserFindForHost } from './browser-find'
import { FinderOpens } from './finder-open'
import { pinWindow, windowShapeOf } from './window-pin'
import type { FileReplaceRequest, FileSearchOptions } from '../shared/fileSearch'
import type { CreateStickyInput, UpdateStickyInput } from '../shared/stickies'
import { StickyStore } from './stickies-store'

app.setName('Crew')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
// Huddle audio arrives without anyone clicking play, and Chromium blocks that
// by default.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
registerMediaScheme()
registerMailScheme()

const dirname = path.dirname(fileURLToPath(import.meta.url))
const devUrl = process.env['ELECTRON_RENDERER_URL']
const stateDir = runtimeStateDir(app.getPath('userData'), devUrl)
app.setPath('userData', stateDir)
const crews = new Crews()
const terminals = new Map<number, Terminals>()
const previews = new Map<number, Previews>()
const playing = new Map<number, Media>()
const stickies = new StickyStore(stateDir)
const stickiesWindows = new Set<BrowserWindow>()
const stickyWindows = new Map<string, BrowserWindow>()
// One window a thread. Asked for a thread that already has one, the window that
// is standing is brought forward rather than a second one opened onto the same
// conversation.
const popped = new Map<string, BrowserWindow>()
const standaloneBrowsers = new Set<BrowserWindow>()
const browserTabTransfers = new BrowserTabTransfers(id => crews.keyInView(id))
// Whether this Crew was installed or is being run out of a checkout. It is the
// one answer the icon, the dev tools and the updates all read, and nothing about
// the path check is loosened for any of them.
const shipping = !fromSource(app.getAppPath())
// A shipped Crew has no dev tools, in any window and from any way in.
const inspectable = !shipping
const rendererPage = {
  preload: path.join(dirname, '../preload/preload.mjs'),
  devUrl,
  file: path.join(dirname, '../renderer/index.html'),
  devTools: inspectable
}
const tray = new CrewTray({
  page: rendererPage,
  openWindow: () => openWindow(),
  quit: () => app.quit()
})
const scribe = new ScribeWindow(rendererPage)
const awake = new KeepAwake()
// The crew command opens one Crew per folder, so several are ordinary here and
// none of them can see the others through electron.
const instances = new OtherInstances(path.join(stateDir, 'live'))
let mailRuntime: CrewMailRuntime | null = null
// Whatever quitting puts down is put down once, whether the app is quitting or
// being replaced under itself by an update.
let settling: Promise<void> | null = null
const settle = (): Promise<void> =>
  (settling ??= Promise.all([crews.shutdownAll(), mailRuntime?.stop()]).then(() => undefined))
const updates = new Updates({
  windows: () => appWindows(),
  others: () => instances.count(),
  settle,
  prepareQuit: () => {
    quitting = true
  },
  cancelQuit: () => {
    quitting = false
  },
  log: path.join(stateDir, 'updates.log')
})
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
    scribeAim = askCaret(caretInCrew)
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
//
// The aim is taken hold of here rather than read at the far end of the chain. It is
// the dictation's own, and the next one replaces it the moment its key goes down:
// read late, a stretch still queued behind a slow paste would be answered by where
// somebody is pointing now instead of where they were pointing when they said it.
function scribeLand(text: string): void {
  said.add(text)
  const aim = scribeAim
  scribeLanding = scribeLanding.then(() => landScribe(text, aim))
}

// A dictation with nowhere to go is held rather than pasted into the desk. It is
// asked twice before that happens: once as the key went down, which is free, and
// once here, because somebody who has clicked into a box since is somebody who
// wants their words in it, and this second ask only ever costs the case that was
// about to lose them anyway.
//
// Only an outright 'none' holds them back. A machine that would not say, and every
// machine that is not a Mac, pastes exactly the way it always did.
async function landScribe(text: string, aim: Promise<Landing>): Promise<void> {
  if (!text) return
  const finish = scribeSettings.finish
  if (holdsBack(finish, await aim) && holdsBack(finish, await askCaret(caretInCrew))) {
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
// Whether the app is on its way out. A close during a quit is the real thing
// and is let through, or the window would put itself away and the quit would
// stall on a window that refuses to go.
let quitting = false
// What `crew` in a terminal asked for, read once and handed over once. A window
// launched for a folder opens that folder rather than the session the app was
// last in, so the last session is not resumed on top of it.
const launchOpening = openRequestOf(process.argv)
const openingWindows = new Map<number, NonNullable<ReturnType<typeof openRequestOf>>>()
const finderOpens = new FinderOpens(request => openOpeningWindow(request))
let command = new CrewCommand(null)
let resumed: Promise<unknown> = Promise.resolve()
let iconTheme: IconTheme = 'dark'
let chosenIcon: AppIconId = DEFAULT_APP_ICON

// The tray panel is a window like any other as far as Electron is concerned,
// so everything that means "the app's own windows" asks for these.
function appWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter(win => !tray.owns(win) && !scribe.owns(win))
}

// What has the caret inside one of our own pages, read off the page rather than
// asked of macOS. Every window here is Chromium, and Chromium hands nothing to the
// accessibility API until something turns its tree on, so the app was holding the
// words back from its own composer. It never needed asking: the caret is in a
// document we are already holding.
//
// A focused window is the whole of what says the app is frontmost. Electron
// answers null for every window while somebody is in another application, so a
// null here is the caret being somewhere macOS is the one that can say.
//
// The pill is left out on purpose. It never takes focus, so it can only be the
// answer on a machine where something has gone wrong, and a dictation answered by
// the window drawing the pill would be answered by itself.
async function caretInCrew(): Promise<Landing | null> {
  const win = BrowserWindow.getFocusedWindow()
  if (!win || scribe.owns(win) || tray.owns(win) || win.webContents.isDestroyed()) return null
  try {
    const focused = await win.webContents.executeJavaScript(FOCUSED_IN_PAGE, true)
    if (!focused) return 'none'
    return landingInPage(focused.tag, focused.type, focused.editable)
  } catch {
    // A page that would not answer is our own window all the same, so the caret is
    // here rather than anywhere macOS could be asked about. Nothing is known about
    // it beyond that, which is the doubt that pastes.
    return 'unknown'
  }
}

function sharing(): void {
  tray.update({ sharing: crews.any() })
}

function tellLive(places: LivePlace[]): void {
  for (const win of appWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send('session:live', places)
  }
}

// The default icon is a white mark on black, or the inverse, so it follows the
// theme chosen inside the app rather than the one the system is wearing. The tray
// takes the theme alone: its mark is a template image, so nothing about it changes
// with a picture.
function applyIcon(theme: IconTheme, icon: AppIconId): void {
  iconTheme = theme
  chosenIcon = icon
  tray.theme(theme)
  if (process.platform === 'darwin') {
    app.dock?.setIcon(appIcon(theme, icon))
    return
  }
  for (const win of appWindows()) win.setIcon(appIcon(theme, icon))
}

function installMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuTemplate(process.platform, inspectable)))
}

app.on('web-contents-created', (_event, contents) => {
  // A page in the side panel is a real browser carrying preferences of its own,
  // so a window with no dev tools has to say so again for whatever it embeds.
  contents.on('will-attach-webview', (_e, preferences) => {
    preferences.devTools = inspectable
  })
  if (contents.getType() !== 'webview') return
  installContextMenu(contents, true, inspectable)
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void contents.loadURL(url)
    return { action: 'deny' }
  })
})

ipcMain.on('browser:view', (event, id: number) => {
  if (!Number.isInteger(id)) return
  installBrowserFindForHost(webContents.fromId(id), event.sender)
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

function mediaFor(sender: WebContents): Media {
  const open = playing.get(sender.id)
  if (open) return open
  const made = new Media()
  playing.set(sender.id, made)
  sender.once('destroyed', () => {
    made.clear()
    playing.delete(sender.id)
  })
  return made
}

// A login shell reads the whole profile before it says anything, so one is
// started for every window as soon as the folder a terminal would open in is
// known, rather than when somebody asks for a tab and watches it blink.
function warmTerminals(): void {
  for (const win of appWindows()) {
    const contents = win.webContents
    if (!contents.isDestroyed()) terminalsFor(contents).warm(crews.folderInView(contents.id))
  }
}

function loadWindow(
  win: BrowserWindow,
  threadId?: string,
  personal = false,
  browser = false,
  stickyId?: string | null
): void {
  const page = path.join(dirname, '../renderer/index.html')
  const hash =
    stickyId !== undefined
      ? stickyId === null
        ? STICKIES_HASH
        : stickyWindowHash(stickyId)
      : browser
        ? BROWSER_WINDOW_HASH
        : personal
          ? PERSONAL_CHAT_HASH
          : threadId
            ? threadWindowHash(threadId)
            : ''
  if (devUrl) {
    void win.loadURL(devUrl + hash)
  } else if (hash) {
    void win.loadFile(page, { hash: hash.slice(1) })
  } else {
    void win.loadFile(page)
  }
}

function openOpeningWindow(request: NonNullable<ReturnType<typeof openRequestOf>>): BrowserWindow {
  const win = createWindow(undefined, false)
  openingWindows.set(win.webContents.id, request)
  loadWindow(win)
  return win
}

function createWindow(
  threadId?: string,
  load = true,
  personal = false,
  browser = false,
  stickyId?: string | null
): BrowserWindow {
  const preload = path.join(dirname, '../preload/preload.mjs')
  const win = new BrowserWindow(
    stickyId !== undefined
      ? createStickiesWindowOptions(process.platform, preload, inspectable, stickyId !== null)
      : personal
        ? createPersonalChatWindowOptions(process.platform, preload, inspectable)
        : threadId
          ? createThreadWindowOptions(process.platform, preload, inspectable)
          : createWindowOptions(process.platform, preload, inspectable)
  )
  if (personal || stickyId !== undefined) showWhenReady(win)
  if (process.platform !== 'darwin') win.setIcon(appIcon(iconTheme, chosenIcon))
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
  const syncWindowShape = () => win.webContents.send('window:shape', windowShapeOf(win))
  win.on('maximize', syncWindowShape)
  win.on('unmaximize', syncWindowShape)
  win.on('enter-full-screen', syncWindowShape)
  win.on('leave-full-screen', syncWindowShape)
  installContextMenu(win.webContents, false, inspectable)
  installDisplayMedia(win.webContents.session)
  // A window that has gone is a window that has stopped asking, so the machine
  // is let go of by the last one out rather than left awake by a window that
  // died with the switch on.
  const asked = win.webContents.id
  win.webContents.once('destroyed', () => {
    awake.forget(asked)
    crews.forget(asked)
  })
  win.webContents.on('did-finish-load', syncWindowShape)
  win.webContents.once('did-finish-load', () => {
    warmTerminals()
    tray.warm()
    scribe.warm()
    // A window opened after the check has already run would stand there saying
    // nothing, so it is told where the update has got to as it lands.
    updates.tell(win)
  })
  // A window standing on one thread is that thread rather than the app, so its
  // close is the way out of it and not a way to put the app aside. Wearing the
  // put-away close it would be hidden rather than taken down, and the thread it
  // was popped out of would open nothing on the next press: a window nobody can
  // see is still a window standing on that thread.
  if (!threadId && !personal && !browser && stickyId === undefined) {
    win.on('close', event => {
      if (!closePutsAway(process.platform, quitting)) return
      event.preventDefault()
      // A full screen window has a desktop of its own, and hiding one leaves that
      // desktop standing there empty with nothing in it to come back to. It comes
      // out first and goes away once it has landed.
      if (!win.isFullScreen()) {
        win.hide()
        return
      }
      win.once('leave-full-screen', () => win.hide())
      win.setFullScreen(false)
    })
  }
  // Who is here is read from a window's own view of the session, so with none
  // open the tray says so rather than showing a list that stopped moving.
  win.on('closed', () => {
    if (appWindows().length === 0) tray.update({ here: [], known: false })
  })
  if (browser) {
    standaloneBrowsers.add(win)
    win.on('closed', () => standaloneBrowsers.delete(win))
  }
  if (stickyId !== undefined) {
    stickiesWindows.add(win)
    if (stickyId !== null) stickyWindows.set(stickyId, win)
    win.on('closed', () => {
      stickiesWindows.delete(win)
      if (stickyId !== null && stickyWindows.get(stickyId) === win) stickyWindows.delete(stickyId)
    })
  }
  if (load) loadWindow(win, threadId, personal, browser, stickyId)
  return win
}

function poppedOut(win: BrowserWindow): boolean {
  if (standaloneBrowsers.has(win)) return true
  if (stickiesWindows.has(win)) return true
  for (const one of popped.values()) if (one === win) return true
  return false
}

function tellStickies(): void {
  const list = stickies.list()
  for (const win of stickiesWindows) {
    if (!win.webContents.isDestroyed()) win.webContents.send('stickies:changed', list)
  }
}

function openStickiesWindow(): boolean {
  const win = createWindow(undefined, false, false, false, null)
  loadWindow(win, undefined, false, false, null)
  return true
}

function openStickyWindow(id: string): boolean {
  const sticky = stickies.list().find(one => one.id === id)
  if (!sticky) return false
  const standing = stickyWindows.get(id)
  if (standing && !standing.isDestroyed()) {
    if (standing.isMinimized()) standing.restore()
    standing.show()
    standing.focus()
    return true
  }
  const win = createWindow(undefined, false, false, false, id)
  if (sticky.pinned) pinWindow(win, true)
  loadWindow(win, undefined, false, false, id)
  return true
}

function openWindow(place?: string | null): BrowserWindow {
  tray.hidePanel()
  const all = appWindows()
  const at = windowForAlert(
    all.map(one => ({ place: crews.keyInView(one.webContents.id), popped: poppedOut(one) })),
    place ?? null
  )
  const win = all[at]
  if (!win) return createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

function openChat(): void {
  const win = openWindow()
  const send = () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('chat:open')
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
}

// The crew rides with the thread, so a window that has moved on to another
// project since knows to go back to this one before it opens anything.
function openThreadIn(win: BrowserWindow, threadId: string, place: string | null): void {
  const send = () => {
    if (!win.webContents.isDestroyed()) win.webContents.send('notification:open', threadId, place)
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
}

function mailPrintText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function mailPrintDocument(thread: MailThreadView): string {
  const messages = thread.messages
    .map(message => {
      const sender = message.from.name || message.from.email
      const recipients = message.to.map(one => one.name || one.email).join(', ')
      const attachments = message.attachments.length
        ? `<p class="attachments">${mailPrintText(message.attachments.map(one => one.name).join(', '))}</p>`
        : ''
      return `<article><h2>${mailPrintText(sender)}</h2><p class="meta">${mailPrintText(message.date)} · ${mailPrintText(recipients)}</p><pre>${mailPrintText(message.text)}</pre>${attachments}</article>`
    })
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${mailPrintText(thread.subject)}</title><style>body{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#181818;margin:40px}h1{font-size:22px;margin:0 0 28px}article{break-inside:avoid;border-top:1px solid #ddd;padding:20px 0}h2{font-size:14px;margin:0}.meta,.attachments{color:#666;font-size:12px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>${mailPrintText(thread.subject)}</h1>${messages}</body></html>`
}

async function saveMailAttachment(
  _accountId: string,
  _messageId: string,
  attachment: StoredMailAttachment,
  bytes: Uint8Array
): Promise<void> {
  const result = await dialog.showSaveDialog({ defaultPath: path.basename(attachment.filename) })
  if (result.canceled || !result.filePath) return
  await writeFile(result.filePath, bytes)
}

async function printMailThread(_accountId: string, _threadId: string, thread: MailThreadView): Promise<void> {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(mailPrintDocument(thread))}`)
    await new Promise<void>((resolve, reject) => {
      win.webContents.print({ silent: false, printBackground: true }, (printed, failure) => {
        if (printed || failure === 'cancelled') resolve()
        else reject(new Error(failure || 'The conversation could not be printed'))
      })
    })
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

function emitMail(channel: string, ...args: unknown[]): void {
  for (const win of appWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

function showMailNotification(notification: MailNotification): void {
  showAlert({ title: notification.title, body: notification.body }, () => {
    const win = openWindow()
    app.focus({ steal: true })
    const send = () => {
      if (!win.webContents.isDestroyed()) win.webContents.send(MAIL_RENDERER_EVENTS.notificationOpen, notification)
    }
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  })
}

app.whenReady().then(async () => {
  serveMediaScheme()
  applyIcon(iconTheme, chosenIcon)
  installMenu()
  tray.install()
  // An installed Crew is the only kind an installer replaces, so it is the only
  // kind an update waits for. A run from source stands nowhere the installer will
  // reach and holding an update for one means every machine with a checkout open
  // is told to close a window that has nothing to do with it.
  if (shipping) instances.mark()
  updates.start(shipping)
  // The command ships inside the app, so which file goes on PATH is read off
  // this app rather than off wherever a checkout happens to be.
  command = new CrewCommand(
    commandScript({
      platform: process.platform,
      fromSource: !shipping,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath
    })
  )
  crews.setAgentsPath(path.join(stateDir, 'agents.json'))
  crews.setSessionPath(path.join(stateDir, 'session.json'))
  crews.setProjectsPath(path.join(stateDir, 'projects'))
  crews.setPersonalPath(path.join(stateDir, 'personal'))
  crews.setServersPath(path.join(stateDir, 'model-servers.json'))
  setPluginOauthPath(path.join(stateDir, 'plugin-oauth.json'))
  crews.onTrouble = message => {
    for (const win of appWindows()) win.webContents.send('crew:trouble', message)
  }
  crews.onLive = places => tellLive(places)
  scribe.remember(path.join(app.getPath('userData'), 'scribe-spot.json'))
  said.remember(path.join(app.getPath('userData'), 'scribe-said.json'))
  resumed =
    launchOpening || finderOpens.waiting
      ? Promise.resolve(null)
      : crews.resume().then(() => {
          sharing()
          warmTerminals()
        })
  ipcMain.handle('cli:opening', event => {
    const asked = openingWindows.get(event.sender.id) ?? null
    openingWindows.delete(event.sender.id)
    return asked
  })
  ipcMain.handle('folder:pick', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('repo:clone', async (_event, remote: string) => {
    const result = await dialog.showOpenDialog({
      title: 'Choose where to clone',
      buttonLabel: 'Clone',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : cloneRepository(remote, result.filePaths[0])
  })
  ipcMain.handle('session:start', async (event, folder: string, name: string, opts?: OpenOptions) => {
    const info = await crews.start(event.sender.id, folder, name, opts ?? {})
    sharing()
    warmTerminals()
    return info
  })
  ipcMain.handle('session:plan', (_event, folder: string) => crews.projectPlan(folder))
  ipcMain.handle('crew:connect', (event, remote: string) => crews.inView(event.sender.id).connectCrew(remote))
  ipcMain.handle('session:sync', (event, on: boolean) => crews.inView(event.sender.id).setProjectSync(on))
  ipcMain.handle('session:projects', () => crews.recentProjects())
  ipcMain.handle('session:forget', (_event, folder: string) => crews.forgetProject(folder))
  ipcMain.handle('session:forget-join', (_event, link: string) => crews.forgetJoin(link))
  ipcMain.handle('session:share', async (event, shared: boolean) => {
    const info = await crews.inView(event.sender.id).setShared(shared)
    sharing()
    return info
  })
  ipcMain.handle('session:join', async (event, link: string, folder: string, name: string) => {
    const info = await crews.join(event.sender.id, link, folder, name)
    sharing()
    warmTerminals()
    return info
  })
  ipcMain.handle('session:leave', async event => {
    await crews.leave(event.sender.id)
    sharing()
  })
  ipcMain.handle('session:current', async event => {
    await resumed
    return crews.current(event.sender.id)
  })
  ipcMain.handle('session:rename', (event, name: string) => crews.rename(event.sender.id, name))
  ipcMain.handle('session:switch', (event, key: string) => {
    const info = crews.switchTo(event.sender.id, key)
    if (info) warmTerminals()
    return info
  })
  // A thread stood out into a window of its own. It opens on the crew it names,
  // or on the one the window that asked is looking at, and that is set the moment
  // the window is made rather than once the page has loaded: loading is the slow
  // half, and every handler the renderer reaches for asks which crew this window
  // is in.
  ipcMain.handle('window:pop-thread', (event, threadId: string, key?: string) => {
    const asking = BrowserWindow.fromWebContents(event.sender)
    const place = popOutTarget(asking ? crews.keyInView(asking.webContents.id) : null, key, crews.openKeys())
    // A crew that is not running has no thread to hand over, so nothing opens
    // rather than a window landing on the way in with a thread named in its URL.
    if (!place) return
    const at = poppedKey(place, threadId)
    const standing = popped.get(at)
    if (standing && !standing.isDestroyed()) {
      if (standing.isMinimized()) standing.restore()
      standing.show()
      standing.focus()
      return
    }
    const win = createWindow(threadId)
    crews.switchTo(win.webContents.id, place)
    popped.set(at, win)
    win.on('closed', () => {
      if (popped.get(at) === win) popped.delete(at)
    })
  })
  ipcMain.handle('window:pop-browser-tab', (event, tab: BrowserTab) => {
    const place = crews.keyInView(event.sender.id)
    return openBrowserTabWindow(tab, place, {
      create: () => createWindow(undefined, false, false, true),
      join: (id, target) => crews.switchTo(id, target),
      load: win => loadWindow(win, undefined, false, true)
    })
  })
  ipcMain.on('browser:drag-tab', (event, token: string, tab: BrowserTab) => {
    event.returnValue = browserTabTransfers.begin(event.sender, token, tab)
  })
  ipcMain.on('browser:drag-file-tab', (event, token: string, tab: BrowserTab) => {
    event.returnValue = browserTabTransfers.begin(event.sender, token, tab, true)
  })
  ipcMain.handle('browser:drop-tab', (event, token: string, to: number) =>
    browserTabTransfers.drop(event.sender, token, to)
  )
  ipcMain.on('window:close-browser', event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && standaloneBrowsers.has(win)) win.close()
  })
  ipcMain.handle('window:open-project', async (_event, key: string) => {
    const win = createWindow(undefined, false)
    try {
      const opened = await crews.openIn(win.webContents.id, key)
      if (!opened) {
        win.destroy()
        return false
      }
      loadWindow(win)
      warmTerminals()
      return true
    } catch (error) {
      win.destroy()
      throw error
    }
  })
  ipcMain.handle('window:open-personal', async (_event, name: string) => {
    const win = createWindow(undefined, false, true)
    try {
      await crews.openPersonal(win.webContents.id, name)
      loadWindow(win, undefined, true)
      return true
    } catch (error) {
      win.destroy()
      throw error
    }
  })
  ipcMain.handle('window:open-stickies', () => openStickiesWindow())
  ipcMain.handle('window:open-sticky', (_event, id: string) => openStickyWindow(id))
  ipcMain.handle('stickies:list', () => stickies.list())
  ipcMain.handle('stickies:create', (_event, input: CreateStickyInput) => {
    const sticky = stickies.create(input)
    tellStickies()
    return sticky
  })
  ipcMain.handle('stickies:update', (_event, id: string, patch: UpdateStickyInput) => {
    const sticky = stickies.update(id, patch)
    if (!sticky) return null
    const win = stickyWindows.get(id)
    if (win && !win.isDestroyed()) {
      pinWindow(win, sticky.pinned)
      win.webContents.send('window:shape', windowShapeOf(win))
    }
    tellStickies()
    return sticky
  })
  ipcMain.handle('stickies:delete', (_event, id: string) => {
    const deleted = stickies.delete(id)
    if (!deleted) return false
    const win = stickyWindows.get(id)
    if (win && !win.isDestroyed()) win.close()
    tellStickies()
    return true
  })
  ipcMain.handle('window:pin', (event, pinned: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || !appWindows().includes(win)) return false
    const next = pinWindow(win, pinned === true)
    win.webContents.send('window:shape', windowShapeOf(win))
    return next
  })
  ipcMain.handle('session:close', async (_event, key: string) => {
    await crews.close(key)
    sharing()
  })
  ipcMain.handle('session:live', () => crews.places())
  ipcMain.handle('session:recent', () => crews.recentJoins())
  ipcMain.handle('plugins:connect', async (_event, input: PluginConnectionInput): Promise<PluginConnectionResult> => {
    const plugin = pluginForConnection(input)
    if (!plugin) return { ok: false, message: 'That plugin is not available.' }
    try {
      await connectCatalogPlugin(plugin)
      return { ok: true, message: `${plugin.label} is connected.` }
    } catch (cause) {
      return {
        ok: false,
        message: cause instanceof Error ? cause.message : `${plugin.label} did not connect.`
      }
    }
  })
  ipcMain.handle('plugins:status', (_event, input: PluginConnectionInput) => {
    const plugin = pluginForConnection(input)
    return plugin ? pluginConnected(plugin) : false
  })
  ipcMain.handle('plugins:disconnect', (_event, input: PluginConnectionInput) => {
    const plugin = pluginForConnection(input)
    if (plugin) disconnectCatalogPlugin(plugin)
  })
  ipcMain.handle('agents:capabilities', () => crews.capabilities())
  ipcMain.handle('agents:install', (_event, provider: string) => crews.installProvider(provider))
  ipcMain.handle('agents:servers', () => crews.modelServers())
  ipcMain.handle('agents:addServer', (_event, input: { url: string; name?: string; key?: string }) =>
    crews.addModelServer(input)
  )
  ipcMain.handle('agents:forgetServer', (_event, url: string) => crews.forgetModelServer(url))
  ipcMain.handle('agents:create', (event, input: NewAgent) => crews.inView(event.sender.id).createAgent(input))
  ipcMain.handle('agents:remove', (event, instanceId: string) => crews.inView(event.sender.id).removeAgent(instanceId))
  ipcMain.handle('repo:status', event => crews.inView(event.sender.id).repoStatus())
  ipcMain.handle('repo:changes', event => crews.inView(event.sender.id).repoChanges())
  ipcMain.handle('repo:pull', event => crews.inView(event.sender.id).pullRepo())
  ipcMain.handle('repo:push', event => crews.inView(event.sender.id).pushRepo())
  ipcMain.handle('repo:work', event => crews.inView(event.sender.id).repoWork())
  ipcMain.handle('repo:run', (event, command: RepoCommand) => crews.inView(event.sender.id).runRepo(command))
  ipcMain.handle('media:access', (_event, kind: MediaKind) => mediaAccess(kind))
  ipcMain.handle('media:ask', (_event, kind: 'microphone' | 'camera') => askForMedia(kind))
  ipcMain.handle('media:settings', (_event, kind: MediaKind) => openMediaSettings(kind))
  ipcMain.handle('media:sources', () => screenSources())
  ipcMain.handle('media:pickSource', (_event, id: string | null) => pickScreenSource(id))
  ipcMain.handle('app:badge', (_event, count: number) => {
    setBadge(count)
    tray.update({ waiting: count })
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle(
    'app:system',
    (): SystemDetails => ({
      version: app.getVersion(),
      platform: process.platform,
      release: os.release(),
      arch: process.arch
    })
  )
  ipcMain.handle('app:theme', (_event, theme: IconTheme) => {
    nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'
    applyIcon(theme, chosenIcon)
  })
  ipcMain.handle('app:icon', (_event, icon: unknown) => applyIcon(iconTheme, cleanAppIcon(icon)))
  // Whether the machine sleeps is this window's own answer, said again on every
  // start, and the machine stays up while any window is asking.
  ipcMain.on('app:awake', (event, on: boolean) => awake.wants(event.sender.id, on))
  ipcMain.on('presence:publish', (_event, here: Present[]) => tray.update({ here, known: true }))
  ipcMain.on('tray:size', (_event, height: number) => tray.resizePanel(height))
  ipcMain.on('tray:open', () => openWindow())
  ipcMain.on('tray:chat', () => openChat())
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
  ipcMain.on('scribe:size', (_event, width: number, height: number) => scribe.resize({ width, height }))
  // Where the pill stands is a decision somebody makes once by dragging it, so
  // it is this machine's own and is written down beside the rest of what the app
  // remembers for itself.
  ipcMain.on('scribe:grab', () => scribe.grab())
  ipcMain.on('scribe:drag', (_event, x: number, y: number, settled: boolean) => scribe.drag({ x, y }, settled))
  ipcMain.handle('app:notify', (event, alert: AgentAlert) => {
    // Which crew this is about is read as the banner is raised rather than as it
    // is clicked, since the window that raised it may have moved on to another
    // project by then and that is the whole case this exists for.
    const place = crews.keyInView(event.sender.id)
    showAlert(alert, () => {
      const win = openWindow(place)
      app.focus({ steal: true })
      if (alert.threadId) openThreadIn(win, alert.threadId, place)
    })
  })
  ipcMain.handle('update:state', () => updates.now())
  ipcMain.handle('update:press', () => updates.press())
  // Whether `crew` is on PATH, and the one press either way. It is this
  // machine's own, like a terminal, so nothing about it is written down or sent.
  ipcMain.handle('command:state', () => command.state())
  ipcMain.handle('command:install', () => command.install())
  ipcMain.handle('command:remove', () => command.remove())
  // Whether it really opened, because a machine with no mail app set up fails
  // the same way a machine with one succeeds, and silence there is a report
  // somebody wrote that nobody ever receives.
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (!/^(https?|mailto):/i.test(url)) return false
    try {
      await shell.openExternal(url)
      return true
    } catch {
      return false
    }
  })
  ipcMain.handle('clipboard:image', (_event, src: string) => copyImage(src))
  ipcMain.handle('file:read', (event, target: string) =>
    crews.inView(event.sender.id).readFile(target, mediaFor(event.sender))
  )
  ipcMain.handle('file:list', event => crews.inView(event.sender.id).listFiles())
  ipcMain.handle('file:create', (event, target: string, kind: 'file' | 'folder') =>
    crews.inView(event.sender.id).createEntry(target, kind)
  )
  ipcMain.handle('file:move', (event, source: string, parent: string) =>
    crews.inView(event.sender.id).moveEntry(source, parent)
  )
  ipcMain.handle('file:transfer', (event, sources: string[], parent: string, mode: 'copy' | 'move') =>
    crews.inView(event.sender.id).transferEntries(sources, parent, mode)
  )
  ipcMain.handle('file:import', (event, sources: string[], parent: string) =>
    crews.inView(event.sender.id).importEntries(sources, parent)
  )
  ipcMain.handle('file:search', (event, options: FileSearchOptions) =>
    crews.inView(event.sender.id).searchFiles(options)
  )
  ipcMain.handle('file:replace', (event, request: FileReplaceRequest) =>
    crews.inView(event.sender.id).replaceFiles(request)
  )
  ipcMain.handle('file:dirs', (event, query: string) => crews.inView(event.sender.id).readDirs(query))
  ipcMain.handle('file:write', (event, target: string, text: string) =>
    crews.inView(event.sender.id).writeFile(target, text)
  )
  ipcMain.handle('file:locate', (event, target: string) => crews.inView(event.sender.id).locatePath(target))
  ipcMain.handle('file:copyPaths', (event, target: string) => crews.inView(event.sender.id).copyPaths(target))
  ipcMain.handle('preview:html', (event, id: string, target: string, text: string | null) => {
    // A page somebody attached names no file, since it never landed in the
    // project, so there is nothing to resolve and nothing beside it to reach.
    const absolute = target ? crews.inView(event.sender.id).resolveFile(target) : ''
    return absolute === null ? null : previewsFor(event.sender).show(id, absolute, text)
  })
  ipcMain.handle('preview:drop', (event, id: string) => previews.get(event.sender.id)?.drop(id))
  // Whether it really opened. A folder somebody has moved or thrown away is
  // still a row in the rail, and showing it silently does nothing at all.
  ipcMain.handle('file:reveal', async (event, target: string) => {
    const absolute = crews.inView(event.sender.id).resolveFile(target)
    if (!absolute || !(await isThere(absolute))) return false
    shell.showItemInFolder(absolute)
    return true
  })
  ipcMain.on('terminal:open', (event, id: string, wanted: TerminalSize) => {
    const sender = event.sender
    terminalsFor(sender).open(id, crews.folderInView(sender.id), wanted, {
      data: (opened, chunk) => {
        if (!sender.isDestroyed()) sender.send('terminal:data', opened, chunk)
      },
      exit: opened => {
        if (!sender.isDestroyed()) sender.send('terminal:exit', opened)
      },
      running: (opened, command) => {
        if (!sender.isDestroyed()) sender.send('terminal:running', opened, command)
      }
    })
  })
  ipcMain.on('terminal:write', (event, id: string, data: string) => terminalsFor(event.sender).write(id, data))
  ipcMain.on('terminal:resize', (event, id: string, wanted: TerminalSize) =>
    terminalsFor(event.sender).resize(id, wanted)
  )
  ipcMain.on('terminal:close', (event, id: string) => terminalsFor(event.sender).close(id))
  if (launchOpening) openOpeningWindow(launchOpening)
  const finderCount = await finderOpens.start()
  if (!launchOpening && finderCount === 0) createWindow()
  // The window put away by a close is still there, so the dock has to bring that
  // one back rather than ask whether there is one at all. `openWindow` opens a
  // window when there is none, which is the other way in here.
  app.on('activate', () => {
    openWindow()
  })
})

app.on('open-file', (event, target) => {
  event.preventDefault()
  finderOpens.add(target)
})

// Closing the window while in a session keeps the app alive so the crew can
// keep using this machine's agents. Quitting still shuts everything down.
app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  if (!crews.any()) {
    app.quit()
    return
  }
  sharing()
  if (process.platform === 'win32' && !balloonShown) {
    balloonShown = true
    tray.balloon('Crew is still running', 'Your agents stay shared with your crew. Quit from this icon to stop.')
  }
})

app.on('before-quit', () => {
  quitting = true
  for (const open of terminals.values()) open.closeAll()
  terminals.clear()
  for (const open of previews.values()) open.clear()
  previews.clear()
  tray.close()
  scribeKeys.close()
  scribe.close()
  updates.close()
  instances.forget()
  void settle()
})
