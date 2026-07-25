// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/components/TopBar'
import { applyPlatform, onMac } from '../src/renderer/src/state/platform'

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
  vi.unstubAllGlobals()
})

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
    render(
      createElement(TopBar, {
        tab: 'chat',
        onTab: () => {},
        tasksOpen: false,
        onToggleTasks: () => {}
      })
    )

    const inset = screen.getByRole('banner').firstElementChild!

    expect(inset.className).toContain('mac:pl-[64px]')
    expect(inset.className).not.toMatch(/(^|\s)pl-/)
  })
})
