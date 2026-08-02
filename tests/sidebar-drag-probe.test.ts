// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LivePlace } from '../src/shared/places'
import type { CurrentSession } from '../src/shared/session'

Element.prototype.getAnimations ??= () => []

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

const sessionFor = (folder: string): CurrentSession => ({
  wsUrl: 'ws://127.0.0.1:2739/ws',
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

const live: LivePlace[] = []

window.crew = {
  projects: () => Promise.resolve([project(ONE), project(TWO)]),
  recentJoins: () => Promise.resolve([]),
  liveProjects: () => Promise.resolve(live),
  onLive: () => () => undefined,
  switchTo: (key: string) => Promise.resolve(sessionFor(key.replace('project:', ''))),
  start: (folder: string) => Promise.resolve(sessionFor(folder)),
  closeProject: () => Promise.resolve(),
  warmTerminal: () => undefined
} as unknown as CrewBridge

const { usePlaces } = await import('../src/renderer/src/state/places')
const { useSidebar } = await import('../src/renderer/src/state/sidebar')
const { useCrew } = await import('../src/renderer/src/state/store')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const SidebarView = (await import('../src/renderer/src/components/Sidebar')).default

const Sidebar = () => createElement(SidebarView, { tab: 'chat' as const, onTab: () => {} })

const TOP = 8
const TALL = 80
const GAP = 16

const lay = (root: HTMLElement) => {
  const strip = root.querySelector('.overflow-y-auto') as HTMLElement
  strip.getBoundingClientRect = () => ({ top: 0, left: 0, height: 400, width: 240 }) as DOMRect
  const groups = [...root.querySelectorAll<HTMLElement>('[data-reorder]')]
  groups.forEach((group, index) => {
    const top = TOP + index * (TALL + GAP)
    group.getBoundingClientRect = () => ({ top, left: 0, height: TALL, width: 240 }) as DOMRect
  })
  return { strip, groups }
}

const hand = () => document.body.querySelector('[data-reorder-hand]') as HTMLElement | null
const line = (root: HTMLElement) => root.querySelector('[data-reorder-line]') as HTMLElement | null

beforeEach(async () => {
  localStorage.clear()
  useSidebar.setState({ pinned: true, peeking: false })
  useCrew.setState({ place: `project:${ONE}`, folder: ONE, selfName: 'Jamel' })
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
  await act(async () => {
    await usePlaces.getState().load()
  })
})

afterEach(() => {
  cleanup()
  document.body.style.cursor = ''
  vi.restoreAllMocks()
})

describe('dragging a project up the list', () => {
  it('says nothing until the press has really travelled', () => {
    const { container } = render(Sidebar())
    const { groups } = lay(container)
    fireEvent.pointerDown(groups[1]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 110 })
    fireEvent.pointerMove(window, { clientX: 41, clientY: 112 })
    expect(hand()).toBeNull()
    expect(line(container)).toBeNull()
    expect(groups[1]!.style.opacity).toBe('')
    fireEvent.pointerUp(window)
  })

  it('leaves what was picked up where it stands, dimmed, and carries a copy of it', () => {
    const { container } = render(Sidebar())
    const { strip, groups } = lay(container)
    fireEvent.pointerDown(groups[1]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 110 })
    fireEvent.pointerMove(window, { clientX: 60, clientY: 40 })

    expect(groups[1]!.style.opacity).toBe('0.2')
    expect(groups[1]!.style.translate).toBe('')
    expect(groups[0]!.style.translate).toBe('')
    expect(hand()?.textContent).toBe('two')
    expect(hand()?.style.translate).toBe('72px 40px')
    expect(strip.style.pointerEvents).toBe('none')
    expect(document.body.style.cursor).toBe('grabbing')
    fireEvent.pointerUp(window)
  })

  it('says nothing while the drop is where it already stands', () => {
    const { container } = render(Sidebar())
    const { groups } = lay(container)
    fireEvent.pointerDown(groups[1]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 110 })

    fireEvent.pointerMove(window, { clientX: 40, clientY: 100 })
    expect(line(container)?.style.opacity).toBe('0')

    fireEvent.pointerMove(window, { clientX: 40, clientY: 2 })
    expect(line(container)?.style.opacity).toBe('1')
    fireEvent.pointerUp(window)
  })

  it('stands the line inside the head of the list rather than on its edge', () => {
    const { container } = render(Sidebar())
    const { groups } = lay(container)
    fireEvent.pointerDown(groups[0]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 30 })

    fireEvent.pointerMove(window, { clientX: 40, clientY: 200 })
    expect(line(container)?.style.top).toBe(`${TOP + TALL + GAP + TALL + GAP / 2}px`)
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    fireEvent.pointerDown(groups[1]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 110 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 2 })
    expect(line(container)?.style.top).toBe(`${TOP / 2}px`)
    fireEvent.pointerUp(window)
  })

  // A project with threads under it is taller than the row beside it, so the
  // middle of it is a hundred pixels above its own bottom edge, which is where
  // the line stands. The pointer is what says when to move rather than that
  // middle, or the mark lands well under a cursor that is still on its way.
  it('waits for the pointer rather than the middle of a tall one', () => {
    const { container } = render(Sidebar())
    const { groups } = lay(container)
    groups[1]!.getBoundingClientRect = () =>
      ({ top: 104, left: 0, height: 200, width: 240 }) as DOMRect

    fireEvent.pointerDown(groups[0]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 40 })

    fireEvent.pointerMove(window, { clientX: 40, clientY: 250 })
    expect(line(container)?.style.opacity).toBe('0')

    fireEvent.pointerMove(window, { clientX: 40, clientY: 320 })
    expect(line(container)?.style.opacity).toBe('1')
    expect(line(container)?.style.top).toBe('312px')
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
  })

  it('reorders on the drop and takes everything it wrote off with it', () => {
    const { container } = render(Sidebar())
    const { strip, groups } = lay(container)
    expect(usePlaces.getState().places.map(one => one.title)).toEqual(['one', 'two'])

    fireEvent.pointerDown(groups[1]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 110 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 2 })
    act(() => {
      fireEvent.pointerUp(window)
    })

    expect(usePlaces.getState().places.map(one => one.title)).toEqual(['two', 'one'])
    expect(hand()).toBeNull()
    expect(line(container)).toBeNull()
    expect(groups[1]!.style.opacity).toBe('')
    expect(strip.style.pointerEvents).toBe('')
    expect(document.body.style.cursor).toBe('')
  })

  it('puts everything back and moves nothing when the drag is called off', () => {
    const { container } = render(Sidebar())
    const { groups } = lay(container)
    fireEvent.pointerDown(groups[1]!.querySelector('button')!, { button: 0, clientX: 40, clientY: 110 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 2 })
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(usePlaces.getState().places.map(one => one.title)).toEqual(['one', 'two'])
    expect(hand()).toBeNull()
    expect(groups[1]!.style.opacity).toBe('')
    expect(document.body.style.cursor).toBe('')
  })
})
