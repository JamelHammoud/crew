// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/components/TopBar'
import { useBrowser } from '../src/renderer/src/state/browser'
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

const hover = (element: Element) => {
  fireEvent.mouseEnter(element.parentElement!)
  act(() => vi.advanceTimersByTime(400))
}

describe('responsive top bar', () => {
  it('shows the main navigation and keeps the controls at the end of the bar', () => {
    const onTab = vi.fn()
    render(
      createElement(TopBar, {
        tab: 'chat',
        onTab
      })
    )

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    const tabs = within(navigation).getAllByRole('button')

    expect(navigation.classList.contains('flex')).toBe(true)
    expect(document.querySelector('.top-bar > div')?.classList.contains('col-start-3')).toBe(true)
    expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual(['Chat', 'Docs', 'Design'])
    expect(navigation.querySelectorAll('.tab-icon')).toHaveLength(3)
    expect(navigation.querySelectorAll('.top-bar-tab-label')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Docs' }))
    expect(onTab).toHaveBeenCalledWith('docs')
  })

  it('keeps the faces together at the end of the bar, after the tasks button', () => {
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
      createElement(TopBar, {
        tab: 'chat',
        onTab: () => {}
      })
    )

    const tasks = screen.getByRole('button', { name: 'Tasks' })
    const faces = screen.getByRole('button', { name: "Who's here" })
    const you = screen.getByRole('button', { name: 'Settings' })

    expect(follows(tasks, faces)).toBe(true)
    expect(follows(faces, you)).toBe(true)
  })

  it('collapses the presence faces into a count with the tab labels', () => {
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
      createElement(TopBar, {
        tab: 'chat',
        onTab: () => {}
      })
    )

    setHeaderWidth(600)

    const faces = screen.getByRole('button', { name: "Who's here" })
    expect(faces.textContent).toBe('+2')
    expect(document.querySelector('.top-bar > div > span.w-px')).toBeNull()

    fireEvent.click(faces)
    expect(screen.getByText('Ali')).toBeTruthy()
    expect(screen.getByText('Bo')).toBeTruthy()
  })

  it('only shows tab tooltips once the labels collapse', () => {
    vi.useFakeTimers()
    render(
      createElement(TopBar, {
        tab: 'chat',
        onTab: () => {}
      })
    )

    setHeaderWidth(1200)
    hover(screen.getByRole('button', { name: 'Docs' }))
    expect(screen.queryByText('Docs', { selector: 'span.glass' })).toBeNull()

    setHeaderWidth(600)
    hover(screen.getByRole('button', { name: 'Docs' }))
    expect(screen.queryByText('Docs', { selector: 'span.glass' })).not.toBeNull()
  })

  it('keeps the current tab visible and moves the other tabs into More when space runs out', () => {
    const onTab = vi.fn()
    render(
      createElement(TopBar, {
        tab: 'docs',
        onTab
      })
    )

    setHeaderWidth(540)

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(
      within(navigation)
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label'))
    ).toEqual(['Docs', 'More'])

    fireEvent.click(within(navigation).getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: 'Chat' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Design' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Design' }))
    expect(onTab).toHaveBeenCalledWith('design')
    expect(screen.queryByRole('button', { name: 'Chat' })).toBeNull()
  })

  it('restores every tab when the bar has room again', () => {
    render(
      createElement(TopBar, {
        tab: 'chat',
        onTab: () => {}
      })
    )

    setHeaderWidth(540)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    setHeaderWidth(900)

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(
      within(navigation)
        .getAllByRole('button')
        .map(button => button.getAttribute('aria-label'))
    ).toEqual(['Chat', 'Docs', 'Design'])
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  })
})

describe('the way back to the side panel', () => {
  const withTab = () => act(() => useBrowser.getState().addTab())

  it('stands at the end of the row, past your own face, and puts the panel away and back', () => {
    render(createElement(TopBar, { tab: 'chat', onTab: () => {} }))
    withTab()

    const button = screen.getByRole('button', { name: 'Hide panel' })
    expect(follows(screen.getByRole('button', { name: 'Settings' }), button)).toBe(true)

    fireEvent.click(button)
    expect(useBrowser.getState().open).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Show panel' }))
    expect(useBrowser.getState().open).toBe(true)
  })

  it('stands only while there is a tab to come back to', () => {
    render(createElement(TopBar, { tab: 'chat', onTab: () => {} }))
    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull()

    withTab()
    expect(screen.getByRole('button', { name: 'Hide panel' })).toBeTruthy()

    act(() => useBrowser.getState().closeAll())
    expect(screen.queryByRole('button', { name: 'Show panel' })).toBeNull()
  })

  it('stands down where the panel cannot', () => {
    render(createElement(TopBar, { tab: 'docs', onTab: () => {} }))
    withTab()
    expect(screen.queryByRole('button', { name: 'Hide panel' })).toBeNull()

    cleanup()
    render(createElement(TopBar, { tab: 'design', onTab: () => {} }))
    expect(screen.queryByRole('button', { name: 'Hide panel' })).toBeNull()
  })
})
