// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const { useBrowser, DEFAULT_WIDTH } = await import('../src/renderer/src/state/browser')
const SidePanel = (await import('../src/renderer/src/components/SidePanel')).default

beforeEach(() => {
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null, width: DEFAULT_WIDTH })
  useBrowser.getState().openUrl('https://example.com')
})

afterEach(() => cleanup())

const open = () => {
  const { container } = render(createElement(SidePanel, { visible: true }))
  return container.querySelector('.cursor-col-resize')!
}

const press = (handle: Element, clientX: number, timeStamp: number) =>
  fireEvent.pointerDown(handle, { clientX, timeStamp })

const release = (clientX: number, timeStamp: number) => fireEvent.pointerUp(window, { clientX, timeStamp })

const drag = (clientX: number) => fireEvent.pointerMove(window, { clientX })

describe('the panel resize bar', () => {
  it('drags the panel to a new width', () => {
    const handle = open()

    press(handle, 800, 0)
    drag(700)
    release(700, 50)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH + 100)
  })

  it('puts the width back to the default on a double click', () => {
    const handle = open()
    useBrowser.getState().setWidth(760)

    press(handle, 800, 0)
    release(800, 40)
    press(handle, 800, 90)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
  })

  it('leaves the width alone when the second click comes long after the first', () => {
    const handle = open()
    useBrowser.getState().setWidth(760)

    press(handle, 800, 0)
    release(800, 40)
    press(handle, 800, 1200)

    expect(useBrowser.getState().width).toBe(760)
  })

  it('leaves the width alone when the first press was a drag', () => {
    const handle = open()

    press(handle, 800, 0)
    drag(700)
    release(700, 50)
    press(handle, 700, 90)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH + 100)
  })

  it('takes a second click that follows a drag on its own terms', () => {
    const handle = open()

    press(handle, 800, 0)
    drag(700)
    release(700, 50)
    press(handle, 700, 90)
    release(700, 130)
    press(handle, 700, 180)

    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
  })
})
