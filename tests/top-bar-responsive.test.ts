// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HeaderSlot from '../src/renderer/src/components/HeaderSlot'
import TopBar from '../src/renderer/src/components/TopBar'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useHeaderSlot } from '../src/renderer/src/state/headerSlot'
import { useCrew } from '../src/renderer/src/state/store'

const observers = new Set<() => void>()

beforeEach(() => {
  observers.clear()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private callback: () => void

      constructor(callback: () => void) {
        this.callback = callback
      }

      observe() {
        observers.add(this.callback)
      }

      disconnect() {
        observers.delete(this.callback)
      }
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  useCrew.setState({ members: [], agents: [], activePrompts: {} })
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
})

const follows = (first: Element, second: Element) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

const setHeaderWidth = (width: number) => {
  const header = document.querySelector('header')!
  Object.defineProperty(header, 'clientWidth', { value: width, configurable: true })
  act(() => observers.forEach(notify => notify()))
}

describe('responsive top bar', () => {
  it('leaves the pages to the rail and keeps the controls at the end of the bar', () => {
    render(
      createElement(TopBar)
    )

    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Docs' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Design' })).toBeNull()
    expect(document.querySelector('.top-bar > .col-start-3')).not.toBeNull()
  })

  it('leaves the toolbox and the tasks to the rail as well', () => {
    render(createElement(TopBar))

    expect(screen.queryByRole('button', { name: 'Toolbox' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tasks' })).toBeNull()
  })

  it('holds the middle of the bar open for whatever page is up', () => {
    render(createElement(TopBar))
    render(createElement(HeaderSlot, { children: createElement('button', null, 'Untitled') }))

    const slot = useHeaderSlot.getState().nodes.center!
    const centre = screen.getByRole('button', { name: 'Untitled' })

    expect(slot.className).toContain('justify-center')
    expect(slot.className).toContain('app-no-drag')
    expect(slot.contains(centre)).toBe(true)
    expect(follows(useHeaderSlot.getState().nodes.left!, slot)).toBe(true)
    expect(follows(slot, document.querySelector('.top-bar > .col-start-3')!)).toBe(true)
  })

  it('opens both ends of the bar to a page as well as the middle', () => {
    render(createElement(TopBar))
    render(createElement(HeaderSlot, { place: 'left', children: createElement('button', null, 'Board') }))
    render(createElement(HeaderSlot, { place: 'right', children: createElement('button', null, 'Zoom') }))

    const { left, right } = useHeaderSlot.getState().nodes

    expect(left!.contains(screen.getByRole('button', { name: 'Board' }))).toBe(true)
    expect(right!.contains(screen.getByRole('button', { name: 'Zoom' }))).toBe(true)
    expect(follows(left!, right!)).toBe(true)
    expect(follows(right!, screen.getByRole('button', { name: 'Settings' }))).toBe(true)
  })

  it('paints a page band behind everything it holds rather than over it', () => {
    render(createElement(TopBar))

    const band = useHeaderSlot.getState().nodes.backdrop!

    expect(band.className).toContain('absolute')
    expect(band.className).toContain('pointer-events-none')
    for (const place of ['left', 'center', 'right'] as const) {
      expect(follows(band, useHeaderSlot.getState().nodes[place]!)).toBe(true)
    }
  })

  it('starts the left of the bar where the window corner ends, and takes it back over the rail', () => {
    render(createElement(TopBar))
    act(() => useHeaderSlot.getState().measure('corner', 206))

    expect(useHeaderSlot.getState().nodes.left!.style.paddingLeft).toBe('182px')

    act(() => useSidebar.setState({ pinned: true }))
    expect(useHeaderSlot.getState().nodes.left!.style.paddingLeft).toBe('0px')
    act(() => useSidebar.setState({ pinned: false }))
  })

  it('keeps the faces together at the end of the bar, in front of your own', () => {
    useCrew.setState({
      selfId: 'self',
      selfName: 'Jamel',
      members: [
        { id: 'self', name: 'Jamel', connected: true },
        { id: 'm1', name: 'Ali', connected: true }
      ],
      agents: [],
      activePrompts: {}
    })
    render(
      createElement(TopBar)
    )

    const faces = screen.getByRole('button', { name: "Who's here" })
    const you = screen.getByRole('button', { name: 'Settings' })

    expect(follows(faces, you)).toBe(true)
  })

  it('collapses the presence faces into a count when the bar runs short', () => {
    useCrew.setState({
      selfId: 'self',
      selfName: 'Jamel',
      members: [
        { id: 'self', name: 'Jamel', connected: true },
        { id: 'm1', name: 'Ali', connected: true },
        { id: 'm2', name: 'Bo', connected: true }
      ],
      agents: [],
      activePrompts: {}
    })
    render(
      createElement(TopBar)
    )

    setHeaderWidth(600)

    const faces = screen.getByRole('button', { name: "Who's here" })
    expect(faces.textContent).toBe('+2')
    expect(document.querySelector('.top-bar > .col-start-3 > span.w-px')).toBeNull()

    fireEvent.click(faces)
    expect(screen.getByText('Ali')).toBeTruthy()
    expect(screen.getByText('Bo')).toBeTruthy()
  })

})

describe('the way back to the side panel', () => {
  const minimized = () =>
    act(() => {
      useBrowser.getState().addTab()
      useBrowser.getState().closePanel()
    })

  it('stands at the end of the row, past your own face, and puts the panel back', () => {
    render(createElement(TopBar))
    minimized()

    const button = screen.getByRole('button', { name: 'Show panel' })
    expect(follows(screen.getByRole('button', { name: 'Settings' }), button)).toBe(true)

    fireEvent.click(button)

    expect(useBrowser.getState().open).toBe(true)
    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull()
  })

  it('stands only while the panel is away with something in it', () => {
    render(createElement(TopBar))
    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull()

    act(() => useBrowser.getState().addTab())
    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull()

    minimized()
    expect(screen.getByRole('button', { name: 'Show panel' })).toBeTruthy()

    act(() => useBrowser.getState().closeAll())
    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull()
  })
})
