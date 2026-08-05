// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react'
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

const scrolled: { el: Element; left: number; top: number }[] = []
const askedIntoView: Element[] = []

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
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null })
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth')
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
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
      const at = Array.prototype.indexOf.call(this.parentElement?.children ?? [], this)
      return box(at * 100, 90)
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

  it('closes one tab from its own menu', () => {
    openTwo()
    const { container, getByText } = render(createElement(BrowserPanel))
    const [first, second] = useBrowser.getState().tabs

    fireEvent.contextMenu(pillFor(container, first!.id)!)
    fireEvent.click(getByText('Close tab'))

    expect(useBrowser.getState().tabs.map(t => t.id)).toEqual([second!.id])
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

  it('leaves the tab menu closed until a right click asks for it', () => {
    openTwo()
    const { queryByText } = render(createElement(BrowserPanel))

    expect(queryByText('Close all tabs')).toBeNull()
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
})

// What the app says about a question the agent raised turns on whether that
// board is really in front of somebody, and pressing the way in has to put it
// there whether or not the tab was already standing.
describe('the board on screen', () => {
  it('is the board being looked at and nothing standing behind something else', () => {
    useBrowser.getState().showWork('t1')
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
})
