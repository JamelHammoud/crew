// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

const { useBrowser } = await import('../src/renderer/src/state/browser')
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default

let openFind: (() => void) | null = null
let request = 0
const findInPage = vi.fn(() => ++request)
const stopFindInPage = vi.fn()

beforeEach(() => {
  request = 0
  findInPage.mockClear()
  stopFindInPage.mockClear()
  openFind = null
  window.crew = {
    warmTerminal: () => undefined,
    openExternal: async () => true,
    onFindInPage: listener => {
      openFind = listener
      return () => {
        openFind = null
      }
    }
  } as unknown as CrewBridge
  Object.defineProperties(HTMLElement.prototype, {
    getURL: { configurable: true, value: function (this: HTMLElement) { return this.getAttribute('src') ?? '' } },
    loadURL: { configurable: true, value: vi.fn(async () => undefined) },
    canGoBack: { configurable: true, value: () => false },
    canGoForward: { configurable: true, value: () => false },
    findInPage: { configurable: true, value: findInPage },
    stopFindInPage: { configurable: true, value: stopFindInPage }
  })
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
})

afterEach(() => {
  cleanup()
  for (const name of ['getURL', 'loadURL', 'canGoBack', 'canGoForward', 'findInPage', 'stopFindInPage']) {
    Reflect.deleteProperty(HTMLElement.prototype, name)
  }
})

const openPage = () => useBrowser.getState().openUrl('https://example.com/guide')

const result = (view: Element, requestId: number, activeMatchOrdinal: number, matches: number) => {
  const event = Object.assign(new Event('found-in-page'), {
    result: { requestId, activeMatchOrdinal, matches }
  })
  act(() => view.dispatchEvent(event))
}

describe('find in an open webpage', () => {
  it('searches the guest page and reports its active match', () => {
    openPage()
    const screen = render(createElement(BrowserPanel))
    const view = screen.container.querySelector('webview')!

    fireEvent.click(screen.getByRole('button', { name: 'Find in page' }))
    const input = screen.getByRole('textbox', { name: 'Find in page' })
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: 'crew' } })
    expect(findInPage).toHaveBeenLastCalledWith('crew', { forward: true, findNext: false })

    result(view, 1, 2, 5)
    expect(screen.getByText('2/5')).toBeTruthy()
  })

  it('steps forward and backward through native results', () => {
    openPage()
    const screen = render(createElement(BrowserPanel))
    const view = screen.container.querySelector('webview')!
    fireEvent.click(screen.getByRole('button', { name: 'Find in page' }))
    const input = screen.getByRole('textbox', { name: 'Find in page' })
    fireEvent.change(input, { target: { value: 'crew' } })
    result(view, 1, 1, 3)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(findInPage).toHaveBeenLastCalledWith('crew', { forward: true, findNext: true })
    result(view, 2, 2, 3)

    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }))
    expect(findInPage).toHaveBeenLastCalledWith('crew', { forward: false, findNext: true })

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(findInPage).toHaveBeenLastCalledWith('crew', { forward: false, findNext: true })
  })

  it('ignores results left over from an earlier query', () => {
    openPage()
    const screen = render(createElement(BrowserPanel))
    const view = screen.container.querySelector('webview')!
    fireEvent.click(screen.getByRole('button', { name: 'Find in page' }))
    const input = screen.getByRole('textbox', { name: 'Find in page' })

    fireEvent.change(input, { target: { value: 'first' } })
    fireEvent.change(input, { target: { value: 'second' } })
    result(view, 1, 7, 9)
    expect(screen.queryByText('7/9')).toBeNull()
    result(view, 2, 1, 2)
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('clears the highlight when closed or moved to another tab', () => {
    openPage()
    const screen = render(createElement(BrowserPanel))
    fireEvent.click(screen.getByRole('button', { name: 'Find in page' }))
    const input = screen.getByRole('textbox', { name: 'Find in page' })
    fireEvent.change(input, { target: { value: 'crew' } })

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(stopFindInPage).toHaveBeenLastCalledWith('clearSelection')
    expect(screen.queryByRole('textbox', { name: 'Find in page' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Find in page' }))
    act(() => useBrowser.getState().openUrl('https://example.com/other'))
    expect(stopFindInPage).toHaveBeenLastCalledWith('clearSelection')
    expect(screen.queryByRole('textbox', { name: 'Find in page' })).toBeNull()
  })

  it('opens from the webpage shortcut bridge and stays unavailable without a page', () => {
    openPage()
    const screen = render(createElement(BrowserPanel))

    act(() => openFind?.())
    expect(screen.getByRole('textbox', { name: 'Find in page' })).toBeTruthy()

    cleanup()
    useBrowser.setState({ tabs: [], activeTabId: null, open: false })
    useBrowser.getState().addTab()
    const empty = render(createElement(BrowserPanel))
    expect(empty.getByRole('button', { name: 'Find in page' })).toBeDisabled()
  })
})
