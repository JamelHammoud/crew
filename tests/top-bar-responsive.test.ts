// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../src/renderer/src/components/TopBar'
import { useCrew } from '../src/renderer/src/state/store'

let notify: (() => void) | null = null

beforeEach(() => {
  notify = null
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notify = callback
      }
      observe() {}
      disconnect() {
        notify = null
      }
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  useCrew.setState({ members: [], agents: [], activePrompts: {} })
})

const follows = (first: Element, second: Element) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

const setHeaderWidth = (width: number) => {
  const header = document.querySelector('header')!
  Object.defineProperty(header, 'clientWidth', { value: width, configurable: true })
  act(() => notify?.())
}

const hover = (element: Element) => {
  fireEvent.mouseEnter(element.parentElement!)
  act(() => vi.advanceTimersByTime(400))
}

describe('responsive top bar', () => {
  it('keeps every tab icon available when labels collapse', () => {
    const onTab = vi.fn()
    render(
      createElement(TopBar, {
        tab: 'chat',
        onTab,
        tasksOpen: false,
        onToggleTasks: () => {}
      })
    )

    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
    const tabs = within(navigation).getAllByRole('button')

    expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual(['Chat', 'Crew', 'Docs', 'Design'])
    expect(navigation.querySelectorAll('.tab-icon')).toHaveLength(4)
    expect(navigation.querySelectorAll('.top-bar-tab-label')).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: 'Docs' }))
    expect(onTab).toHaveBeenCalledWith('docs')
  })

  it('only shows tab tooltips once the labels collapse', () => {
    vi.useFakeTimers()
    render(
      createElement(TopBar, {
        tab: 'chat',
        onTab: () => {},
        tasksOpen: false,
        onToggleTasks: () => {}
      })
    )

    setHeaderWidth(1200)
    hover(screen.getByRole('button', { name: 'Docs' }))
    expect(screen.queryByText('Docs', { selector: 'span.glass' })).toBeNull()

    setHeaderWidth(600)
    hover(screen.getByRole('button', { name: 'Docs' }))
    expect(screen.queryByText('Docs', { selector: 'span.glass' })).not.toBeNull()
  })
})
