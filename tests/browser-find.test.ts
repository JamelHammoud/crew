import type { Input, WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { browserFindShortcut, installBrowserFind } from '../src/main/browser-find'

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
})
