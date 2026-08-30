import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it } from 'vitest'
import {
  appMenuTemplate,
  closePutsAway,
  createPanelOptions,
  createPersonalChatWindowOptions,
  createScribeOptions,
  createStickiesWindowOptions,
  createThreadWindowOptions,
  createWindowOptions
} from '../src/main/window-options'

const SIZE = { width: 272, height: 64 }

function everyItem(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return template.flatMap(item => {
    const submenu = item.submenu
    return [item, ...(Array.isArray(submenu) ? everyItem(submenu) : [])]
  })
}

function everyRole(template: MenuItemConstructorOptions[]): string[] {
  return everyItem(template)
    .map(item => item.role)
    .filter((role): role is NonNullable<typeof role> => typeof role === 'string')
}

function viewRows(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  const view = template.find(item => item.label === 'View')
  const submenu = view?.submenu
  return Array.isArray(submenu) ? submenu : []
}

function labeled(template: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions {
  const found = everyItem(template).find(item => item.label === label)
  if (!found) throw new Error(`Missing menu item: ${label}`)
  return found
}

describe('tray panel options', () => {
  // skipTaskbar turns the app into an accessory on macOS: the panel opens and
  // the icon leaves the dock, with no way back.
  it('never asks to be left out of the taskbar, which would empty the dock', () => {
    const options = createPanelOptions('preload.mjs', { width: 272, height: 64 }, true)

    expect(options.skipTaskbar).toBeUndefined()
  })

  it('is a frameless window that opens hidden and is not dragged or resized', () => {
    const options = createPanelOptions('preload.mjs', { width: 272, height: 64 }, true)

    expect(options).toMatchObject({
      width: 272,
      height: 64,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false
    })
  })

  it('opens the dev tools where it was told it may', () => {
    expect(createPanelOptions('preload.mjs', SIZE, true).webPreferences?.devTools).toBe(true)
  })

  it('cannot open the dev tools where it was told it may not', () => {
    expect(createPanelOptions('preload.mjs', SIZE, false).webPreferences?.devTools).toBe(false)
  })
})

describe('dictation pill options', () => {
  it('opens the dev tools where it was told it may', () => {
    expect(createScribeOptions('darwin', 'preload.mjs', SIZE, true).webPreferences?.devTools).toBe(true)
    expect(createScribeOptions('win32', 'preload.mjs', SIZE, true).webPreferences?.devTools).toBe(true)
  })

  it('cannot open the dev tools where it was told it may not', () => {
    expect(createScribeOptions('darwin', 'preload.mjs', SIZE, false).webPreferences?.devTools).toBe(false)
    expect(createScribeOptions('win32', 'preload.mjs', SIZE, false).webPreferences?.devTools).toBe(false)
  })
})

describe('window options', () => {
  it('uses an opaque resizable window on Windows', () => {
    const options = createWindowOptions('win32', 'preload.mjs', true)

    expect(options).toMatchObject({
      transparent: false,
      backgroundColor: '#141414',
      resizable: true,
      maximizable: true
    })
  })

  it('keeps the transparent window on macOS', () => {
    const options = createWindowOptions('darwin', 'preload.mjs', true)

    expect(options).toMatchObject({
      transparent: true,
      backgroundColor: '#00000000'
    })
  })

  it('carries the material the pinned rail is a hole onto', () => {
    expect(createWindowOptions('darwin', 'preload.mjs', true).vibrancy).toBe('under-window')
    expect(createWindowOptions('win32', 'preload.mjs', true).vibrancy).toBeUndefined()
  })

  it('opens the dev tools where it was told it may', () => {
    expect(createWindowOptions('darwin', 'preload.mjs', true).webPreferences?.devTools).toBe(true)
    expect(createWindowOptions('win32', 'preload.mjs', true).webPreferences?.devTools).toBe(true)
  })

  it('cannot open the dev tools where it was told it may not', () => {
    expect(createWindowOptions('darwin', 'preload.mjs', false).webPreferences?.devTools).toBe(false)
    expect(createWindowOptions('win32', 'preload.mjs', false).webPreferences?.devTools).toBe(false)
  })
})

describe('thread window options', () => {
  it('opens the dev tools where it was told it may', () => {
    expect(createThreadWindowOptions('darwin', 'preload.mjs', true).webPreferences?.devTools).toBe(true)
    expect(createThreadWindowOptions('win32', 'preload.mjs', true).webPreferences?.devTools).toBe(true)
  })

  it('cannot open the dev tools where it was told it may not', () => {
    expect(createThreadWindowOptions('darwin', 'preload.mjs', false).webPreferences?.devTools).toBe(false)
    expect(createThreadWindowOptions('win32', 'preload.mjs', false).webPreferences?.devTools).toBe(false)
  })

  it('is a narrower column than the app window and may be taken in further', () => {
    const thread = createThreadWindowOptions('darwin', 'preload.mjs', true)
    const whole = createWindowOptions('darwin', 'preload.mjs', true)

    expect(thread.width ?? 0).toBeLessThan(whole.width ?? 0)
    expect(thread.minWidth ?? 0).toBeLessThan(whole.minWidth ?? 0)
    expect(thread.minHeight ?? 0).toBeLessThan(whole.minHeight ?? 0)
  })

  it('keeps the inset title bar the app window wears', () => {
    expect(createThreadWindowOptions('darwin', 'preload.mjs', true).titleBarStyle).toBe('hiddenInset')
    expect(createThreadWindowOptions('win32', 'preload.mjs', true).titleBarStyle).toBe('hiddenInset')
  })

  it('wears the same surface as the app window on either platform', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const thread = createThreadWindowOptions(platform, 'preload.mjs', true)
      const whole = createWindowOptions(platform, 'preload.mjs', true)

      expect(thread.transparent).toBe(whole.transparent)
      expect(thread.backgroundColor).toBe(whole.backgroundColor)
      expect(thread.webPreferences?.webviewTag).toBe(true)
      expect(thread.webPreferences?.spellcheck).toBe(true)
    }
  })
})

describe('personal chat window options', () => {
  it('holds a conversation beside its chat list', () => {
    const personal = createPersonalChatWindowOptions('darwin', 'preload.mjs', true)
    const thread = createThreadWindowOptions('darwin', 'preload.mjs', true)

    expect(personal.width).toBe(1200)
    expect(personal.height).toBe(800)
    expect(personal.width ?? 0).toBeGreaterThan(thread.width ?? 0)
    expect(personal.minWidth).toBe(760)
    expect(personal.minHeight).toBe(thread.minHeight)
  })

  it('stays hidden until its first frame is ready', () => {
    expect(createPersonalChatWindowOptions('darwin', 'preload.mjs', true).show).toBe(false)
    expect(createPersonalChatWindowOptions('win32', 'preload.mjs', true).show).toBe(false)
  })

  it('wears the same native shell as the other chat window', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const personal = createPersonalChatWindowOptions(platform, 'preload.mjs', false)
      const thread = createThreadWindowOptions(platform, 'preload.mjs', false)

      expect(personal.titleBarStyle).toBe(thread.titleBarStyle)
      expect(personal.transparent).toBe(thread.transparent)
      expect(personal.webPreferences).toEqual(thread.webPreferences)
    }
  })

  it('opens the macOS material behind its glass sidebar', () => {
    expect(createPersonalChatWindowOptions('darwin', 'preload.mjs', false).vibrancy).toBe('under-window')
    expect(createPersonalChatWindowOptions('win32', 'preload.mjs', false).vibrancy).toBeUndefined()
  })
})

describe('Stickies window options', () => {
  it('gives the library room for its list and editor', () => {
    const library = createStickiesWindowOptions('darwin', 'preload.mjs', true, false)
    const single = createStickiesWindowOptions('darwin', 'preload.mjs', true, true)

    expect(library.width ?? 0).toBeGreaterThan(single.width ?? 0)
    expect(library.minWidth ?? 0).toBeGreaterThan(single.minWidth ?? 0)
    expect(library.show).toBe(false)
    expect(single.show).toBe(false)
  })

  it('lets one sticky shrink to a compact note', () => {
    const single = createStickiesWindowOptions('darwin', 'preload.mjs', true, true)

    expect(single.width).toBe(300)
    expect(single.height).toBe(250)
    expect(single.minWidth).toBe(100)
    expect(single.minHeight).toBe(80)
  })

  it('wears the same native shell in both forms', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const library = createStickiesWindowOptions(platform, 'preload.mjs', false, false)
      const single = createStickiesWindowOptions(platform, 'preload.mjs', false, true)

      expect(library.titleBarStyle).toBe('hiddenInset')
      expect(single.titleBarStyle).toBe(library.titleBarStyle)
      expect(single.transparent).toBe(library.transparent)
      expect(single.webPreferences).toEqual(library.webPreferences)
    }
  })

  it('opens the macOS material behind the library sidebar only', () => {
    expect(createStickiesWindowOptions('darwin', 'preload.mjs', false, false).vibrancy).toBe('under-window')
    expect(createStickiesWindowOptions('darwin', 'preload.mjs', false, true).vibrancy).toBeUndefined()
    expect(createStickiesWindowOptions('win32', 'preload.mjs', false, false).vibrancy).toBeUndefined()
  })
})

describe('the application menu', () => {
  it('offers the dev tools where they are allowed', () => {
    expect(everyRole(appMenuTemplate('darwin', true))).toContain('toggleDevTools')
    expect(everyRole(appMenuTemplate('win32', true))).toContain('toggleDevTools')
  })

  it('offers them from a submenu rather than from the menu bar itself', () => {
    const template = appMenuTemplate('darwin', true)

    expect(template.some(item => item.role === 'toggleDevTools')).toBe(false)
    expect(everyItem(template).some(item => item.role === 'toggleDevTools')).toBe(true)
  })

  it('holds them nowhere at all where they are not allowed', () => {
    expect(everyRole(appMenuTemplate('darwin', false))).not.toContain('toggleDevTools')
    expect(everyRole(appMenuTemplate('win32', false))).not.toContain('toggleDevTools')
  })

  it('keeps zooming and full screen in every build', () => {
    const kept = ['resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']

    for (const platform of ['darwin', 'win32'] as const) {
      for (const devTools of [true, false]) {
        const rows = viewRows(appMenuTemplate(platform, devTools)).map(row => row.role)

        for (const role of kept) expect(rows).toContain(role)
      }
    }
  })

  it('keeps reload commands in development builds only', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const development = viewRows(appMenuTemplate(platform, true)).map(row => row.role)
      const shipped = viewRows(appMenuTemplate(platform, false)).map(row => row.role)

      expect(development).toContain('reload')
      expect(development).toContain('forceReload')
      expect(shipped).not.toContain('reload')
      expect(shipped).not.toContain('forceReload')
    }
  })

  it('wires up the clipboard, which nothing does without a menu', () => {
    for (const devTools of [true, false]) {
      const roles = everyRole(appMenuTemplate('darwin', devTools))

      for (const role of ['cut', 'copy', 'paste', 'selectAll']) {
        expect(roles).toContain(role)
      }
      const items = everyItem(appMenuTemplate('darwin', devTools))
      expect(items.find(item => item.label === 'Undo')?.accelerator).toBe('Cmd+Z')
      expect(items.find(item => item.label === 'Redo')?.accelerator).toBe('Cmd+Shift+Z')
    }
  })

  it('opens with Crew on macOS', () => {
    expect(appMenuTemplate('darwin', true)[0]?.label).toBe('Crew')
    expect(appMenuTemplate('darwin', false)[0]?.label).toBe('Crew')
    expect(everyRole(appMenuTemplate('darwin', true))).toContain('about')
    expect(everyRole(appMenuTemplate('darwin', true))).toContain('quit')
  })

  it('uses the same named Crew menu on Windows without macOS-only roles', () => {
    expect(appMenuTemplate('win32', true)[0]?.label).toBe('Crew')
    expect(appMenuTemplate('win32', false)[0]?.label).toBe('Crew')
    expect(everyRole(appMenuTemplate('win32', true))).not.toContain('appMenu')
    expect(everyRole(appMenuTemplate('win32', true))).not.toContain('about')
    expect(everyRole(appMenuTemplate('win32', true))).toContain('quit')
  })

  it('restores the macOS spelling, substitutions and speech rows', () => {
    const roles = everyRole(appMenuTemplate('darwin', false))

    for (const role of [
      'toggleSpellChecker',
      'showSubstitutions',
      'toggleSmartQuotes',
      'toggleSmartDashes',
      'toggleTextReplacement',
      'startSpeaking',
      'stopSpeaking'
    ]) {
      expect(roles).toContain(role)
    }
  })

  it('dispatches Crew actions from native rows', () => {
    const pressed: string[] = []
    const template = appMenuTemplate('darwin', false, {
      context: {
        session: true,
        threadId: 'thread-1',
        threadStatus: 'open',
        sidebar: false,
        panel: false,
        pinned: false
      },
      onAction: action => pressed.push(action)
    })

    labeled(template, 'New Page').click?.({} as never, undefined, {} as never)
    labeled(template, 'Open in Window').click?.({} as never, undefined, {} as never)

    expect(pressed).toEqual(['new-page', 'thread-window'])
  })

  it('holds session and thread rows until their context exists', () => {
    const home = appMenuTemplate('darwin', false)
    const thread = appMenuTemplate('darwin', false, {
      context: {
        session: true,
        threadId: 'thread-1',
        threadStatus: 'done',
        sidebar: true,
        panel: true,
        pinned: true
      }
    })

    expect(labeled(home, 'New Thread').enabled).toBe(false)
    expect(labeled(home, 'Thread').enabled).toBe(false)
    expect(labeled(thread, 'Thread').enabled).toBe(true)
    expect(labeled(thread, 'Reopen').enabled).toBe(true)
    expect(labeled(thread, 'Show Sidebar').checked).toBe(true)
    expect(labeled(thread, 'Show Side Panel').checked).toBe(true)
    expect(labeled(thread, 'Stop Keeping Window on Top').enabled).toBe(true)
  })

  it('shows real recent Crews and an empty row when there are none', () => {
    const open = () => undefined
    const withRecent = appMenuTemplate('darwin', false, {
      recent: [{ label: 'crew', click: open }]
    })

    expect(labeled(withRecent, 'crew').click).toBe(open)
    expect(labeled(appMenuTemplate('darwin', false), 'No Recent Crews').enabled).toBe(false)
  })
})

describe('closing a window', () => {
  it('puts it away on macOS, where the app goes on running', () => {
    expect(closePutsAway('darwin', false)).toBe(true)
  })

  it('lets the close through while the app is quitting', () => {
    expect(closePutsAway('darwin', true)).toBe(false)
  })

  it('is the way out everywhere else', () => {
    expect(closePutsAway('win32', false)).toBe(false)
    expect(closePutsAway('linux', false)).toBe(false)
  })
})
