// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { useBrowser, DEFAULT_WIDTH } = await import('../src/renderer/src/state/browser')
const SidePanel = (await import('../src/renderer/src/components/SidePanel')).default

beforeEach(() => {
  vi.useFakeTimers()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null, width: DEFAULT_WIDTH, fullScreen: false })
  useBrowser.getState().openUrl('https://example.com')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const open = () => {
  const { container } = render(createElement(SidePanel))
  return container.querySelector('.cursor-col-resize')!
}

const press = (handle: Element, clientX: number) => fireEvent.pointerDown(handle, { clientX })

const release = (clientX: number) => fireEvent.pointerUp(window, { clientX })

const drag = (clientX: number) => fireEvent.pointerMove(window, { clientX })

const wait = (ms: number) => vi.advanceTimersByTime(ms)

describe('the panel resize bar', () => {
  it('drags the panel to a new width', () => {
    const handle = open()

    press(handle, 800)
    drag(700)
    release(700)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH + 100)
  })

  it('puts the width back to the default on a double click', () => {
    const handle = open()
    useBrowser.getState().setWidth(560)

    press(handle, 800)
    release(800)
    wait(60)
    press(handle, 800)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
  })

  it('leaves the width alone when the second click comes long after the first', () => {
    const handle = open()
    useBrowser.getState().setWidth(560)

    press(handle, 800)
    release(800)
    wait(1200)
    press(handle, 800)

    expect(useBrowser.getState().width).toBe(560)
  })

  it('leaves the width alone when the first press was a drag', () => {
    const handle = open()

    press(handle, 800)
    drag(700)
    release(700)
    wait(60)
    press(handle, 700)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH + 100)
  })

  it('takes a second click that follows a drag on its own terms', () => {
    const handle = open()

    press(handle, 800)
    drag(700)
    release(700)
    wait(60)
    press(handle, 700)
    release(700)
    wait(60)
    press(handle, 700)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
  })
})

describe('the full screen browser', () => {
  it('takes over the window and returns to its saved sidebar width', () => {
    const { container } = render(createElement(SidePanel))

    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))

    const takeover = container.querySelector('[data-browser-fullscreen]') as HTMLElement
    expect(useBrowser.getState().fullScreen).toBe(true)
    expect(takeover.classList.contains('fixed')).toBe(true)
    expect(takeover.classList.contains('inset-0')).toBe(true)
    expect(takeover.classList.contains('app-no-drag')).toBe(true)
    expect(takeover.querySelector('.cursor-col-resize')).toBeNull()
    expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }))

    expect(useBrowser.getState().fullScreen).toBe(false)
    expect(container.querySelector('[data-browser-fullscreen]')).toBeNull()
    expect((container.firstElementChild as HTMLElement).style.width).toBe(`${DEFAULT_WIDTH}px`)
    expect(container.querySelector('.cursor-col-resize')).toBeTruthy()
  })

  it('returns to the sidebar mode when closed', () => {
    render(createElement(SidePanel))
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(useBrowser.getState().open).toBe(false)
    expect(useBrowser.getState().fullScreen).toBe(false)
    expect(useBrowser.getState().tabs).toHaveLength(1)
  })
})
