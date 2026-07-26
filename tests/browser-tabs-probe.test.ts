// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
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
  useBrowser.setState({ tabs: [], activeTabId: null })
})

const pillFor = (root: HTMLElement, id: string) => root.querySelector(`[data-tab="${id}"]`)

describe('the tab strip', () => {
  it('brings a newly opened tab into view', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    const { container } = render(createElement(BrowserPanel))

    useBrowser.getState().openFile('/repo/src/deep/file.ts')
    const opened = useBrowser.getState().tabs[1]!

    expect(scrolled).toContain(pillFor(container, opened.id))
  })

  it('brings a tab that was picked from somewhere else into view', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().openUrl('https://example.com/two')
    const { container } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!
    scrolled.length = 0

    useBrowser.getState().selectTab(first.id)

    expect(scrolled).toContain(pillFor(container, first.id))
  })

  it('leaves a tab that is not the active one alone', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().openUrl('https://example.com/two')
    const { container } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!

    expect(scrolled).not.toContain(pillFor(container, first.id))
  })

  it('closes one tab from its own menu', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().openUrl('https://example.com/two')
    const { container, getByText } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!

    fireEvent.contextMenu(pillFor(container, first.id)!)
    fireEvent.click(getByText('Close tab'))

    expect(useBrowser.getState().tabs.map(t => t.id)).toEqual([useBrowser.getState().tabs[0]!.id])
    expect(useBrowser.getState().tabs.some(t => t.id === first.id)).toBe(false)
  })

  it('closes every tab from the same menu', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().openUrl('https://example.com/two')
    const { container, getByText } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!

    fireEvent.contextMenu(pillFor(container, first.id)!)
    fireEvent.click(getByText('Close all tabs'))

    expect(useBrowser.getState().tabs).toEqual([])
    expect(useBrowser.getState().activeTabId).toBeNull()
  })
})
