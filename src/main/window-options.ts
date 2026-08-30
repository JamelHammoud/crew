import type { BrowserWindow, BrowserWindowConstructorOptions, MenuItemConstructorOptions } from 'electron'
import {
  EMPTY_APP_MENU_CONTEXT,
  type AppMenuAction,
  type AppMenuContext
} from '../shared/appMenu'

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
function windowShell(platform: NodeJS.Platform, preload: string, devTools: boolean): BrowserWindowConstructorOptions {
  const isWindows = platform === 'win32'

  return {
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
      webviewTag: true,
      devTools
    }
  }
}

export function createWindowOptions(
  platform: NodeJS.Platform,
  preload: string,
  devTools: boolean
): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...windowShell(platform, preload, devTools),
    ...(platform === 'darwin' ? { vibrancy: 'under-window' as const } : {})
  }
}

// One thread on its own. It holds a column of messages and nothing beside it,
// so it opens narrow and tall and may be taken in further than the app window
// ever goes.
export function createThreadWindowOptions(
  platform: NodeJS.Platform,
  preload: string,
  devTools: boolean
): BrowserWindowConstructorOptions {
  return {
    width: 720,
    height: 900,
    minWidth: 460,
    minHeight: 520,
    ...windowShell(platform, preload, devTools)
  }
}

export function createPersonalChatWindowOptions(
  platform: NodeJS.Platform,
  preload: string,
  devTools: boolean
): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    show: false,
    ...windowShell(platform, preload, devTools),
    ...(platform === 'darwin' ? { vibrancy: 'under-window' as const } : {})
  }
}

export function createStickiesWindowOptions(
  platform: NodeJS.Platform,
  preload: string,
  devTools: boolean,
  single: boolean
): BrowserWindowConstructorOptions {
  return {
    width: single ? 300 : 1080,
    height: single ? 250 : 780,
    minWidth: single ? 100 : 700,
    minHeight: single ? 80 : 500,
    show: false,
    ...windowShell(platform, preload, devTools),
    ...(platform === 'darwin' && !single ? { vibrancy: 'under-window' as const } : {})
  }
}

function editMenuItem(command: 'undo' | 'redo', isMac: boolean): MenuItemConstructorOptions {
  const key = command === 'undo' ? 'Z' : isMac ? 'Shift+Z' : 'Y'
  const modifier = isMac ? 'Cmd' : 'Ctrl'
  return {
    label: command === 'undo' ? 'Undo' : 'Redo',
    accelerator: `${modifier}+${key}`,
    click: (_item, window) => {
      if (!window) return
      const contents = (window as BrowserWindow).webContents
      void contents
        .executeJavaScript("document.activeElement?.dataset.editHistory === 'file'")
        .then((file: boolean) => {
          if (file) {
            return contents.executeJavaScript(
              `document.activeElement?.dispatchEvent(new CustomEvent('crew-edit-command', { detail: '${command}' }))`
            )
          }
          contents[command]()
        })
        .catch(() => contents[command]())
    }
  }
}

export interface AppMenuOptions {
  context?: AppMenuContext
  onAction?: (action: AppMenuAction) => void
  recent?: Array<{ label: string; click: () => void }>
}

function action(
  options: AppMenuOptions,
  id: AppMenuAction,
  item: Omit<MenuItemConstructorOptions, 'click'>
): MenuItemConstructorOptions {
  return { ...item, click: () => options.onAction?.(id) }
}

export function appMenuTemplate(
  platform: NodeJS.Platform,
  devTools: boolean,
  options: AppMenuOptions = {}
): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin'
  const context = options.context ?? EMPTY_APP_MENU_CONTEXT
  const session = context.session
  const thread = session && Boolean(context.threadId)
  const recent = options.recent?.length
    ? options.recent.map(item => ({ label: item.label, click: item.click }))
    : [{ label: 'No Recent Crews', enabled: false }]
  const crewMenu: MenuItemConstructorOptions = {
    label: 'Crew',
    submenu: [
      ...(isMac ? [{ role: 'about' as const }, { type: 'separator' as const }] : []),
      action(options, 'settings', { label: 'Settings…', accelerator: isMac ? 'Cmd+,' : 'Ctrl+,' }),
      action(options, 'check-updates', { label: 'Check for Updates…' }),
      { type: 'separator' },
      action(options, 'invite', { label: 'Invite Someone…', enabled: session }),
      action(options, 'copy-invite-link', { label: 'Copy Invite Link', enabled: session }),
      action(options, 'people', { label: 'People', enabled: session }),
      action(options, 'agents', { label: 'Agents', enabled: session }),
      ...(isMac
        ? [
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        : [{ type: 'separator' as const }, { role: 'quit' as const }])
    ]
  }
  return [
    crewMenu,
    {
      label: 'File',
      submenu: [
        action(options, 'new-thread', { label: 'New Thread', accelerator: 'CmdOrCtrl+N', enabled: session }),
        action(options, 'new-page', {
          label: 'New Page',
          accelerator: 'CmdOrCtrl+Shift+N',
          enabled: session
        }),
        action(options, 'new-board', { label: 'New Board', enabled: session }),
        action(options, 'new-sticky', { label: 'New Sticky', accelerator: 'CmdOrCtrl+Alt+N' }),
        { type: 'separator' },
        action(options, 'open-crew', { label: 'Open Crew…', accelerator: 'CmdOrCtrl+O' }),
        action(options, 'join-crew', { label: 'Join Crew…' }),
        { label: 'Open Recent', submenu: recent },
        action(options, 'reveal-crew', { label: 'Reveal Crew in Finder', enabled: session }),
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        editMenuItem('undo', isMac),
        editMenuItem('redo', isMac),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'toggleSpellChecker' as const },
              {
                label: 'Substitutions',
                submenu: [
                  { role: 'showSubstitutions' as const },
                  { type: 'separator' as const },
                  { role: 'toggleSmartQuotes' as const },
                  { role: 'toggleSmartDashes' as const },
                  { role: 'toggleTextReplacement' as const }
                ]
              },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }]
              }
            ]
          : [])
      ]
    },
    {
      label: 'View',
      submenu: [
        action(options, 'command-palette', {
          label: 'Command Palette…',
          accelerator: 'CmdOrCtrl+Shift+P',
          enabled: session
        }),
        { type: 'separator' },
        action(options, 'toggle-sidebar', { label: 'Show Sidebar', type: 'checkbox', checked: context.sidebar, enabled: session }),
        action(options, 'toggle-panel', { label: 'Show Side Panel', type: 'checkbox', checked: context.panel, enabled: session }),
        {
          label: 'Open Panel',
          enabled: session,
          submenu: [
            action(options, 'panel-review', { label: 'Review' }),
            action(options, 'panel-terminal', { label: 'Terminal' }),
            action(options, 'panel-files', { label: 'Files' }),
            action(options, 'panel-web', { label: 'Web' }),
            action(options, 'panel-music', { label: 'Music' }),
            action(options, 'panel-games', { label: 'Games' })
          ]
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(devTools
          ? [
              { type: 'separator' as const },
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const }
            ]
          : [])
      ]
    },
    {
      label: 'Go',
      submenu: [
        action(options, 'go-back', { label: 'Back', accelerator: 'CmdOrCtrl+[' }),
        action(options, 'go-forward', { label: 'Forward', accelerator: 'CmdOrCtrl+]' }),
        { type: 'separator' },
        action(options, 'go-chat', { label: 'Chat', accelerator: 'CmdOrCtrl+1', enabled: session }),
        action(options, 'go-docs', { label: 'Docs', accelerator: 'CmdOrCtrl+2', enabled: session }),
        action(options, 'go-design', { label: 'Design', accelerator: 'CmdOrCtrl+3', enabled: session }),
        action(options, 'go-plugins', { label: 'Plugins', accelerator: 'CmdOrCtrl+4', enabled: session }),
        action(options, 'go-scheduled', { label: 'Scheduled', accelerator: 'CmdOrCtrl+5', enabled: session }),
        action(options, 'go-stickies', { label: 'Stickies', accelerator: 'CmdOrCtrl+6' }),
        action(options, 'go-browser', { label: 'Browser', accelerator: 'CmdOrCtrl+7', enabled: session }),
        action(options, 'go-mail', { label: 'Mail', accelerator: 'CmdOrCtrl+8', enabled: session })
      ]
    },
    {
      label: 'Thread',
      enabled: thread,
      submenu: [
        action(options, 'thread-window', { label: 'Open in Window', enabled: thread }),
        { type: 'separator' },
        action(options, 'thread-status', {
          label: context.threadStatus === 'done' ? 'Reopen' : 'Mark Done',
          enabled: thread
        }),
        action(options, 'thread-archive', { label: 'Archive Thread', enabled: thread }),
        action(options, 'thread-copy-id', { label: 'Copy Thread ID', enabled: thread }),
        { type: 'separator' },
        action(options, 'window-pin', {
          label: context.pinned ? 'Stop Keeping Window on Top' : 'Keep Window on Top',
          enabled: thread
        })
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]
}
