// @vitest-environment jsdom
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

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

const { boardOnScreen, DEFAULT_WIDTH, useBrowser } = await import('../src/renderer/src/state/browser')
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default
const { browserTabCard } = await import('../src/renderer/src/components/BrowserTabMark')

const scrolled: { el: Element; left: number; top: number }[] = []
const askedIntoView: Element[] = []
const popOutBrowserTab = vi.fn().mockResolvedValue(true)
const beginBrowserTabDrag = vi.fn(() => true)
const dropBrowserTab = vi.fn().mockResolvedValue(true)

const VIEW = 300
const TALL = 36

beforeEach(() => {
  scrolled.length = 0
  askedIntoView.length = 0
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    askedIntoView.push(this)
  })
  Element.prototype.scrollTo = vi.fn(function (this: Element, to: ScrollToOptions) {
    scrolled.push({ el: this, left: to.left ?? 0, top: to.top ?? 0 })
    Object.defineProperty(this, 'scrollLeft', { value: to.left ?? 0, configurable: true })
    Object.defineProperty(this, 'scrollTop', { value: to.top ?? 0, configurable: true })
  }) as unknown as Element['scrollTo']
  popOutBrowserTab.mockClear()
  beginBrowserTabDrag.mockClear()
  dropBrowserTab.mockClear()
  window.crew = {
    warmTerminal: () => undefined,
    openTerminal: () => undefined,
    writeTerminal: () => undefined,
    resizeTerminal: () => undefined,
    closeTerminal: () => undefined,
    onTerminalData: () => () => undefined,
    onTerminalRunning: () => () => undefined,
    onTerminalExit: () => () => undefined,
    popOutBrowserTab,
    beginBrowserTabDrag,
    dropBrowserTab
  } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null, open: false, fullScreen: false })
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
  Reflect.deleteProperty(HTMLElement.prototype, 'getURL')
  Reflect.deleteProperty(HTMLElement.prototype, 'loadURL')
})

const pillFor = (root: HTMLElement, id: string) => root.querySelector(`[data-tab="${id}"]`)

const openTwo = () => {
  useBrowser.getState().openUrl('https://example.com/one')
  useBrowser.getState().openUrl('https://example.com/two')
}

const openThree = () => {
  openTwo()
  useBrowser.getState().openUrl('https://example.com/three')
}

const openFour = () => {
  openThree()
  useBrowser.getState().openUrl('https://example.com/four')
}

const rowOf = (root: HTMLElement) => root.querySelector('.overflow-x-auto')

const order = () => useBrowser.getState().tabs.map(t => t.id)

// jsdom lays nothing out, so the row is given one: pills 90 wide with a gap of
// 10, in a strip that shows all of them.
const box = (left: number, width: number) =>
  ({ left, width, right: left + width, top: 0, height: TALL, bottom: TALL }) as DOMRect

// The same row, laid out for whatever pills exist at the time rather than the
// ones that happened to be there when it was called, so a tab opened later has
// a box of its own to be brought into view by.
const strip = (el: HTMLElement): boolean => el.classList.contains('overflow-x-auto')

const laidOutRow = () => {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.dataset.reorder !== undefined) {
      const pills = Array.from(this.parentElement?.querySelectorAll('[data-reorder]') ?? [])
      return box(pills.indexOf(this) * 100 - (this.parentElement?.scrollLeft ?? 0), 90)
    }
    return strip(this) ? box(0, VIEW) : box(0, 0)
  }
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return strip(this) ? VIEW : 0
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return strip(this) ? TALL : 0
    }
  })
}

const laidOut = (root: HTMLElement) => {
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-reorder]'))
  const strip = items[0]!.parentElement!
  strip.getBoundingClientRect = () => box(0, 1000)
  items.forEach((item, index) => {
    item.getBoundingClientRect = () => box(index * 100, 90)
  })
  return items
}

// A drag is a press, a run of moves and letting go, and where it lands is read
// off the row's own boxes rather than off anything the pointer says it is over.
const drag = (item: HTMLElement, from: number, by: number) => {
  fireEvent.pointerDown(item, { button: 0, clientX: from })
  fireEvent.pointerMove(window, { clientX: from + by })
}

describe('the tab strip', () => {
  it('puts its resting inset inside the scroller so tabs can reach the Browser edge', () => {
    openTwo()
    const { container } = render(createElement(BrowserPanel))
    const row = rowOf(container) as HTMLElement

    expect(row.className).toContain('-ml-4')
    expect(row.className).toContain('pl-4')
  })

  it('moves the window from the gaps without taking pointer input from a tab', () => {
    openTwo()
    const { container } = render(createElement(BrowserPanel))
    const row = rowOf(container) as HTMLElement
    const tabs = Array.from(container.querySelectorAll<HTMLElement>('[data-tab]'))

    expect(row.className).toContain('app-drag')
    expect(row.className).not.toContain('app-no-drag')
    expect(tabs).toHaveLength(2)
    expect(tabs.every(tab => tab.classList.contains('app-no-drag'))).toBe(true)
  })

  it('brings a newly opened tab into view', () => {
    laidOutRow()
    openFour()
    const { container } = render(createElement(BrowserPanel))
    scrolled.length = 0

    act(() => useBrowser.getState().openUrl('https://example.com/five'))

    expect(scrolled).toHaveLength(1)
    expect(scrolled[0]!.el).toBe(rowOf(container))
    expect(scrolled[0]!.left).toBe(190)
  })

  it('brings a tab that was picked from somewhere else into view', () => {
    laidOutRow()
    openFour()
    const { container } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!
    scrolled.length = 0

    act(() => useBrowser.getState().selectTab(first.id))

    expect(scrolled).toHaveLength(1)
    expect(scrolled[0]!.el).toBe(rowOf(container))
    expect(scrolled[0]!.left).toBe(0)
  })

  it('leaves a tab that is already standing in the row where it is', () => {
    laidOutRow()
    openTwo()
    render(createElement(BrowserPanel))
    scrolled.length = 0

    act(() => useBrowser.getState().selectTab(useBrowser.getState().tabs[0]!.id))

    expect(scrolled).toEqual([])
  })

  // The row is the only box a tab may move. scrollIntoView moves every scroller
  // between the pill and the document, and the panel stands in two that show no
  // scrollbar, so anything it shifts can never be put back by hand.
  it('never asks the page to bring a tab into view', () => {
    laidOutRow()
    openFour()
    render(createElement(BrowserPanel))

    act(() => useBrowser.getState().openUrl('https://example.com/five'))

    expect(askedIntoView).toEqual([])
    expect(scrolled.every(one => strip(one.el as HTMLElement))).toBe(true)
  })

  it('never scrolls the row the way it does not go', () => {
    laidOutRow()
    openFour()
    render(createElement(BrowserPanel))
    scrolled.length = 0

    act(() => useBrowser.getState().openUrl('https://example.com/five'))

    expect(scrolled.map(one => one.top)).toEqual([0])
  })

  it('fades only the end that has more tabs past it', async () => {
    openFour()
    const { container } = render(createElement(BrowserPanel))
    const row = rowOf(container) as HTMLElement
    Object.defineProperty(row, 'clientWidth', { value: VIEW, configurable: true })
    Object.defineProperty(row, 'scrollWidth', { value: 490, configurable: true })

    fireEvent.scroll(row)
    await waitFor(() => expect(row.hasAttribute('data-fade-right')).toBe(true))
    expect(row.className).toContain('scroll-fade-x')
    expect(row.hasAttribute('data-fade-left')).toBe(false)

    row.scrollLeft = 190
    fireEvent.scroll(row)
    await waitFor(() => expect(row.hasAttribute('data-fade-left')).toBe(true))
    expect(row.hasAttribute('data-fade-right')).toBe(false)
  })

  it('keeps every open tab in a searchable switcher', () => {
    openThree()
    const [first, second] = useBrowser.getState().tabs
    act(() => {
      useBrowser.getState().updateTab(first!.id, { title: 'First page' })
      useBrowser.getState().updateTab(second!.id, { title: 'Second page' })
    })
    const { getByRole, queryByText } = render(createElement(BrowserPanel))

    fireEvent.click(getByRole('button', { name: 'Search tabs' }))
    fireEvent.change(getByRole('textbox', { name: 'Search tabs' }), { target: { value: 'second' } })

    const results = Array.from(document.querySelectorAll('[data-tab-result]'))
    expect(results).toHaveLength(1)
    expect(results[0]!.textContent).toContain('Second page')
    expect(queryByText('First page')).toBeTruthy()
  })

  it('scrolls the tab results without carrying the search field', () => {
    openThree()
    const { getByRole } = render(createElement(BrowserPanel))

    fireEvent.click(getByRole('button', { name: 'Search tabs' }))

    const field = getByRole('textbox', { name: 'Search tabs' })
    const results = document.querySelector('[data-tab-results]') as HTMLElement
    const popover = results.parentElement?.parentElement as HTMLElement
    expect(results.className).toContain('overflow-y-auto')
    expect(results.contains(field)).toBe(false)
    expect(popover.style.overflowY).toBe('hidden')
  })

  it('overlays the hidden close action on the active mark', () => {
    openTwo()
    const active = useBrowser.getState().activeTabId
    const { getByRole } = render(createElement(BrowserPanel))

    fireEvent.click(getByRole('button', { name: 'Search tabs' }))

    const row = document.querySelector(`[data-tab-result="${active}"]`) as HTMLElement
    const close = row.querySelector('[aria-label^="Close "]') as HTMLElement
    const check = row.querySelector('[data-active-tab-mark]') as HTMLElement
    expect(close.className).toContain('absolute')
    expect(close.className).toContain('right-1.5')
    expect(check.classList.contains('group-hover:opacity-0')).toBe(true)
  })

  it('closes tab search when its button is pressed again', () => {
    openTwo()
    const { getByRole, queryByRole } = render(createElement(BrowserPanel))
    const button = getByRole('button', { name: 'Search tabs' })

    fireEvent.click(button)
    expect(getByRole('textbox', { name: 'Search tabs' })).toBeTruthy()

    fireEvent.click(button)

    expect(queryByRole('textbox', { name: 'Search tabs' })).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens a tab from the switcher and brings its pill into view', () => {
    laidOutRow()
    openFour()
    const first = useBrowser.getState().tabs[0]!
    act(() => useBrowser.getState().updateTab(first.id, { title: 'First page' }))
    const { getByRole } = render(createElement(BrowserPanel))
    scrolled.length = 0

    fireEvent.click(getByRole('button', { name: 'Search tabs' }))
    fireEvent.click(document.querySelector(`[data-tab-result="${first.id}"]`)!)

    expect(useBrowser.getState().activeTabId).toBe(first.id)
    expect(scrolled.at(-1)?.left).toBe(0)
  })

  it('closes a tab from the switcher without opening it', () => {
    openThree()
    const [first, second, third] = useBrowser.getState().tabs
    act(() => useBrowser.getState().updateTab(second!.id, { title: 'Middle page' }))
    const { getByRole } = render(createElement(BrowserPanel))

    fireEvent.click(getByRole('button', { name: 'Search tabs' }))
    fireEvent.click(getByRole('button', { name: 'Close Middle page' }))

    expect(order()).toEqual([first!.id, third!.id])
    expect(useBrowser.getState().activeTabId).toBe(third!.id)
  })

  it('opens tab search from the browser shortcut', () => {
    openTwo()
    const { getByRole } = render(createElement(BrowserPanel))

    fireEvent.keyDown(window, { key: 'a', metaKey: true, shiftKey: true })

    expect(getByRole('textbox', { name: 'Search tabs' })).toBeTruthy()
  })

  it('cycles through tabs in both directions', () => {
    openThree()
    const [first, , third] = useBrowser.getState().tabs
    render(createElement(BrowserPanel))

    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true })
    expect(useBrowser.getState().activeTabId).toBe(first!.id)

    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true, shiftKey: true })
    expect(useBrowser.getState().activeTabId).toBe(third!.id)
  })

  it('closes one tab from its own menu', () => {
    openTwo()
    const { container, getByText } = render(createElement(BrowserPanel))
    const [first, second] = useBrowser.getState().tabs

    fireEvent.contextMenu(pillFor(container, first!.id)!)
    fireEvent.click(getByText('Close tab'))

    expect(useBrowser.getState().tabs.map(t => t.id)).toEqual([second!.id])
  })

  it('pins and unpins a tab from its own menu', () => {
    openTwo()
    const { container, getByText } = render(createElement(BrowserPanel))
    const first = useBrowser.getState().tabs[0]!

    fireEvent.contextMenu(pillFor(container, first.id)!)
    fireEvent.click(getByText('Pin tab'))

    expect(useBrowser.getState().tabs[0]).toMatchObject({ id: first.id, pinned: true })
    expect(pillFor(container, first.id)?.hasAttribute('data-pinned')).toBe(true)

    fireEvent.contextMenu(pillFor(container, first.id)!)
    fireEvent.click(getByText('Unpin tab'))

    expect(useBrowser.getState().tabs[0]).toMatchObject({ id: first.id, pinned: false })
    expect(pillFor(container, first.id)?.hasAttribute('data-pinned')).toBe(false)
  })

  it('opens a copy of a tab in a new Crew window from its menu', () => {
    openTwo()
    const { container, getByText } = render(createElement(BrowserPanel))
    const [first, second] = useBrowser.getState().tabs
    act(() => useBrowser.getState().updateTab(first!.id, { url: 'https://example.com/one/current', title: 'Current' }))

    fireEvent.contextMenu(pillFor(container, first!.id)!)
    fireEvent.click(getByText('Open in new window'))

    expect(popOutBrowserTab).toHaveBeenCalledOnce()
    expect(popOutBrowserTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: first!.id, url: 'https://example.com/one/current', title: 'Current' })
    )
    expect(order()).toEqual([first!.id, second!.id])
  })

  it('closes tabs to the right from its own menu', () => {
    openFour()
    const [first, second] = useBrowser.getState().tabs
    const { container, getByText } = render(createElement(BrowserPanel))

    fireEvent.contextMenu(pillFor(container, second!.id)!)
    fireEvent.click(getByText('Close tabs to the right'))

    expect(order()).toEqual([first!.id, second!.id])
    expect(useBrowser.getState().activeTabId).toBe(second!.id)
  })

  it('leaves pinned tabs to the right standing', () => {
    openFour()
    const [first, , third] = useBrowser.getState().tabs
    act(() => useBrowser.getState().togglePinned(third!.id))
    const { container, getByText } = render(createElement(BrowserPanel))

    fireEvent.contextMenu(pillFor(container, first!.id)!)
    fireEvent.click(getByText('Close tabs to the right'))

    expect(order()).toEqual([first!.id, third!.id])
    expect(useBrowser.getState().activeTabId).toBe(first!.id)
  })

  it('keeps the tab the menu was opened on and closes the rest', () => {
    openThree()
    const { container, getByText } = render(createElement(BrowserPanel))
    const kept = useBrowser.getState().tabs[1]!

    fireEvent.contextMenu(pillFor(container, kept.id)!)
    fireEvent.click(getByText('Close other tabs'))

    expect(order()).toEqual([kept.id])
    expect(useBrowser.getState().activeTabId).toBe(kept.id)
  })

  it('keeps pinned tabs when closing the others', () => {
    openFour()
    const [first, second, , fourth] = useBrowser.getState().tabs
    act(() => {
      useBrowser.getState().togglePinned(first!.id)
      useBrowser.getState().togglePinned(fourth!.id)
    })
    const { container, getByText } = render(createElement(BrowserPanel))

    fireEvent.contextMenu(pillFor(container, second!.id)!)
    fireEvent.click(getByText('Close other tabs'))

    expect(order()).toEqual([first!.id, second!.id, fourth!.id])
    expect(useBrowser.getState().activeTabId).toBe(second!.id)
  })

  // An action a tab cannot do is left out rather than greyed, and one tab on its
  // own has no others to close.
  it('offers no others to close on the only tab there is', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    const { container, queryByText } = render(createElement(BrowserPanel))
    const only = useBrowser.getState().tabs[0]!

    fireEvent.contextMenu(pillFor(container, only.id)!)

    expect(queryByText('Close other tabs')).toBeNull()
    expect(queryByText('Close all tabs')).not.toBeNull()
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

  it('leaves pinned tabs standing when all tabs are closed', () => {
    openThree()
    const [first, second] = useBrowser.getState().tabs
    act(() => useBrowser.getState().togglePinned(second!.id))
    const { container, getByText } = render(createElement(BrowserPanel))

    fireEvent.contextMenu(pillFor(container, first!.id)!)
    fireEvent.click(getByText('Close all tabs'))

    expect(order()).toEqual([second!.id])
    expect(useBrowser.getState().activeTabId).toBe(second!.id)
    expect(useBrowser.getState().open).toBe(true)
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
    expect(pillFor(container, games.id)?.textContent).toContain('Birdie')
  })

  // The row is the order somebody put it in. A tab is dragged into another place
  // in it by taking hold of the pill anywhere on it.
  it('takes a tab into the place it was dragged to', () => {
    openThree()
    const [first, second, third] = order()
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)

    act(() => {
      drag(items[0]!, 45, 200)
      fireEvent.pointerUp(window)
    })

    expect(order()).toEqual([second, third, first])
  })

  it('takes one back the way it came', () => {
    openThree()
    const [first, second, third] = order()
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)

    act(() => {
      drag(items[2]!, 245, -200)
      fireEvent.pointerUp(window)
    })

    expect(order()).toEqual([third, first, second])
  })

  it('commits a native tab drop at the aimed place before the transfer returns', () => {
    openTwo()
    const [first, second] = order()
    const sourceTab = useBrowser.getState().tabs[0]
    dropBrowserTab.mockReturnValueOnce(new Promise(() => undefined))
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)
    const values = new Map<string, string>()
    const dataTransfer = {
      types: ['application/x-crew-browser-tab'],
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? ''
    }

    fireEvent.dragStart(items[0]!, { dataTransfer })
    fireEvent.dragOver(rowOf(container)!, { clientX: 150, dataTransfer })

    expect(container.querySelector('[data-browser-tab-drop]')).toBeTruthy()

    fireEvent.drop(rowOf(container)!, { clientX: 150, dataTransfer })

    const token = values.get('application/x-crew-browser-tab')
    expect(token).toBeTruthy()
    expect(beginBrowserTabDrag).toHaveBeenCalledWith(token, sourceTab)
    expect(dropBrowserTab).toHaveBeenCalledWith(token, 2)
    expect(order()).toEqual([second, first])
    expect(container.querySelector('[data-browser-tab-drop]')).toBeNull()
  })

  it('scrolls the tab list while a native tab drag is held at its edge', () => {
    laidOutRow()
    openFour()
    const { container } = render(createElement(BrowserPanel))
    const row = rowOf(container) as HTMLElement
    row.getBoundingClientRect = () => box(0, VIEW)
    Object.defineProperty(row, 'scrollWidth', { value: 490, configurable: true })
    Object.defineProperty(row, 'scrollLeft', { value: 50, writable: true, configurable: true })
    const values = new Map<string, string>()
    const dataTransfer = {
      types: ['application/x-crew-browser-tab'],
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? ''
    }
    const dragOver = (x: number) => {
      const event = new Event('dragover', { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        clientX: { value: x },
        dataTransfer: { value: dataTransfer }
      })
      fireEvent(row, event)
    }

    fireEvent.dragStart(container.querySelector('[data-tab]')!, { dataTransfer })
    dragOver(VIEW - 1)
    expect(container.querySelector('[data-browser-tab-drop]')).toBeTruthy()
    expect(row.scrollLeft).toBe(62)

    dragOver(1)
    expect(row.scrollLeft).toBe(50)
  })

  it('leaves the row alone and picks the tab up when the pointer barely moved', () => {
    openTwo()
    const [first, second] = order()
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)

    act(() => {
      drag(items[0]!, 45, 2)
      fireEvent.pointerUp(window)
      fireEvent.click(items[0]!)
    })

    expect(order()).toEqual([first, second])
    expect(useBrowser.getState().activeTabId).toBe(first)
  })

  it('does not carry the strip while a tab near its edge is being clicked', () => {
    openFour()
    const [, second] = order()
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)
    const row = rowOf(container) as HTMLElement
    Object.defineProperty(row, 'clientWidth', { value: 1000, configurable: true })
    row.scrollLeft = 90
    let next: FrameRequestCallback | null = null
    const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      next = callback
      return 1
    })
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    act(() => {
      fireEvent.pointerDown(items[1]!, { button: 0, clientX: 10 })
      const frame = next as FrameRequestCallback | null
      frame?.(0)
      fireEvent.pointerUp(window)
      fireEvent.click(items[1]!)
    })

    expect(row.scrollLeft).toBe(90)
    expect(useBrowser.getState().activeTabId).toBe(second)
    request.mockRestore()
    cancel.mockRestore()
  })

  // A drag is arranging the row rather than going anywhere, so the tab that is up
  // stays up and the click the drag ends on is not a click on a tab.
  it('does not open the tab it was handed after a drag', () => {
    openThree()
    const [first, , third] = order()
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)

    act(() => {
      drag(items[0]!, 45, 200)
      fireEvent.pointerUp(window)
      fireEvent.click(items[0]!)
    })

    expect(useBrowser.getState().activeTabId).toBe(third)
    expect(order()[2]).toBe(first)
  })

  it('puts a tab back where it was on Escape', () => {
    openThree()
    const was = order()
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)

    act(() => {
      drag(items[0]!, 45, 200)
      fireEvent.keyDown(window, { key: 'Escape' })
      fireEvent.pointerUp(window)
    })

    expect(order()).toEqual(was)
  })

  it('leaves a right click to the menu rather than taking hold of the tab', () => {
    openTwo()
    const was = order()
    const { container } = render(createElement(BrowserPanel))
    const items = laidOut(container)

    act(() => {
      fireEvent.pointerDown(items[0]!, { button: 2, clientX: 45 })
      fireEvent.pointerMove(window, { clientX: 245 })
      fireEvent.pointerUp(window)
    })

    expect(order()).toEqual(was)
  })

  // Closing is one thing and arranging is another, so the press that closes a tab
  // never takes hold of it.
  it('closes a tab pressed on its own close', () => {
    openTwo()
    const [, second] = order()
    const { container, getAllByLabelText } = render(createElement(BrowserPanel))
    laidOut(container)
    const close = getAllByLabelText('Close tab')[0]!

    act(() => {
      fireEvent.pointerDown(close, { button: 0, clientX: 80 })
      fireEvent.pointerMove(window, { clientX: 280 })
      fireEvent.pointerUp(window)
      fireEvent.click(close)
    })

    expect(order()).toEqual([second])
  })

  it('closes a tab with a middle click', () => {
    openTwo()
    const [, second] = order()
    const { container } = render(createElement(BrowserPanel))

    pillFor(container, order()[0]!)!.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }))

    expect(order()).toEqual([second])
  })

  it('floats the close control over the tab and fades the label beneath it', () => {
    openTwo()
    const { getAllByLabelText } = render(createElement(BrowserPanel))
    const close = getAllByLabelText('Close tab')[0] as HTMLElement
    const fade = close.parentElement as HTMLElement

    expect(fade.className).toContain('absolute')
    expect(fade.className).toContain('browser-tab-close')
    expect(fade.className).toContain('opacity-0')
    expect(fade.className).toContain('group-hover:opacity-100')
    expect(close.parentElement?.parentElement?.className).toContain('px-3')
  })

  it('leaves the tab menu closed until a right click asks for it', () => {
    openTwo()
    const { queryByText } = render(createElement(BrowserPanel))

    expect(queryByText('Close all tabs')).toBeNull()
  })
})

describe('a tab opened by another Crew window', () => {
  it('is the only Browser tab and loads a web tab at its current address', () => {
    openTwo()
    const source = {
      ...useBrowser.getState().tabs[0]!,
      initialUrl: 'https://example.com/start',
      url: 'https://example.com/current',
      loading: true,
      error: 'old error',
      canGoBack: true,
      canGoForward: true
    }

    useBrowser.getState().openWindowTab(source)

    const state = useBrowser.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0]).toMatchObject({
      initialUrl: 'https://example.com/current',
      url: 'https://example.com/current',
      loading: false,
      error: '',
      canGoBack: false,
      canGoForward: false
    })
    expect(state.tabs[0]!.id).not.toBe(source.id)
    expect(state.activeTabId).toBe(state.tabs[0]!.id)
    expect(state.open).toBe(true)
    expect(state.fullScreen).toBe(true)
  })

  it('gives later tabs a different id', () => {
    useBrowser.getState().openUrl('https://example.com/source')
    useBrowser.getState().openWindowTab(useBrowser.getState().tabs[0]!)
    const opened = useBrowser.getState().tabs[0]!

    useBrowser.getState().addTab()

    expect(useBrowser.getState().tabs.map(one => one.id)).toEqual([
      opened.id,
      expect.not.stringMatching(`^${opened.id}$`)
    ])
  })

  it('inserts a moved tab at the drop point without replacing the tabs already there', () => {
    openTwo()
    const [first, second] = useBrowser.getState().tabs
    const source = { ...first!, id: 'other-window-tab', url: 'https://example.com/moved' }

    useBrowser.getState().insertWindowTab(source, 1)

    const state = useBrowser.getState()
    expect(state.tabs.map(one => one.url)).toEqual([first!.url, 'https://example.com/moved', second!.url])
    expect(state.tabs[1]!.id).not.toBe(source.id)
    expect(state.activeTabId).toBe(state.tabs[1]!.id)
  })

  it('turns a drop gap into the right same-window order', () => {
    openThree()
    const [first, second, third] = useBrowser.getState().tabs

    useBrowser.getState().dropTab(first!.id, 3)

    expect(useBrowser.getState().tabs.map(one => one.id)).toEqual([second!.id, third!.id, first!.id])
  })

  it('does not show panel controls in a standalone Browser', () => {
    useBrowser.getState().openUrl('https://example.com')
    const { queryByRole } = render(createElement(BrowserPanel, { standalone: true }))

    expect(queryByRole('button', { name: 'Full screen' })).toBeNull()
    expect(queryByRole('button', { name: 'Exit full screen' })).toBeNull()
    expect(queryByRole('button', { name: 'Close' })).toBeNull()
  })
})

// A site's own mark is drawn where there is one and the globe stands in where
// there is not, so a picture that never arrives has to read as the second of
// those rather than as a hole in the row.
describe('a terminal tab', () => {
  it('says what is running in it rather than Terminal', () => {
    useBrowser.getState().addTerminal()
    useBrowser.getState().addTerminal()
    const [one, two] = useBrowser.getState().tabs
    const { container } = render(createElement(BrowserPanel))

    expect(pillFor(container, one!.id)?.textContent).toContain('Terminal')

    act(() => {
      useBrowser.getState().updateTab(one!.id, { running: 'yarn dev', ran: ['yarn dev'] })
    })

    expect(pillFor(container, one!.id)?.textContent).toContain('yarn dev')
    expect(pillFor(container, two!.id)?.textContent).toContain('Terminal')
  })

  it('goes on being called what it last ran once the prompt is back', () => {
    useBrowser.getState().addTerminal()
    const tab = useBrowser.getState().tabs[0]!
    const { container } = render(createElement(BrowserPanel))

    act(() => {
      useBrowser.getState().updateTab(tab.id, { running: 'yarn build', ran: ['yarn build'] })
    })
    act(() => {
      useBrowser.getState().updateTab(tab.id, { running: '' })
    })

    expect(pillFor(container, tab.id)?.textContent).toContain('yarn build')
  })

  it('stands a card up only where there is more than the pill is showing', () => {
    useBrowser.getState().addTerminal()
    const tab = useBrowser.getState().tabs[0]!

    expect(browserTabCard({ ...tab, running: 'yarn dev', ran: ['yarn dev'] }, false)).toBeNull()
    expect(browserTabCard({ ...tab, running: 'yarn dev', ran: ['yarn dev'] }, true)).not.toBeNull()
    expect(browserTabCard({ ...tab, running: 'yarn dev', ran: ['yarn dev', 'git log'] }, false)).not.toBeNull()
  })
})

describe('a tab wearing a favicon', () => {
  const faviconIn = (root: HTMLElement, id: string) => pillFor(root, id)!.querySelector('img')

  const wearing = (src: string) => {
    useBrowser.getState().openUrl('https://example.com/one')
    const tab = useBrowser.getState().tabs[0]!
    act(() => useBrowser.getState().updateTab(tab.id, { favicon: src }))
    return tab.id
  }

  it('draws the site own mark while it loads', () => {
    const id = wearing('https://example.com/favicon.ico')
    const { container } = render(createElement(BrowserPanel))

    expect(faviconIn(container, id)).not.toBeNull()
  })

  it('stands the globe in when the picture will not load', () => {
    const id = wearing('https://example.com/favicon.ico')
    const { container } = render(createElement(BrowserPanel))

    act(() => {
      fireEvent.error(faviconIn(container, id)!)
    })

    expect(faviconIn(container, id)).toBeNull()
    expect(pillFor(container, id)!.querySelector('svg')).not.toBeNull()
  })

  it('draws the next mark rather than holding the globe on the one that broke', () => {
    const id = wearing('https://example.com/favicon.ico')
    const { container } = render(createElement(BrowserPanel))

    act(() => {
      fireEvent.error(faviconIn(container, id)!)
    })
    act(() => useBrowser.getState().updateTab(id, { favicon: 'https://example.com/icon.png' }))

    expect(faviconIn(container, id)?.getAttribute('src')).toBe('https://example.com/icon.png')
  })
})

// A page an agent showed comes up rather than waiting to be found, and asking
// for one that is already open loads it again: it is shown because it changed.
describe('a page an agent shows', () => {
  it('opens it and stands the panel up', () => {
    useBrowser.setState({ open: false })

    useBrowser.getState().showPage('http://localhost:5173')

    expect(useBrowser.getState().tabs.map(t => t.initialUrl)).toEqual(['http://localhost:5173'])
    expect(useBrowser.getState().open).toBe(true)
  })

  it('loads the one that is already open rather than opening a second', () => {
    useBrowser.getState().showPage('http://localhost:5173')
    const tab = useBrowser.getState().tabs[0]!
    useBrowser.getState().closePanel()

    useBrowser.getState().showPage('http://localhost:5173')

    const { tabs, activeTabId, open } = useBrowser.getState()
    expect(tabs).toHaveLength(1)
    expect(activeTabId).toBe(tab.id)
    expect(tabs[0]!.generation).toBe(tab.generation + 1)
    expect(open).toBe(true)
  })

  // The webview tidies an address as it loads it, so the tab reads back with a
  // slash the agent never wrote. That is the same page, not a second one.
  it('knows an address the webview tidied is the same address', () => {
    useBrowser.getState().showPage('http://localhost:5173')
    const tab = useBrowser.getState().tabs[0]!
    useBrowser.getState().updateTab(tab.id, { url: 'http://localhost:5173/' })

    useBrowser.getState().showPage('http://localhost:5173')

    expect(useBrowser.getState().tabs).toHaveLength(1)
  })

  it('keeps Raylight in one named tab as the project changes', () => {
    useBrowser.getState().openPlugin({
      name: 'raylight',
      label: 'Raylight',
      appUrl: 'https://www.raylight.app/projects'
    })
    const tab = useBrowser.getState().tabs[0]!
    useBrowser.getState().updateTab(tab.id, {
      url: 'https://www.raylight.app/editor/first-video',
      title: 'First video'
    })
    useBrowser.getState().closePanel()

    useBrowser.getState().showPage('https://raylight.app/editor/second-video')

    const state = useBrowser.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.tabs[0]).toMatchObject({
      id: tab.id,
      plugin: 'raylight',
      pluginLabel: 'Raylight',
      initialUrl: 'https://raylight.app/editor/second-video'
    })
    expect(state.open).toBe(true)
    const { container } = render(createElement(BrowserPanel))
    expect(pillFor(container, tab.id)?.textContent).toContain('Raylight')
  })

  it('opens a legacy Raylight installation from the current catalog', () => {
    useBrowser.getState().openPlugin({ name: 'raylight', label: 'Old Raylight' })
    expect(useBrowser.getState().tabs).toEqual([
      expect.objectContaining({
        plugin: 'raylight',
        pluginLabel: 'Raylight',
        initialUrl: 'https://www.raylight.app/projects'
      })
    ])
    const { container } = render(createElement(BrowserPanel))
    expect(container.querySelector('webview')?.getAttribute('partition')).toBe('persist:crew-plugin-raylight')
  })

  it('waits for a new web view before asking it to navigate', () => {
    let ready = false
    const loadURL = vi.fn(async () => undefined)
    Object.defineProperty(HTMLElement.prototype, 'getURL', {
      configurable: true,
      value: () => {
        if (!ready) throw new Error('The WebView must be attached to the DOM and the dom-ready event emitted')
        return ''
      }
    })
    Object.defineProperty(HTMLElement.prototype, 'loadURL', { configurable: true, value: loadURL })

    useBrowser.getState().openUrl('https://example.com/plugin')
    const { container } = render(createElement(BrowserPanel))

    expect(loadURL).not.toHaveBeenCalled()
    ready = true
    fireEvent(container.querySelector('webview')!, new Event('dom-ready'))
    expect(loadURL).toHaveBeenCalledWith('https://example.com/plugin')
  })

  it('shows a useful failure instead of an empty plugin page', () => {
    useBrowser.getState().openPlugin({ name: 'raylight' })
    const { container, getByText, getByRole } = render(createElement(BrowserPanel))
    const failed = Object.assign(new Event('did-fail-load'), {
      errorCode: -105,
      errorDescription: 'The network connection was lost',
      isMainFrame: true
    })
    act(() => container.querySelector('webview')!.dispatchEvent(failed))
    expect(getByText('Raylight could not open')).toBeTruthy()
    expect(getByText('The network connection was lost')).toBeTruthy()
    expect(getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(getByRole('button', { name: 'Open in browser' })).toBeTruthy()
  })

  it('routes only trusted Raylight editor pages into its plugin tab', () => {
    useBrowser.getState().showPage('https://raylight.app/account')
    expect(useBrowser.getState().tabs[0]).toMatchObject({ plugin: null })

    useBrowser.getState().showPage('https://raylight.app/editor/video-one')
    expect(useBrowser.getState().tabs).toHaveLength(2)
    expect(useBrowser.getState().tabs[1]).toMatchObject({ plugin: 'raylight', pluginLabel: 'Raylight' })
  })

  it('returns to the live Raylight editor instead of its project list', () => {
    const raylight = {
      name: 'raylight',
      label: 'Raylight',
      appUrl: 'https://www.raylight.app/projects'
    }
    useBrowser.getState().openPlugin(raylight)
    const tab = useBrowser.getState().tabs[0]!
    useBrowser.getState().updateTab(tab.id, { url: 'https://www.raylight.app/editor/live-project' })

    useBrowser.getState().openPlugin(raylight)

    expect(useBrowser.getState().tabs).toHaveLength(1)
    expect(useBrowser.getState().tabs[0]!.url).toBe('https://www.raylight.app/editor/live-project')
  })
})

// What the app says about a question the agent raised turns on whether that
// board is really in front of somebody, and pressing the way in has to put it
// there whether or not the tab was already standing.
describe('the board on screen', () => {
  it('is the board being looked at and nothing standing behind something else', () => {
    useBrowser.getState().showWork('t1')
    useBrowser.getState().openPanel()
    expect(boardOnScreen()).toBe('t1')

    useBrowser.getState().openUrl('https://example.com/one')
    expect(boardOnScreen()).toBeNull()
  })

  it('is nothing at all while the panel is put away', () => {
    useBrowser.getState().showWork('t1')
    useBrowser.getState().closePanel()
    expect(boardOnScreen()).toBeNull()
  })

  it('stands the panel back up on a board that is already in it', () => {
    useBrowser.getState().showWork('t1')
    useBrowser.getState().closePanel()

    useBrowser.getState().showWork('t1')
    useBrowser.getState().openPanel()
    expect(boardOnScreen()).toBe('t1')
  })
})

describe('handing the panel over on a switch', () => {
  const kinds = () => useBrowser.getState().tabs.map(t => t.kind)
  const panel = () => useBrowser.getState()

  beforeEach(() => {
    useBrowser.setState({
      tabs: [],
      activeTabId: null,
      width: DEFAULT_WIDTH,
      open: false,
      fullScreen: false,
      closedPlans: [],
      closedBoards: []
    })
  })

  it('lifts the project own tabs out and leaves the terminals standing', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().addTerminal(undefined, '/one')
    useBrowser.getState().showPlan('t1')

    const memory = useBrowser.getState().stash()

    expect(memory.tabs.map(t => t.kind)).toEqual(['plan', 'web'])
    expect(kinds()).toEqual(['terminal'])
  })

  it('carries the folder a shell was opened in', () => {
    useBrowser.getState().addTerminal(undefined, '/Users/one')
    useBrowser.getState().addTerminal('yarn dev', '/Users/two')
    const [one, two] = useBrowser.getState().tabs

    expect(one!.folder).toBe('/Users/one')
    expect(two!.folder).toBe('/Users/two')
    expect(two!.command).toBe('yarn dev')
    expect(useBrowser.getState().stash().tabs).toEqual([])
  })

  it('stays on the shell that was up when the project tabs go', () => {
    useBrowser.getState().addTerminal()
    const shell = useBrowser.getState().tabs[0]!
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().selectTab(shell.id)

    useBrowser.getState().stash()

    expect(panel().activeTabId).toBe(shell.id)
  })

  it('stands on the first shell when the tab that was up has gone', () => {
    useBrowser.getState().addTerminal()
    useBrowser.getState().addTerminal()
    const first = useBrowser.getState().tabs[0]!
    useBrowser.getState().openUrl('https://example.com/one')

    useBrowser.getState().stash()

    expect(panel().activeTabId).toBe(first.id)
  })

  it('stands on nothing and puts the panel away when no shell is left', () => {
    useBrowser.getState().openUrl('https://example.com/one')

    const memory = useBrowser.getState().stash()

    expect(panel().tabs).toEqual([])
    expect(panel().activeTabId).toBeNull()
    expect(panel().open).toBe(false)
    expect(memory.open).toBe(true)
  })

  it('puts the project tabs at the head and holds the shells at the tail', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().openUrl('https://example.com/two')
    const memory = useBrowser.getState().stash()
    useBrowser.getState().addTerminal(undefined, '/one')
    useBrowser.getState().addTerminal(undefined, '/two')
    const shells = useBrowser.getState().tabs.map(t => t.id)

    useBrowser.getState().restore(memory)

    expect(kinds()).toEqual(['web', 'web', 'terminal', 'terminal'])
    expect(order()).toEqual([...memory.tabs.map(t => t.id), ...shells])
  })

  it('carries a shell that stood in the middle of the row to the tail', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().addTerminal()
    const shell = useBrowser.getState().tabs[1]!
    useBrowser.getState().openUrl('https://example.com/two')

    const memory = useBrowser.getState().stash()
    useBrowser.getState().restore(memory)

    expect(kinds()).toEqual(['web', 'web', 'terminal'])
    expect(order()[2]).toBe(shell.id)
  })

  it('leaves the shell you were typing in up through the switch', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    const memory = useBrowser.getState().stash()
    useBrowser.getState().addTerminal()
    const shell = useBrowser.getState().tabs[0]!

    useBrowser.getState().restore(memory)

    expect(panel().activeTabId).toBe(shell.id)
  })

  it('opens the tab the project was left on when no shell is standing', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().openUrl('https://example.com/two')
    const memory = useBrowser.getState().stash()

    useBrowser.getState().restore(memory)

    expect(panel().activeTabId).toBe(memory.tabs[1]!.id)
    expect(panel().activeTabId).toBe(memory.activeTabId)
  })

  it('opens a project nobody has been in on nothing of its own', () => {
    useBrowser.getState().showPlan('t1')
    useBrowser.getState().closeTab(useBrowser.getState().tabs[0]!.id)
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().setWidth(560)
    useBrowser.getState().stash()
    useBrowser.getState().addTerminal()
    const shell = useBrowser.getState().tabs[0]!

    useBrowser.getState().restore(null)

    expect(order()).toEqual([shell.id])
    expect(panel().activeTabId).toBe(shell.id)
    expect(panel().width).toBe(DEFAULT_WIDTH)
    expect(panel().open).toBe(true)
    expect(panel().closedPlans).toEqual([])
    expect(panel().closedBoards).toEqual([])
  })

  it('puts the panel away for a project nobody has been in with no shell standing', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().stash()

    useBrowser.getState().restore(null)

    expect(panel().tabs).toEqual([])
    expect(panel().open).toBe(false)
  })

  it('takes what was put away with it and hands it back', () => {
    useBrowser.getState().showPlan('t1')
    useBrowser.getState().closeTab(useBrowser.getState().tabs[0]!.id)

    const memory = useBrowser.getState().stash()
    expect(memory.closedPlans).toEqual(['t1'])

    useBrowser.getState().restore(null)
    expect(panel().closedPlans).toEqual([])

    useBrowser.getState().restore(memory)
    expect(panel().closedPlans).toEqual(['t1'])
  })

  it('leaves the panel put away when the project it opens was put away', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().closePanel()

    const memory = useBrowser.getState().stash()
    expect(memory.open).toBe(false)
    useBrowser.getState().restore(memory)

    expect(panel().tabs).toHaveLength(1)
    expect(panel().open).toBe(false)
  })

  it('is the row it was after a stash and a restore of the same memory', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().showPlan('t1')
    useBrowser.getState().openUrl('https://example.com/two')
    useBrowser.getState().setWidth(560)
    const row = order()
    const active = panel().activeTabId

    const memory = useBrowser.getState().stash()
    useBrowser.getState().restore(memory)

    expect(order()).toEqual(row)
    expect(panel().activeTabId).toBe(active)
    expect(panel().width).toBe(560)
    expect(panel().open).toBe(true)
  })

  it('is the row it was with a shell standing at the tail of it', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().addTerminal()
    const row = order()
    const shell = panel().activeTabId

    const memory = useBrowser.getState().stash()
    useBrowser.getState().restore(memory)

    expect(order()).toEqual(row)
    expect(panel().activeTabId).toBe(shell)
  })

  it('hands the full screen choice over with its project', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().toggleFullScreen()

    const memory = useBrowser.getState().stash()
    expect(memory.fullScreen).toBe(true)
    expect(panel().fullScreen).toBe(false)

    useBrowser.getState().restore(memory)
    expect(panel().fullScreen).toBe(true)
  })
})
