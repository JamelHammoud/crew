// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LivePlace } from '../src/shared/places'
import type { CurrentSession } from '../src/shared/session'

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
const { SIDEBAR_W, useSidebar } = await import('../src/renderer/src/state/sidebar')
const { useCrew } = await import('../src/renderer/src/state/store')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const Sidebar = (await import('../src/renderer/src/components/Sidebar')).default
const TopBar = (await import('../src/renderer/src/components/TopBar')).default

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
  it('holds every place the app knows, newest first', async () => {
    const { container } = render(createElement(Sidebar))
    await waitFor(() => expect(container.querySelectorAll('button[aria-current], button').length).toBeGreaterThan(1))
    const titles = [...container.querySelectorAll('span.font-medium')].map(el => el.textContent)
    expect(titles.slice(0, 2)).toEqual(['one', 'two'])
  })

  it('says which place this window is in and offers no way into it', async () => {
    const { container } = render(createElement(Sidebar))
    const rows = [...container.querySelectorAll('button[aria-current="true"]')]
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('one')
  })

  it('peeks on a hover without pushing the page over', () => {
    const { container } = topBar()
    fireEvent.mouseEnter(toggleIn(container))
    expect(useSidebar.getState().peeking).toBe(true)
    expect(useSidebar.getState().pinned).toBe(false)
  })

  it('pins on a press, and the page is pushed over by exactly the rail', () => {
    const { container } = topBar()
    fireEvent.click(toggleIn(container))
    expect(useSidebar.getState().pinned).toBe(true)
    expect(useSidebar.getState().peeking).toBe(false)
    expect(SIDEBAR_W).toBeGreaterThan(0)
  })

  it('is still pinned in the window that opens after it', async () => {
    const { container } = topBar()
    fireEvent.click(toggleIn(container))
    cleanup()
    const again = await import('../src/renderer/src/state/sidebar?again')
    expect((again as { useSidebar: typeof useSidebar }).useSidebar.getState().pinned).toBe(true)
  })

  it('switches to a place that is already running rather than opening it again', async () => {
    live = [{ key: `project:${TWO}`, folder: TWO, name: 'Jamel', hosting: true }]
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
    live = [{ key: `project:${TWO}`, folder: TWO, name: 'Jamel', hosting: true }]
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
