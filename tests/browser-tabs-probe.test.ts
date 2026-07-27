// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useBrowser } = await import('../src/renderer/src/state/browser')
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default

const scrolled: Element[] = []

beforeEach(() => {
  scrolled.length = 0
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this)
  })
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null })
})

const pillFor = (root: HTMLElement, id: string) => root.querySelector(`[data-tab="${id}"]`)

const openTwo = () => {
  useBrowser.getState().openUrl('https://example.com/one')
  useBrowser.getState().openUrl('https://example.com/two')
}

describe('the tab strip', () => {
  it('brings a newly opened tab into view', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    const { container } = render(createElement(BrowserPanel))
    scrolled.length = 0

    act(() => useBrowser.getState().openUrl('https://example.com/two'))
    const opened = useBrowser.getState().tabs[1]!

    expect(scrolled).toContain(pillFor(container, opened.id))
  })

  it('brings a tab that was picked from somewhere else into view', () => {
    openTwo()
    const { container } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!
    scrolled.length = 0

    act(() => useBrowser.getState().selectTab(first.id))

    expect(scrolled).toContain(pillFor(container, first.id))
  })

  it('leaves a tab that is not the active one alone', () => {
    openTwo()
    const { container } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!

    expect(scrolled).not.toContain(pillFor(container, first.id))
  })

  it('closes one tab from its own menu', () => {
    openTwo()
    const { container, getByText } = render(createElement(BrowserPanel))
    const [first, second] = useBrowser.getState().tabs

    fireEvent.contextMenu(pillFor(container, first!.id)!)
    fireEvent.click(getByText('Close tab'))

    expect(useBrowser.getState().tabs.map(t => t.id)).toEqual([second!.id])
  })

  it('closes every tab from the same menu', () => {
    openTwo()
    const { container, getByText } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!

    fireEvent.contextMenu(pillFor(container, first.id)!)
    fireEvent.click(getByText('Close all tabs'))

    expect(useBrowser.getState().tabs).toEqual([])
    expect(useBrowser.getState().activeTabId).toBeNull()
  })

  // A games tab is named after the game it is standing in, and wears the same
  // mark whichever one that is.
  it('names a games tab after the game it is standing in', () => {
    useBrowser.getState().openGame()
    const games = useBrowser.getState().tabs[0]!
    useBrowser.getState().openUrl('https://example.com/one')
    const { container } = render(createElement(BrowserPanel))

    expect(pillFor(container, games.id)?.textContent).toContain('Games')

    act(() => useBrowser.getState().updateTab(games.id, { game: 'flappy' }))
    expect(pillFor(container, games.id)?.textContent).toContain('Flappy Bird')
  })

  it('leaves the tab menu closed until a right click asks for it', () => {
    openTwo()
    const { queryByText } = render(createElement(BrowserPanel))

    expect(queryByText('Close all tabs')).toBeNull()
  })
})
