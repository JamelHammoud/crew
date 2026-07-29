// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Modal from '../src/renderer/src/components/Modal'
import { Popover } from '../src/renderer/src/components/Popover'
import TasksPanel from '../src/renderer/src/components/TasksPanel'
import TopBar from '../src/renderer/src/components/TopBar'
import { applyPlatform, onMac } from '../src/renderer/src/state/platform'
import { fullScreen, setFullScreen } from '../src/renderer/src/state/windowShape'

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 crew/1.0'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 crew/1.0'

const asPlatform = (userAgent: string) =>
  Object.defineProperty(globalThis.navigator, 'userAgent', { value: userAgent, configurable: true })

beforeEach(() => {
  document.documentElement.classList.remove('mac')
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  setFullScreen(false)
  vi.unstubAllGlobals()
})

const topBar = () =>
  render(
    createElement(TopBar, {
      tab: 'chat',
      onTab: () => {},
      tasksOpen: false,
      onToggleTasks: () => {}
    })
  )

describe('window chrome', () => {
  it('marks the document on macOS so the stoplight inset applies', () => {
    asPlatform(MAC)
    applyPlatform()

    expect(onMac()).toBe(true)
    expect(document.documentElement.classList.contains('mac')).toBe(true)
  })

  it('leaves the document unmarked on Windows', () => {
    asPlatform(WINDOWS)
    applyPlatform()

    expect(onMac()).toBe(false)
    expect(document.documentElement.classList.contains('mac')).toBe(false)
  })

  it('gates the mark inset on the mac class instead of applying it everywhere', () => {
    topBar()

    const inset = screen.getByRole('banner').firstElementChild!

    expect(inset.className).toContain('mac:pl-[64px]')
    expect(inset.className).not.toMatch(/(^|\s)pl-/)
  })

  it('drops the inset in fullscreen, where there are no stoplights to clear', () => {
    setFullScreen(true)
    topBar()

    expect(screen.getByRole('banner').firstElementChild!.className).not.toContain('pl-[64px]')
  })

  it('puts the inset back when the window leaves fullscreen', () => {
    setFullScreen(true)
    topBar()
    act(() => setFullScreen(false))

    expect(screen.getByRole('banner').firstElementChild!.className).toContain('mac:pl-[64px]')
  })

  it('reads zoomed and fullscreen apart, since only one takes the stoplights', () => {
    setFullScreen(false)
    expect(fullScreen()).toBe(false)

    setFullScreen(true)
    expect(fullScreen()).toBe(true)
  })
})

// The window drag is flat geometry with no ladder in it, so the bar's own band
// keeps taking clicks under whatever is drawn over it. Anything that floats
// there cuts itself back out.
describe('the drag the top bar takes', () => {
  it('cuts a dialog out of it', () => {
    render(
      createElement(Modal, { open: true, onClose: () => {}, title: 'Rename' }, createElement('p', null, 'body'))
    )

    expect(screen.getByRole('dialog').parentElement!.className).toContain('app-no-drag')
  })

  it('cuts a menu out of it', () => {
    const { baseElement } = render(
      createElement(
        Popover,
        { open: true, onClose: () => {}, at: { x: 100, y: 30 } },
        createElement('button', null, 'Open')
      )
    )

    expect(baseElement.querySelector('.app-no-drag.fixed')).not.toBeNull()
  })

  it('leaves the bar itself draggable, since that is what the band is for', () => {
    topBar()

    expect(screen.getByRole('banner').className).toContain('app-drag')
  })
})

describe('the scrim behind the tasks panel', () => {
  it('stands under the top bar, so the bar is still there to press', () => {
    const { container } = render(
      createElement(TasksPanel, { open: true, onClose: () => {}, onOpenThread: () => {} })
    )

    const scrim = container.querySelector('.inset-0[class*="z-"]')!

    expect(scrim.className).toContain('z-30')
    expect(scrim.className).not.toContain('z-40')
  })
})
