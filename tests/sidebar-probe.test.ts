// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const asked: string[] = []
const joined: Array<[string, string, string]> = []
let picked: string | null = null
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
  join: (link: string, folder: string, name: string) => {
    joined.push([link, folder, name])
    return Promise.resolve(sessionFor(folder))
  },
  pickFolder: () => Promise.resolve(picked),
  cloneRepo: () => Promise.resolve(null),
  projectPlan: () => Promise.resolve({ known: true, home: 'folder', crewRemote: null, crewHere: true }),
  closeProject: () => Promise.resolve(),
  warmTerminal: () => undefined
} as unknown as CrewBridge

const { usePlaces } = await import('../src/renderer/src/state/places')
const { PIN_MS, SIDEBAR_W, useSidebar } = await import('../src/renderer/src/state/sidebar')
const { useCrew } = await import('../src/renderer/src/state/store')
const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useTasks } = await import('../src/renderer/src/state/tasks')
const SidebarView = (await import('../src/renderer/src/components/Sidebar')).default
const { markOf } = await import('../src/renderer/src/components/sidebar/PlaceFace')
const TopBar = (await import('../src/renderer/src/components/TopBar')).default
const WindowCorner = (await import('../src/renderer/src/components/WindowCorner')).default
const { FolderGlyph, GlobeGlyph } = await import('../src/renderer/src/icons')
const { REACH_MS } = await import('../src/renderer/src/components/useHoverMenu')

const rest = (ms: number) => new Promise(done => setTimeout(done, ms))

const CROSSING_MS = 60

const Sidebar = (
  props: {
    overlay?: boolean
    strong?: boolean
    tab?: 'chat' | 'docs' | 'design' | 'plugins'
    onTab?: (tab: 'chat' | 'docs' | 'design' | 'plugins') => void
  } = {}
) =>
  createElement(SidebarView, { tab: 'chat' as const, onTab: () => {}, ...props })

const corner = () => render(createElement(WindowCorner))

const topBar = () =>
  render(createElement(TopBar))

const toggleIn = (root: HTMLElement) => root.querySelector('[aria-label="Projects"]') as HTMLElement

const reachIn = (root: HTMLElement) => root.querySelector('.app-no-drag') as HTMLElement

beforeEach(async () => {
  asked.length = 0
  joined.length = 0
  picked = null
  live = []
  localStorage.clear()
  useSidebar.setState({ pinned: false, peeking: false, near: false, over: false })
  useCrew.setState({ place: `project:${ONE}`, folder: ONE, selfName: 'Jamel' })
  useBrowser.setState({ tabs: [], activeTabId: null, open: false })
  await act(async () => {
    await usePlaces.getState().load()
  })
})

afterEach(() => {
  cleanup()
  useTasks.setState({ pinned: false, peeking: false })
  vi.restoreAllMocks()
})

describe('the sidebar', () => {
  it('wears its lighter glass when it stands over the page', () => {
    const { container } = render(Sidebar({ overlay: true, strong: true }))
    const sidebar = container.querySelector('aside')
    expect(sidebar?.className).toContain('glass')
    expect(sidebar?.className).toContain('sidebar-glass')
    expect(sidebar?.className).toContain('glass-strong')
  })

  it('wears its pinned surface when it expands beside the page', () => {
    const { container } = render(Sidebar())
    expect(container.querySelector('aside')?.className).toContain('sidebar-pinned')
  })

  it('holds the three pages at its head, then the tasks, then More under them', () => {
    const { container } = render(Sidebar())
    const nav = container.querySelector('nav[aria-label="Main navigation"]') as HTMLElement
    expect([...nav.querySelectorAll('button')].map(one => one.textContent)).toEqual([
      'Chat',
      'Docs',
      'Design',
      'Tasks',
      'More'
    ])
    expect(nav.querySelector('button[aria-current="page"]')?.textContent).toBe('Chat')
  })

  it('opens More to the side on hover and goes to the page a row in it names', async () => {
    const went: string[] = []
    useSidebar.setState({ pinned: false, peeking: true })
    render(Sidebar({ onTab: tab => went.push(tab) }))
    const more = screen.getByRole('button', { name: 'More' })
    expect(screen.queryByRole('button', { name: 'Plugins' })).toBeNull()
    fireEvent.pointerEnter(more.parentElement as HTMLElement)
    const row = await screen.findByRole('button', { name: 'Plugins' })
    expect(row.getBoundingClientRect().left).toBeGreaterThanOrEqual(more.getBoundingClientRect().right)
    fireEvent.click(row)
    expect(went).toEqual(['plugins'])
    await waitFor(() => expect(useSidebar.getState().peeking).toBe(false))
  })

  it('holds the More menu up while the pointer crosses the gap to it', async () => {
    useSidebar.setState({ pinned: true })
    render(Sidebar())
    const row = screen.getByRole('button', { name: 'More' }).parentElement as HTMLElement
    fireEvent.pointerEnter(row)
    const plugins = await screen.findByRole('button', { name: 'Plugins' })
    fireEvent.pointerLeave(row)
    await rest(CROSSING_MS)
    expect(screen.queryByRole('button', { name: 'Plugins' })).not.toBeNull()
    fireEvent.pointerEnter(plugins.parentElement as HTMLElement)
    await rest(REACH_MS + 80)
    expect(screen.queryByRole('button', { name: 'Plugins' })).not.toBeNull()
  })

  it('puts the More menu away once the pointer has left both it and the row', async () => {
    useSidebar.setState({ pinned: true })
    render(Sidebar())
    const row = screen.getByRole('button', { name: 'More' }).parentElement as HTMLElement
    fireEvent.pointerEnter(row)
    await screen.findByRole('button', { name: 'Plugins' })
    fireEvent.pointerLeave(row)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Plugins' })).toBeNull())
  })

  it('pins the More menu on a press, so the pointer leaving no longer takes it', async () => {
    useSidebar.setState({ pinned: true })
    render(Sidebar())
    const more = screen.getByRole('button', { name: 'More' })
    const row = more.parentElement as HTMLElement
    fireEvent.pointerEnter(row)
    await screen.findByRole('button', { name: 'Plugins' })
    fireEvent.pointerDown(more)
    fireEvent.click(more)
    fireEvent.pointerLeave(row)
    await rest(REACH_MS + 80)
    expect(screen.queryByRole('button', { name: 'Plugins' })).not.toBeNull()
    expect(more.getAttribute('aria-expanded')).toBe('true')
  })

  it('puts a pinned More menu away on a second press', async () => {
    useSidebar.setState({ pinned: true })
    render(Sidebar())
    const more = screen.getByRole('button', { name: 'More' })
    fireEvent.pointerEnter(more.parentElement as HTMLElement)
    await screen.findByRole('button', { name: 'Plugins' })
    fireEvent.pointerDown(more)
    fireEvent.click(more)
    fireEvent.pointerDown(more)
    fireEvent.click(more)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Plugins' })).toBeNull())
  })

  it('holds a hovered rail open for as long as the menu it opened stands', async () => {
    useSidebar.setState({ pinned: false, peeking: true, near: true })
    render(Sidebar({ overlay: true }))
    const row = screen.getByRole('button', { name: 'More' }).parentElement as HTMLElement
    fireEvent.pointerEnter(row)
    const plugins = await screen.findByRole('button', { name: 'Plugins' })
    fireEvent.pointerEnter(plugins.parentElement as HTMLElement)
    act(() => useSidebar.getState().peek(false))
    await rest(REACH_MS + 80)
    expect(useSidebar.getState().peeking).toBe(true)
    fireEvent.pointerLeave(plugins.parentElement as HTMLElement)
    await waitFor(() => expect(useSidebar.getState().peeking).toBe(false))
  })

  it('lights More while the page it holds is the one showing', () => {
    render(Sidebar({ tab: 'plugins' }))
    expect(screen.getByRole('button', { name: 'More' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the toolbox off the More row and holds a hovered rail up while it stands', async () => {
    useSidebar.setState({ pinned: false, peeking: true })
    render(Sidebar())
    const more = screen.getByRole('button', { name: 'More' })
    fireEvent.pointerEnter(more.parentElement as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Toolbox' }))

    expect(screen.getByRole('button', { name: 'New tool' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Plugins' })).toBeNull()

    act(() => useSidebar.getState().peek(false))
    await rest(REACH_MS + 80)
    expect(useSidebar.getState().peeking).toBe(true)
  })

  it('puts the toolbox away on a second press of the row that opened it', async () => {
    render(Sidebar())
    const more = screen.getByRole('button', { name: 'More' })
    fireEvent.pointerEnter(more.parentElement as HTMLElement)
    fireEvent.click(await screen.findByRole('button', { name: 'Toolbox' }))
    expect(screen.getByRole('button', { name: 'New tool' })).toBeTruthy()

    fireEvent.click(more)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'New tool' })).toBeNull())
    expect(screen.queryByRole('button', { name: 'Plugins' })).toBeNull()
  })

  it('opens the tasks from its own row and puts a hovered sidebar away with it', async () => {
    useSidebar.setState({ pinned: false, peeking: true })
    render(Sidebar())

    fireEvent.click(screen.getByRole('button', { name: /^Tasks/ }))

    expect(useTasks.getState().pinned).toBe(true)
    await waitFor(() => expect(useSidebar.getState().peeking).toBe(false))
  })

  it('goes to the page a row names and puts a hovered sidebar away with it', async () => {
    const went: string[] = []
    useSidebar.setState({ pinned: false, peeking: true })
    render(Sidebar({ onTab: tab => went.push(tab) }))
    fireEvent.click(screen.getByRole('button', { name: 'Docs' }))
    expect(went).toEqual(['docs'])
    await waitFor(() => expect(useSidebar.getState().peeking).toBe(false))
  })

  it('scrolls its projects on their own, under a heading that holds still', () => {
    const { container } = render(Sidebar())
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    expect(scroller.className).toContain('scroll-fade')
    expect(scroller.previousElementSibling?.textContent).toBe('Projects')
    expect(scroller.className).toContain('pt-2')
    expect(scroller.querySelector('.flex-col')?.className).toContain('gap-3')
    expect(container.querySelector('nav[aria-label="Main navigation"]')?.className).toContain('shrink-0')
    expect(container.querySelector('h2')?.parentElement?.className).toContain('shrink-0')
  })

  it('fades only the end of the list that is really hiding something', async () => {
    const { container } = render(Sidebar())
    const scroller = container.querySelector('.scroll-fade') as HTMLElement
    await waitFor(() => expect(scroller.hasAttribute('data-fade-top')).toBe(false))
    expect(scroller.hasAttribute('data-fade-bottom')).toBe(false)

    Object.defineProperty(scroller, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(scroller, 'scrollHeight', { value: 400, configurable: true })
    fireEvent.scroll(scroller)
    await waitFor(() => expect(scroller.hasAttribute('data-fade-bottom')).toBe(true))
    expect(scroller.hasAttribute('data-fade-top')).toBe(false)

    scroller.scrollTop = 300
    fireEvent.scroll(scroller)
    await waitFor(() => expect(scroller.hasAttribute('data-fade-top')).toBe(true))
    expect(scroller.hasAttribute('data-fade-bottom')).toBe(false)
  })

  it('holds the pages on its own, so the header carries none of them', () => {
    const { container } = topBar()
    expect(container.querySelector('nav[aria-label="Main navigation"]')).toBeNull()
  })

  it('stands the way to a new crew beside the heading, out of sight until the row is hovered', () => {
    const { container } = render(Sidebar())
    const head = container.querySelector('h2')?.parentElement as HTMLElement
    const action = screen.getByRole('button', { name: 'New project' })
    expect(head.contains(action)).toBe(true)
    expect(head.className).toContain('group')
    expect(action.className).toContain('opacity-0')
    expect(action.className).toContain('group-hover:opacity-100')
  })

  it('holds it on screen while the menu it opened is standing', async () => {
    render(Sidebar())
    const action = screen.getByRole('button', { name: 'New project' })
    fireEvent.click(action)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open a folder' })).toBeTruthy())
    expect(action.className).toContain('opacity-100')
    expect(action.className).not.toContain('opacity-0')
  })

  it('offers every way to a new crew behind the one button, in the words the way in uses', async () => {
    render(Sidebar())
    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join with a link' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Open a folder' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clone Git repo' })).toBeTruthy()
  })

  it('clones a Git repo, then opens its folder in Crew', async () => {
    const cloned = '/Users/jamel/project'
    const cloneRepo = vi.spyOn(window.crew, 'cloneRepo').mockResolvedValueOnce(cloned)
    const start = vi.spyOn(window.crew, 'start')
    render(Sidebar())
    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Clone Git repo' }))
    fireEvent.change(screen.getByLabelText('Repository URL'), {
      target: { value: '  https://github.com/owner/project.git  ' }
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }))
    })
    expect(cloneRepo).toHaveBeenCalledWith('https://github.com/owner/project.git')
    await waitFor(() => expect(start).toHaveBeenCalledWith(cloned, 'Jamel', undefined))
    expect(screen.queryByLabelText('Repository URL')).toBeNull()
  })

  it('keeps the clone card open and says why cloning failed', async () => {
    vi.spyOn(window.crew, 'cloneRepo').mockRejectedValueOnce(
      new Error("Error invoking remote method 'repo:clone': Error: Repository not found.")
    )
    render(Sidebar())
    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Clone Git repo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }))
    expect(screen.getByText('Paste the repository URL first.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Repository URL'), {
      target: { value: 'https://github.com/owner/missing.git' }
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }))
    })
    expect(screen.getByText('Repository not found.')).toBeTruthy()
    expect(screen.getByLabelText('Repository URL')).toBeTruthy()
  })

  it('joins a crew from the sidebar, on the link and the folder the card was given', async () => {
    picked = TWO
    render(Sidebar())
    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join with a link' }))
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  crew://192.0.2.10:2739/a1b2c3  ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }))
    })
    expect(screen.getByText(TWO)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    })
    expect(joined).toEqual([['crew://192.0.2.10:2739/a1b2c3', TWO, 'Jamel']])
    await waitFor(() => expect(screen.queryByRole('textbox')).toBe(null))
  })

  it('says why a join did not happen on the card the link was typed on', async () => {
    picked = TWO
    vi.spyOn(window.crew, 'join').mockRejectedValueOnce(
      new Error("Error invoking remote method 'crew:join': Error: No crew answered there.")
    )
    render(Sidebar())
    fireEvent.click(screen.getByRole('button', { name: 'New project' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join with a link' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    })
    expect(screen.getByText('Paste the link first.')).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'crew://192.0.2.10:2739/a1b2c3' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    })
    expect(screen.getByText('No crew answered there.')).toBeTruthy()
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('holds every place the app knows, newest first', async () => {
    const { container } = render(Sidebar())
    await waitFor(() => expect(container.querySelectorAll('button[aria-current], button').length).toBeGreaterThan(1))
    const titles = [...container.querySelectorAll('span.font-medium')].map(el => el.textContent)
    expect(titles.slice(0, 2)).toEqual(['one', 'two'])
  })

  it('takes a name of your own for a project, from the row it stands on', async () => {
    render(Sidebar())
    fireEvent.contextMenu(screen.getByText('one'))
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wallet' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    })

    expect(screen.getByText('Wallet')).toBeTruthy()
    expect(screen.queryByText('one')).toBeNull()
  })

  it('keeps the project menu actions short', async () => {
    live = [
      {
        key: `project:${ONE}`,
        folder: ONE,
        name: 'Jamel',
        hosting: true,
        threads: []
      }
    ]
    await act(async () => {
      await usePlaces.getState().load()
    })
    render(Sidebar())

    fireEvent.contextMenu(screen.getByText('one'))

    expect(await screen.findByRole('button', { name: 'Stop' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Stop project' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove from the list' })).toBeNull()
  })

  it('keeps that name after the list is read again, and gives it back when it is blanked', async () => {
    render(Sidebar())
    fireEvent.contextMenu(screen.getByText('one'))
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wallet' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    })

    await act(async () => {
      await usePlaces.getState().load()
    })
    expect(usePlaces.getState().places.map(place => place.title)).toEqual(['Wallet', 'two'])

    fireEvent.contextMenu(screen.getByText('Wallet'))
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    })

    expect(screen.getByText('one')).toBeTruthy()
    expect(usePlaces.getState().places[0]?.nickname).toBe(null)
  })

  it('opens that card on the name already standing, so it is edited rather than typed again', async () => {
    render(Sidebar())
    fireEvent.contextMenu(screen.getByText('one'))
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Name') as HTMLInputElement).placeholder).toBe('one')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Wallet' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    })

    fireEvent.contextMenu(screen.getByText('Wallet'))
    fireEvent.click(await screen.findByRole('button', { name: 'Rename' }))
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Wallet')
  })

  it('draws folders for local projects and a globe for remote projects', () => {
    const local = usePlaces.getState().places[0]!
    const privateLocal = { ...local, project: { ...local.project!, home: 'private' as const } }
    const remote = { ...local, project: null, join: {} as never }

    expect(markOf(local).type).toBe(FolderGlyph)
    expect(markOf(privateLocal).type).toBe(FolderGlyph)
    expect(markOf(remote).type).toBe(GlobeGlyph)
  })

  it('keeps its first order when opening a project changes its recent time', async () => {
    expect(usePlaces.getState().places.map(place => place.title)).toEqual(['one', 'two'])
    const reordered = [project(TWO), { ...project(ONE), openedAt: 0 }]
    vi.spyOn(window.crew, 'projects').mockResolvedValueOnce(reordered)

    await act(async () => {
      await usePlaces.getState().load()
    })

    expect(usePlaces.getState().places.map(place => place.title)).toEqual(['one', 'two'])
  })

  it('keeps projects in the order they were dragged into', async () => {
    const { container } = render(Sidebar())
    const groups = Array.from(container.querySelectorAll<HTMLElement>('[data-reorder]'))
    const list = groups[0]!.parentElement!
    list.getBoundingClientRect = () =>
      ({ top: 0, bottom: 400, height: 400, left: 0, right: 240, width: 240 }) as DOMRect
    groups.forEach((group, index) => {
      group.getBoundingClientRect = () =>
        ({ top: index * 100, bottom: index * 100 + 90, height: 90, left: 0, right: 240, width: 240 }) as DOMRect
    })
    const first = groups[0]!.querySelector('button')!

    act(() => {
      fireEvent.pointerDown(first, { button: 0, clientY: 45 })
      fireEvent.pointerMove(window, { clientY: 200 })
      fireEvent.pointerUp(window)
    })

    expect(usePlaces.getState().places.map(place => place.title)).toEqual(['two', 'one'])
    expect(JSON.parse(localStorage.getItem('crew.project-order') ?? '[]')).toEqual([
      `project:${TWO}`,
      `project:${ONE}`
    ])

    await act(async () => {
      await usePlaces.getState().load()
    })

    expect(usePlaces.getState().places.map(place => place.title)).toEqual(['two', 'one'])
  })

  it('does not open a project when its drag ends', () => {
    const start = vi.spyOn(window.crew, 'start')
    const { container } = render(Sidebar())
    const groups = Array.from(container.querySelectorAll<HTMLElement>('[data-reorder]'))
    const list = groups[0]!.parentElement!
    list.getBoundingClientRect = () =>
      ({ top: 0, bottom: 400, height: 400, left: 0, right: 240, width: 240 }) as DOMRect
    groups.forEach((group, index) => {
      group.getBoundingClientRect = () =>
        ({ top: index * 100, bottom: index * 100 + 90, height: 90, left: 0, right: 240, width: 240 }) as DOMRect
    })
    const first = groups[0]!.querySelector('button')!

    act(() => {
      fireEvent.pointerDown(first, { button: 0, clientY: 45 })
      fireEvent.pointerMove(window, { clientY: 200 })
      fireEvent.pointerUp(window)
      fireEvent.click(first)
    })

    expect(start).not.toHaveBeenCalled()
  })

  it('marks the current project', async () => {
    const { container } = render(Sidebar())
    const current = container.querySelector('button[aria-current="true"]')
    expect(current?.textContent).toBe('one')
    expect(current?.querySelectorAll('span')).toHaveLength(2)
    expect(current?.closest('[data-reorder]')?.className).toContain('opacity-100')
    const other = [...container.querySelectorAll('[data-reorder]')].find(group => group.textContent === 'two')
    expect(other?.className).toContain('opacity-45')
    expect(other?.className).toContain('hover:opacity-100')
    expect(other?.className).toContain('focus-within:opacity-100')
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
    const { container } = render(Sidebar())
    const rows = [...container.querySelectorAll('button')].map(b => b.textContent)
    expect(rows).toContain('Check the plan charge')
    expect(rows).toContain('Locate the STL files')
    const working = [...container.querySelectorAll('button')].find(b => b.textContent === 'Check the plan charge')!
    const idle = [...container.querySelectorAll('button')].find(b => b.textContent === 'Locate the STL files')!
    const spinner = working.querySelector('[role="status"]') as HTMLElement
    expect(spinner.ariaLabel).toBe('Working')
    expect(spinner.style.width).toBe('10px')
    expect(working.querySelector('.bg-positive')).toBe(null)
    expect(idle.querySelector('[role="status"]')).toBe(null)
  })

  it('keeps the open thread highlighted beneath its project', async () => {
    live = [
      {
        key: `project:${ONE}`,
        folder: ONE,
        name: 'Jamel',
        hosting: true,
        threads: [{ id: 't1', title: 'Check the plan charge', working: false }]
      }
    ]
    await act(async () => {
      await usePlaces.getState().load()
    })
    useCrew.setState({ openThreadIds: ['t1'], openThreadId: 't1' })
    render(Sidebar())
    const thread = screen.getByRole('button', { name: 'Check the plan charge' })
    expect(thread.className).toContain('bg-fg/[0.10]')
    expect(thread.previousElementSibling?.textContent).toBe('one')
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
    const { container } = render(Sidebar())
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
    const { container } = render(Sidebar())
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

  it('leaves the thread it was reading for the project itself', async () => {
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
    useCrew.setState({ openThreadIds: ['t9'], openThreadId: 't9' })
    render(Sidebar())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'one' }))
    })

    expect(asked).toEqual([])
    expect(useCrew.getState().openThreadIds).toEqual([])
    expect(useCrew.getState().openThreadId).toBe(null)
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
    render(Sidebar())

    fireEvent.contextMenu(screen.getByText('Fix tracked files'))
    fireEvent.click(screen.getByText('Open to right'))

    expect(asked).toEqual([])
    expect(useCrew.getState().openThreadIds).toEqual(['t8', 't9'])
    expect(useCrew.getState().openThreadId).toBe('t9')
  })

  it('holds a place with nothing running as a row on its own', async () => {
    const { container } = render(Sidebar())
    const rows = [...container.querySelectorAll('button')].map(b => b.textContent)
    expect(rows).toContain('one')
    expect(rows).toContain('two')
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
      const reach = reachIn(container)
      fireEvent.mouseEnter(toggleIn(container))
      fireEvent.mouseLeave(reach)
      fireEvent.mouseEnter(reach)
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
      fireEvent.mouseEnter(toggleIn(container))
      fireEvent.mouseLeave(reachIn(container))
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

  it('stands the button there whenever the rail is away', () => {
    const { container } = corner()
    expect(toggleIn(container).className).not.toContain('opacity-0')
  })

  it('stands the button there while the rail is open too, since the band it sits in reports no pointer', () => {
    act(() => {
      useSidebar.setState({ pinned: true })
    })
    const { container } = corner()
    const button = toggleIn(container)
    expect(button.className).not.toContain('opacity-0')
    expect(button.className).not.toContain('pointer-events-none')
  })

  it('wears the same weight in both states, quiet until it is reached', () => {
    const { container } = corner()
    const away = toggleIn(container).className
    act(() => {
      useSidebar.setState({ pinned: true })
    })
    expect(toggleIn(container).className).toBe(away)
    expect(away).toContain('text-fg-muted')
    expect(away).toContain('hover:text-fg-secondary')
  })

  it('leaves the head of an expanded rail draggable', () => {
    const { container } = corner()
    expect((container.firstElementChild as HTMLElement).className).toContain('app-drag')
    act(() => {
      useSidebar.setState({ pinned: true })
    })
    const box = container.firstElementChild as HTMLElement
    expect(box.className).toContain('app-drag')
    expect(box.className).not.toContain('app-no-drag')
    expect(box.style.width).toBe(`${SIDEBAR_W}px`)
  })

  it('stands the controls out of that band, in a reach of their own', () => {
    act(() => {
      useSidebar.setState({ pinned: true })
    })
    const { container } = corner()
    const reach = reachIn(container)
    expect(reach.className).toContain('h-full')
    expect(reach.contains(toggleIn(container))).toBe(true)
  })

  it('leaves the mark where it stands whichever state the rail is in', () => {
    const { container } = corner()
    const shut = [...container.querySelectorAll('svg')].length
    act(() => {
      useSidebar.setState({ pinned: true })
    })
    expect([...container.querySelectorAll('svg')].length).toBe(shut)
    expect(toggleIn(container)).not.toBeNull()
  })

  it('stands over the whole page, whatever the page stacks inside itself', async () => {
    const app = (await import('../src/renderer/src/App.tsx?raw')).default as string
    const main = app.indexOf('<main')
    expect(main).toBeGreaterThan(-1)
    expect(app.slice(app.lastIndexOf('<div className="', main), main)).toContain('isolate')
    expect(app.indexOf('className="rail')).toBeGreaterThan(main)
  })

  it('switches to a place that is already running rather than opening it again', async () => {
    live = [{ key: `project:${TWO}`, folder: TWO, name: 'Jamel', hosting: true, threads: [] }]
    await act(async () => {
      await usePlaces.getState().load()
    })
    const { container } = render(Sidebar())
    const rows = [...container.querySelectorAll('button')].filter(b => b.textContent?.includes('two'))
    await act(async () => {
      fireEvent.click(rows[0])
    })
    expect(asked).toEqual([`project:${TWO}`])
  })

  it('returns to the first project before the switch away finishes', async () => {
    live = [
      { key: `project:${ONE}`, folder: ONE, name: 'Jamel', hosting: true, threads: [] },
      { key: `project:${TWO}`, folder: TWO, name: 'Jamel', hosting: true, threads: [] }
    ]
    await act(async () => {
      await usePlaces.getState().load()
    })
    let finishAway: (() => void) | undefined
    vi.spyOn(window.crew, 'switchTo').mockImplementation(key => {
      asked.push(key)
      if (key === `project:${ONE}`) return Promise.resolve(sessionFor(ONE))
      return new Promise(resolve => {
        finishAway = () => resolve(sessionFor(TWO))
      })
    })
    useBrowser.getState().openUrl('https://example.com/host')
    const { container } = render(Sidebar())
    const row = (name: string) =>
      [...container.querySelectorAll<HTMLButtonElement>('[data-reorder] > button')].find(
        button => button.textContent === name
      )!

    fireEvent.click(row('two'))
    fireEvent.click(row('one'))

    await waitFor(() => expect(asked).toEqual([`project:${TWO}`, `project:${ONE}`]))
    await act(async () => finishAway?.())
    expect(useCrew.getState().place).toBe(`project:${ONE}`)
    expect(useBrowser.getState().tabs.map(tab => tab.kind)).toEqual(['web'])
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
