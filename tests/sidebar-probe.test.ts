// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LivePlace } from '../src/shared/places'
import type { CurrentSession } from '../src/shared/session'

const kept = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => kept.set(key, value),
    removeItem: (key: string) => kept.delete(key),
    clear: () => kept.clear()
  }
})

class NoResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = NoResizeObserver as unknown as typeof ResizeObserver

class NoSocket {
  static OPEN = 1
  readyState = 0
  close(): void {}
  send(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}
globalThis.WebSocket = NoSocket as unknown as typeof WebSocket

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

const ONE = '/Users/jamel/one'
const TWO = '/Users/jamel/two'

const project = (folder: string) => ({
  folder,
  name: 'Jamel',
  home: 'folder' as const,
  key: folder,
  sync: true,
  shared: true,
  openedAt: folder === ONE ? 2 : 1
})

const asked: string[] = []
let live: LivePlace[] = []

const sessionFor = (folder: string): CurrentSession => ({
  wsUrl: `ws://127.0.0.1:2739/ws`,
  place: `project:${folder}`,
  name: 'Jamel',
  code: 'abc123',
  link: null,
  folder,
  home: 'folder',
  shared: false,
  synced: false,
  hosting: true,
  crewRemote: null,
  tracked: true,
  projectSync: false
})

window.crew = {
  projects: () => Promise.resolve([project(ONE), project(TWO)]),
  recentJoins: () => Promise.resolve([]),
  liveProjects: () => Promise.resolve(live),
  onLive: () => () => undefined,
  switchTo: (key: string) => {
    asked.push(key)
    return Promise.resolve(sessionFor(key.replace('project:', '')))
  },
  start: (folder: string) => Promise.resolve(sessionFor(folder)),
  closeProject: () => Promise.resolve(),
  warmTerminal: () => undefined
} as unknown as CrewBridge

const { usePlaces } = await import('../src/renderer/src/state/places')
const { PIN_MS, SIDEBAR_W, useSidebar } = await import('../src/renderer/src/state/sidebar')
const { useCrew } = await import('../src/renderer/src/state/store')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const Sidebar = (await import('../src/renderer/src/components/Sidebar')).default
const TopBar = (await import('../src/renderer/src/components/TopBar')).default
const WindowCorner = (await import('../src/renderer/src/components/WindowCorner')).default

const corner = () => render(createElement(WindowCorner))

const topBar = () =>
  render(
    createElement(TopBar, { tab: 'chat' as const, onTab: () => {}, tasksOpen: false, onToggleTasks: () => {} })
  )

const toggleIn = (root: HTMLElement) => root.querySelector('[aria-label="Projects"]') as HTMLElement

beforeEach(async () => {
  asked.length = 0
  live = []
  localStorage.clear()
  useSidebar.setState({ pinned: false, peeking: false })
  useCrew.setState({ place: `project:${ONE}`, folder: ONE, selfName: 'Jamel' })
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
  await act(async () => {
    await usePlaces.getState().load()
  })
})

afterEach(cleanup)

describe('the sidebar', () => {
  it('wears its lighter glass when it stands over the page', () => {
    const { container } = render(createElement(Sidebar, { overlay: true, strong: true }))
    const sidebar = container.querySelector('aside')
    expect(sidebar?.className).toContain('glass')
    expect(sidebar?.className).toContain('sidebar-glass')
    expect(sidebar?.className).toContain('glass-strong')
  })

  it('holds every place the app knows, newest first', async () => {
    const { container } = render(createElement(Sidebar))
    await waitFor(() => expect(container.querySelectorAll('button[aria-current], button').length).toBeGreaterThan(1))
    const titles = [...container.querySelectorAll('span.font-medium')].map(el => el.textContent)
    expect(titles.slice(0, 3)).toEqual(['Projects', 'one', 'two'])
  })

  it('shows where a project lives and marks the current one', async () => {
    const { container } = render(createElement(Sidebar))
    const current = container.querySelector('button[aria-current="page"]')
    expect(current?.textContent).toBe('one~')
    expect(current?.querySelectorAll('span')).toHaveLength(4)
  })

  it('holds the threads running in a place under it', async () => {
    live = [
      {
        key: `project:${TWO}`,
        folder: TWO,
        name: 'Jamel',
        hosting: true,
        threads: [
          { id: 't1', title: 'Check the plan charge', working: true },
          { id: 't2', title: 'Locate the STL files', working: false }
        ]
      }
    ]
    await act(async () => {
      await usePlaces.getState().load()
    })
    const { container } = render(createElement(Sidebar))
    const rows = [...container.querySelectorAll('button')].map(b => b.textContent)
    expect(rows).toContain('Check the plan charge')
    expect(rows).toContain('Locate the STL files')
  })

  it('goes to the place a thread is in and opens that thread', async () => {
    live = [
      {
        key: `project:${TWO}`,
        folder: TWO,
        name: 'Jamel',
        hosting: true,
        threads: [{ id: 't1', title: 'Check the plan charge', working: false }]
      }
    ]
    await act(async () => {
      await usePlaces.getState().load()
    })
    const { container } = render(createElement(Sidebar))
    const row = [...container.querySelectorAll('button')].find(
      b => b.textContent === 'Check the plan charge'
    ) as HTMLElement
    await act(async () => {
      fireEvent.click(row)
    })
    expect(asked).toEqual([`project:${TWO}`])
  })

  it('replaces the open thread from a thread in the place you are already in', async () => {
    live = [
      {
        key: `project:${ONE}`,
        folder: ONE,
        name: 'Jamel',
        hosting: true,
        threads: [{ id: 't9', title: 'Fix tracked files', working: false }]
      }
    ]
    await act(async () => {
      await usePlaces.getState().load()
    })
    useCrew.setState({ openThreadIds: ['t8'], openThreadId: 't8' })
    const { container } = render(createElement(Sidebar))
    const row = [...container.querySelectorAll('button')].find(
      b => b.textContent === 'Fix tracked files'
    ) as HTMLElement
    await act(async () => {
      fireEvent.click(row)
    })
    expect(asked).toEqual([])
    expect(useCrew.getState().openThreadIds).toEqual(['t9'])
    expect(useCrew.getState().openThreadId).toBe('t9')
  })

  it('opens a thread to the right from its menu', async () => {
    live = [
      {
        key: `project:${ONE}`,
        folder: ONE,
        name: 'Jamel',
        hosting: true,
        threads: [{ id: 't9', title: 'Fix tracked files', working: false }]
      }
    ]
    await act(async () => {
      await usePlaces.getState().load()
    })
    useCrew.setState({ openThreadIds: ['t8'], openThreadId: 't8' })
    render(createElement(Sidebar))

    fireEvent.contextMenu(screen.getByText('Fix tracked files'))
    fireEvent.click(screen.getByText('Open to right'))

    expect(asked).toEqual([])
    expect(useCrew.getState().openThreadIds).toEqual(['t8', 't9'])
    expect(useCrew.getState().openThreadId).toBe('t9')
  })

  it('holds a place with nothing running as a row on its own', async () => {
    const { container } = render(createElement(Sidebar))
    const rows = [...container.querySelectorAll('button')].map(b => b.textContent)
    expect(rows).toContain('one~')
    expect(rows).toContain('two~')
  })

  it('peeks on a hover without pushing the page over', () => {
    const { container } = corner()
    fireEvent.mouseEnter(toggleIn(container))
    expect(useSidebar.getState().peeking).toBe(true)
    expect(useSidebar.getState().pinned).toBe(false)
  })

  it('pins on a press, and the page is pushed over by exactly the rail', () => {
    const { container } = corner()
    fireEvent.click(toggleIn(container))
    expect(useSidebar.getState().pinned).toBe(true)
    expect(useSidebar.getState().peeking).toBe(false)
    expect(SIDEBAR_W).toBeGreaterThan(0)
  })

  it('is written down, so a window that opens after it is pinned too', () => {
    const { container } = corner()
    fireEvent.click(toggleIn(container))
    expect(localStorage.getItem('crew.sidebar')).toBe('open')
    fireEvent.click(toggleIn(container))
    expect(localStorage.getItem('crew.sidebar')).toBe('shut')
  })

  it('keeps the button out of the top bar, so the rail never stands over it', () => {
    const { container } = topBar()
    expect(toggleIn(container)).toBeNull()
  })

  it('is still there to press while the rail is standing over its own head', () => {
    const { container } = corner()
    fireEvent.mouseEnter(toggleIn(container))
    expect(useSidebar.getState().peeking).toBe(true)
    fireEvent.click(toggleIn(container))
    expect(useSidebar.getState().pinned).toBe(true)
  })

  it('holds the rail open while the pointer is anywhere in the corner', () => {
    vi.useFakeTimers()
    try {
      const { container } = corner()
      const box = container.firstElementChild as HTMLElement
      fireEvent.mouseEnter(toggleIn(container))
      fireEvent.mouseLeave(box)
      fireEvent.mouseEnter(box)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(useSidebar.getState().peeking).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lets the rail go once the pointer has left the corner for good', () => {
    vi.useFakeTimers()
    try {
      const { container } = corner()
      const box = container.firstElementChild as HTMLElement
      fireEvent.mouseEnter(toggleIn(container))
      fireEvent.mouseLeave(box)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(useSidebar.getState().peeking).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('holds the rail where it stands for the length of a pin, so nothing flickers', () => {
    vi.useFakeTimers()
    try {
      const { container } = corner()
      fireEvent.mouseEnter(toggleIn(container))
      fireEvent.click(toggleIn(container))
      expect(useSidebar.getState().pinned).toBe(true)
      expect(useSidebar.getState().peeking).toBe(true)
      act(() => {
        vi.advanceTimersByTime(PIN_MS + 20)
      })
      expect(useSidebar.getState().peeking).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not let the pointer leaving cut that hold short', () => {
    vi.useFakeTimers()
    try {
      const { container } = corner()
      const box = container.firstElementChild as HTMLElement
      fireEvent.mouseEnter(toggleIn(container))
      fireEvent.click(toggleIn(container))
      fireEvent.mouseLeave(box)
      act(() => {
        vi.advanceTimersByTime(PIN_MS - 40)
      })
      expect(useSidebar.getState().peeking).toBe(true)
      act(() => {
        vi.advanceTimersByTime(60)
      })
      expect(useSidebar.getState().peeking).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not open the rail for a pointer resting on the mark beside it', () => {
    const { container } = corner()
    fireEvent.mouseEnter(container.firstElementChild as HTMLElement)
    expect(useSidebar.getState().peeking).toBe(false)
  })

  it('switches to a place that is already running rather than opening it again', async () => {
    live = [{ key: `project:${TWO}`, folder: TWO, name: 'Jamel', hosting: true, threads: [] }]
    await act(async () => {
      await usePlaces.getState().load()
    })
    const { container } = render(createElement(Sidebar))
    const rows = [...container.querySelectorAll('button')].filter(b => b.textContent?.includes('two'))
    await act(async () => {
      fireEvent.click(rows[0])
    })
    expect(asked).toEqual([`project:${TWO}`])
  })

  it('carries the panel over to the place it switches to and leaves the shells alone', async () => {
    live = [{ key: `project:${TWO}`, folder: TWO, name: 'Jamel', hosting: true, threads: [] }]
    await act(async () => {
      await usePlaces.getState().load()
    })
    useBrowser.getState().openUrl('https://example.com/one')
    useBrowser.getState().addTerminal(undefined, ONE)
    expect(useBrowser.getState().tabs).toHaveLength(2)

    await act(async () => {
      await useCrew.getState().switchTo(`project:${TWO}`)
    })

    const tabs = useBrowser.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0].kind).toBe('terminal')
    expect(tabs[0].folder).toBe(ONE)

    await act(async () => {
      await useCrew.getState().switchTo(`project:${ONE}`)
    })
    const back = useBrowser.getState().tabs
    expect(back.map(tab => tab.kind)).toEqual(['web', 'terminal'])
  })
})
