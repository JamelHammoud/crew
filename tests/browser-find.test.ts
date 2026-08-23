import type { Input, WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { browserFindShortcut, installBrowserFind, installBrowserFindForHost } from '../src/main/browser-find'

const key = (overrides: Partial<Input> = {}): Input =>
  ({
    type: 'keyDown',
    key: 'f',
    code: 'KeyF',
    isAutoRepeat: false,
    isComposing: false,
    shift: false,
    control: false,
    alt: false,
    meta: true,
    location: 0,
    ...overrides
  }) as Input

describe('webpage find shortcuts', () => {
  it('accepts Command-F and Control-F on key down', () => {
    expect(browserFindShortcut(key())).toBe(true)
    expect(browserFindShortcut(key({ meta: false, control: true, key: 'F' }))).toBe(true)
  })

  it('leaves modified, shifted and released keys with the page', () => {
    expect(browserFindShortcut(key({ alt: true }))).toBe(false)
    expect(browserFindShortcut(key({ shift: true }))).toBe(false)
    expect(browserFindShortcut(key({ type: 'keyUp' }))).toBe(false)
    expect(browserFindShortcut(key({ key: 'g' }))).toBe(false)
  })

  it('opens Crew find and keeps the shortcut out of the webpage', () => {
    let pressed = (_event: Electron.Event, _input: Input): void => undefined
    const send = vi.fn()
    const contents = {
      on: (name: string, listener: (event: Electron.Event, input: Input) => void) => {
        if (name === 'before-input-event') pressed = listener
      },
      hostWebContents: { send }
    } as unknown as WebContents
    const preventDefault = vi.fn()

    installBrowserFind(contents)
    pressed({ preventDefault } as unknown as Electron.Event, key())

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith('browser:find')
  })

  it('registers only a webview owned by the asking window and only once', () => {
    const listeners: unknown[] = []
    const host = { id: 8 } as WebContents
    const guest = {
      getType: () => 'webview',
      hostWebContents: host,
      on: (_name: string, listener: unknown) => listeners.push(listener)
    } as unknown as WebContents

    expect(installBrowserFindForHost(null, host)).toBe(false)
    expect(installBrowserFindForHost({ getType: () => 'window' } as unknown as WebContents, host)).toBe(false)
    expect(
      installBrowserFindForHost(
        { getType: () => 'webview', hostWebContents: { id: 9 } } as unknown as WebContents,
        host
      )
    ).toBe(false)
    expect(installBrowserFindForHost(guest, host)).toBe(true)
    expect(installBrowserFindForHost(guest, host)).toBe(true)
    expect(listeners).toHaveLength(1)
  })
})
