import type { ContextMenuParams, MenuItemConstructorOptions, WebContents } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const copied = vi.hoisted(() => [] as string[])
const opened = vi.hoisted(() => [] as string[])
const built = vi.hoisted(() => [] as MenuItemConstructorOptions[][])
const popups = vi.hoisted(() => [] as unknown[])
const owner = vi.hoisted(() => ({ id: 'window' }))

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => owner },
  clipboard: { writeText: (value: string) => copied.push(value) },
  Menu: {
    buildFromTemplate: (items: MenuItemConstructorOptions[]) => {
      built.push(items)
      return { popup: (options: unknown) => popups.push(options) }
    }
  },
  shell: { openExternal: (value: string) => opened.push(value) }
}))

const { contextMenuTemplate, installContextMenu } = await import('../src/main/context-menu')

function params(overrides: Partial<ContextMenuParams> = {}): ContextMenuParams {
  return {
    x: 40,
    y: 60,
    linkURL: '',
    srcURL: '',
    mediaType: 'none',
    hasImageContents: false,
    isEditable: false,
    selectionText: '',
    misspelledWord: '',
    dictionarySuggestions: [],
    ...overrides
  } as ContextMenuParams
}

function contents(back = false, forward = false) {
  const calls: string[] = []
  const sent: unknown[][] = []
  const words: string[] = []
  const target = {
    navigationHistory: {
      canGoBack: () => back,
      canGoForward: () => forward,
      goBack: () => calls.push('back'),
      goForward: () => calls.push('forward')
    },
    reload: () => calls.push('reload'),
    copyImageAt: (x: number, y: number) => calls.push(`image:${x}:${y}`),
    cut: () => calls.push('cut'),
    copy: () => calls.push('copy'),
    paste: () => calls.push('paste'),
    selectAll: () => calls.push('select-all'),
    replaceMisspelling: (word: string) => words.push(word),
    inspectElement: (x: number, y: number) => calls.push(`inspect:${x}:${y}`),
    session: { addWordToSpellCheckerDictionary: (word: string) => words.push(word) },
    hostWebContents: { send: (...values: unknown[]) => sent.push(values) }
  } as unknown as WebContents
  return { target, calls, sent, words }
}

function item(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions {
  return items.find(one => one.label === label)!
}

function press(items: MenuItemConstructorOptions[], label: string): void {
  item(items, label).click?.({} as never, undefined, {} as never)
}

beforeEach(() => {
  copied.length = 0
  opened.length = 0
  built.length = 0
  popups.length = 0
})

describe('the web browser context menu', () => {
  it('always offers navigation for an ordinary page', () => {
    const page = contents(true, false)
    const menu = contextMenuTemplate(page.target, params(), true, false)

    expect(menu.map(one => one.label ?? one.type)).toEqual(['Back', 'Forward', 'Reload'])
    expect(item(menu, 'Back').enabled).toBe(true)
    expect(item(menu, 'Forward').enabled).toBe(false)

    press(menu, 'Back')
    press(menu, 'Reload')
    expect(page.calls).toEqual(['back', 'reload'])
  })

  it('opens the native menu when the webview raises a right click', () => {
    const page = contents()
    let contextMenu: ((event: unknown, value: ContextMenuParams) => void) | undefined
    Object.assign(page.target, {
      on: (event: string, listener: (event: unknown, value: ContextMenuParams) => void) => {
        if (event === 'context-menu') contextMenu = listener
      }
    })

    installContextMenu(page.target, true, false)
    contextMenu?.({}, params())

    expect(built).toHaveLength(1)
    expect(built[0].map(one => one.label)).toEqual(['Back', 'Forward', 'Reload'])
    expect(popups).toEqual([{ window: owner }])
  })

  it('opens and copies links from the page', () => {
    const page = contents()
    const menu = contextMenuTemplate(page.target, params({ linkURL: 'https://crew.example/thread/7' }), true, false)

    press(menu, 'Open Link in New Tab')
    press(menu, 'Open Link in Your Browser')
    press(menu, 'Copy Link')

    expect(page.sent).toEqual([['browser:open', 'https://crew.example/thread/7']])
    expect(opened).toEqual(['https://crew.example/thread/7'])
    expect(copied).toEqual(['https://crew.example/thread/7'])
  })

  it('copies an image or its address', () => {
    const page = contents()
    const menu = contextMenuTemplate(
      page.target,
      params({
        x: 14,
        y: 22,
        mediaType: 'image',
        hasImageContents: true,
        srcURL: 'https://crew.example/pet.png'
      }),
      true,
      false
    )

    press(menu, 'Copy Image')
    press(menu, 'Copy Image Address')

    expect(page.calls).toEqual(['image:14:22'])
    expect(copied).toEqual(['https://crew.example/pet.png'])
  })

  it('targets the page for editing actions and spellcheck', () => {
    const page = contents()
    const menu = contextMenuTemplate(
      page.target,
      params({
        isEditable: true,
        selectionText: 'helo',
        misspelledWord: 'helo',
        dictionarySuggestions: ['hello']
      }),
      true,
      false
    )

    press(menu, 'hello')
    press(menu, 'Add to Dictionary')
    press(menu, 'Cut')
    press(menu, 'Copy')
    press(menu, 'Paste')
    press(menu, 'Select All')

    expect(page.words).toEqual(['hello', 'helo'])
    expect(page.calls).toEqual(['cut', 'copy', 'paste', 'select-all'])
  })

  it('offers inspection only in a source build', () => {
    const page = contents()
    const shipped = contextMenuTemplate(page.target, params(), true, false)
    const source = contextMenuTemplate(page.target, params(), true, true)

    expect(shipped.some(one => one.label === 'Inspect')).toBe(false)
    press(source, 'Inspect')
    expect(page.calls).toEqual(['inspect:40:60'])
  })
})

describe('the app context menu', () => {
  it('stays closed where there is nothing to act on', () => {
    expect(contextMenuTemplate(contents().target, params(), false, false)).toEqual([])
  })

  it('keeps text field actions without browser navigation', () => {
    const menu = contextMenuTemplate(contents().target, params({ isEditable: true }), false, false)

    expect(menu.map(one => one.label ?? one.type)).toEqual(['Cut', 'Copy', 'Paste', 'separator', 'Select All'])
  })
})
