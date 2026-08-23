// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const { DEFAULT_WIDTH, MINIMIZE_AT, MIN_WIDTH, useBrowser } = await import('../src/renderer/src/state/browser')
const PanelToggle = (await import('../src/renderer/src/components/PanelToggle')).default
const SidePanel = (await import('../src/renderer/src/components/SidePanel')).default

const view = () => render(createElement('div', null, createElement(PanelToggle), createElement(SidePanel)))

const handle = () => document.querySelector('.cursor-col-resize') as Element

// The way back is never taken out of the tree, so it can travel in and out. What
// says it is standing is whether it is in the accessibility tree at all.
const wayBack = () => screen.queryByRole('button', { name: 'Show panel' })

const dragTo = (start: number, ...steps: number[]) => {
  fireEvent.pointerDown(handle(), { clientX: start })
  for (const at of steps) act(() => void fireEvent.pointerMove(window, { clientX: at }))
  act(() => void fireEvent.pointerUp(window, { clientX: steps[steps.length - 1] ?? start }))
}

beforeEach(() => {
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  act(() => useBrowser.setState({ tabs: [], activeTabId: null, open: false, width: DEFAULT_WIDTH, fullScreen: false }))
  act(() => useBrowser.getState().addTab())
})

afterEach(cleanup)

describe('putting the side panel away by its own edge', () => {
  it('follows the pointer down to the floor and no further', () => {
    view()
    dragTo(0, DEFAULT_WIDTH - MIN_WIDTH)

    expect(useBrowser.getState().open).toBe(true)
    expect(useBrowser.getState().width).toBe(MIN_WIDTH)
  })

  it('goes altogether once the drag is past the threshold', () => {
    view()
    dragTo(0, DEFAULT_WIDTH - MINIMIZE_AT + 1)

    expect(useBrowser.getState().open).toBe(false)
    expect(useBrowser.getState().tabs).toHaveLength(1)
  })

  it('stands up again when the same drag turns around', () => {
    view()
    fireEvent.pointerDown(handle(), { clientX: 0 })
    act(() => void fireEvent.pointerMove(window, { clientX: DEFAULT_WIDTH }))
    expect(useBrowser.getState().open).toBe(false)

    act(() => void fireEvent.pointerMove(window, { clientX: 0 }))
    act(() => void fireEvent.pointerUp(window, { clientX: 0 }))

    expect(useBrowser.getState().open).toBe(true)
    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
  })

  it('is what raises the way back, and pressing it takes the way back away', () => {
    view()
    expect(wayBack()).toBeNull()

    dragTo(0, DEFAULT_WIDTH)
    const button = wayBack()!

    fireEvent.click(button)

    expect(useBrowser.getState().open).toBe(true)
    expect(useBrowser.getState().width).toBe(DEFAULT_WIDTH)
    expect(wayBack()).toBeNull()
  })
})
