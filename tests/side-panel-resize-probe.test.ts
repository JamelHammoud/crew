// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { useBrowser, DEFAULT_WIDTH } = await import('../src/renderer/src/state/browser')
const SidePanel = (await import('../src/renderer/src/components/SidePanel')).default

beforeEach(() => {
  vi.useFakeTimers()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null, width: DEFAULT_WIDTH })
  useBrowser.getState().openUrl('https://example.com')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const open = () => {
  const { container } = render(createElement(SidePanel, { visible: true }))
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
