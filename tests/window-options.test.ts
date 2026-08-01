import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it } from 'vitest'
import {
  appMenuTemplate,
  closePutsAway,
  createPanelOptions,
  createScribeOptions,
  createThreadWindowOptions,
  createWindowOptions
} from '../src/main/window-options'

const SIZE = { width: 272, height: 64 }

function everyItem(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return template.flatMap((item) => {
    const submenu = item.submenu
    return [item, ...(Array.isArray(submenu) ? everyItem(submenu) : [])]
  })
}

function everyRole(template: MenuItemConstructorOptions[]): string[] {
  return everyItem(template)
    .map((item) => item.role)
    .filter((role): role is NonNullable<typeof role> => typeof role === 'string')
}

function viewRows(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  const view = everyItem(template).find(
    (item) => Array.isArray(item.submenu) && item.submenu.some((row) => row.role === 'reload')
  )
  const submenu = view?.submenu
  return Array.isArray(submenu) ? submenu : []
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
    expect(createScribeOptions('darwin', 'preload.mjs', SIZE, true).webPreferences?.devTools).toBe(
      true
    )
    expect(createScribeOptions('win32', 'preload.mjs', SIZE, true).webPreferences?.devTools).toBe(
      true
    )
  })

  it('cannot open the dev tools where it was told it may not', () => {
    expect(createScribeOptions('darwin', 'preload.mjs', SIZE, false).webPreferences?.devTools).toBe(
      false
    )
    expect(createScribeOptions('win32', 'preload.mjs', SIZE, false).webPreferences?.devTools).toBe(
      false
    )
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

  it('opens the dev tools where it was told it may', () => {
    expect(createWindowOptions('darwin', 'preload.mjs', true).webPreferences?.devTools).toBe(true)
    expect(createWindowOptions('win32', 'preload.mjs', true).webPreferences?.devTools).toBe(true)
  })

  it('cannot open the dev tools where it was told it may not', () => {
    expect(createWindowOptions('darwin', 'preload.mjs', false).webPreferences?.devTools).toBe(false)
    expect(createWindowOptions('win32', 'preload.mjs', false).webPreferences?.devTools).toBe(false)
  })
})

describe('the application menu', () => {
  it('offers the dev tools where they are allowed', () => {
    expect(everyRole(appMenuTemplate('darwin', true))).toContain('toggleDevTools')
    expect(everyRole(appMenuTemplate('win32', true))).toContain('toggleDevTools')
  })

  it('offers them from a submenu rather than from the menu bar itself', () => {
    const template = appMenuTemplate('darwin', true)

    expect(template.some((item) => item.role === 'toggleDevTools')).toBe(false)
    expect(everyItem(template).some((item) => item.role === 'toggleDevTools')).toBe(true)
  })

  it('holds them nowhere at all where they are not allowed', () => {
    expect(everyRole(appMenuTemplate('darwin', false))).not.toContain('toggleDevTools')
    expect(everyRole(appMenuTemplate('win32', false))).not.toContain('toggleDevTools')
  })

  it('keeps reloading, zooming and full screen either way', () => {
    const kept = ['reload', 'forceReload', 'resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']

    for (const platform of ['darwin', 'win32'] as const) {
      for (const devTools of [true, false]) {
        const rows = viewRows(appMenuTemplate(platform, devTools)).map((row) => row.role)

        for (const role of kept) expect(rows).toContain(role)
      }
    }
  })

  it('wires up the clipboard, which nothing does without a menu', () => {
    for (const devTools of [true, false]) {
      const roles = everyRole(appMenuTemplate('darwin', devTools))

      for (const role of ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']) {
        expect(roles).toContain(role)
      }
    }
  })

  it('opens with the app menu on macOS', () => {
    expect(appMenuTemplate('darwin', true)[0]?.role).toBe('appMenu')
    expect(appMenuTemplate('darwin', false)[0]?.role).toBe('appMenu')
  })

  it('has no app menu to open with on Windows', () => {
    expect(appMenuTemplate('win32', true)[0]?.role).not.toBe('appMenu')
    expect(appMenuTemplate('win32', false)[0]?.role).not.toBe('appMenu')
    expect(everyRole(appMenuTemplate('win32', true))).not.toContain('appMenu')
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
