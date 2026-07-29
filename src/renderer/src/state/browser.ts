import { create } from 'zustand'

export type BrowserTab = {
  id: string
  kind: 'web' | 'file' | 'terminal' | 'image' | 'music' | 'game' | 'plan' | 'aside' | 'agent'
  initialUrl: string
  url: string
  title: string
  favicon: string | null
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  path: string
  line: number | null
  diff: string | null
  // What a terminal tab was opened to run, typed into the shell once it is up.
  command: string | null
  // Which game a games tab is standing in, or null for the list of them. It
  // rides on the tab so the pill can say what you are playing and so a look at
  // another tab does not put you back at the top of the list.
  game: string | null
  // Whose plan a plan tab holds, or which helper a helper tab is reading. A
  // plan tab stands only while that thread is the one open; a helper tab is
  // ordinary, and travels between the list and the one it is reading by
  // writing its own threadId.
  threadId: string
  // The thread whose helpers a helper tab is standing in. It rides on the tab
  // so the way back out of one is still there after a look at another tab.
  parentThreadId: string
  back: string[]
  forward: string[]
  // Whether the file tree is standing beside the file, and which folders in it
  // are open. Both ride on the tab, so a tree survives a look at another tab.
  tree: boolean
  open: string[]
  generation: number
}

export const DEFAULT_WIDTH = 480

type BrowserState = {
  width: number
  tabs: BrowserTab[]
  activeTabId: string | null
  // The threads whose plan was put away by hand. A plan comes up with the
  // thread it belongs to, and once it has been closed it waits to be asked for
  // rather than arriving again every time that thread is opened.
  closedPlans: string[]
  setWidth(width: number): void
  resetWidth(): void
  openUrl(url: string): void
  openImage(src: string, name: string): void
  openFile(path: string, line?: number | null, diff?: string | null): void
  openFiles(): void
  openMusic(): void
  openGame(): void
  openSubagent(threadId: string): void
  showSubagents(parentThreadId: string): void
  showPlan(threadId: string): void
  hidePlan(): void
  closePlan(): void
  toggleTree(id: string): void
  toggleFolder(id: string, path: string): void
  addTab(): void
  addTerminal(command?: string): void
  selectTab(id: string): void
  closeTab(id: string): void
  closeAll(): void
  navigateTab(id: string, url: string): void
  navigateFile(id: string, path: string): void
  fileBack(id: string): void
  fileForward(id: string): void
  reloadTab(id: string): void
  updateTab(id: string, patch: Partial<BrowserTab>): void
}

let seq = 0

function makeTab(url = ''): BrowserTab {
  seq += 1
  return {
    id: `tab-${seq}`,
    kind: 'web',
    initialUrl: url,
    url,
    title: '',
    favicon: null,
    loading: false,
    canGoBack: false,
    canGoForward: false,
    path: '',
    line: null,
    diff: null,
    command: null,
    game: null,
    threadId: '',
    parentThreadId: '',
    back: [],
    forward: [],
    tree: false,
    open: [],
    generation: 0
  }
}

// Every folder on the way down to a file, so a tree opened beside one that is
// already showing lands on it rather than back at the top of the project.
function reveal(open: string[], path: string): string[] {
  const parts = path.split('/').filter(Boolean).slice(0, -1)
  const folders = parts.map((_, index) => parts.slice(0, index + 1).join('/'))
  return [...open, ...folders.filter(folder => !open.includes(folder))]
}

function clampWidth(width: number): number {
  const max = Math.max(360, window.innerWidth - 440)
  return Math.min(Math.max(width, 360), max)
}

// Closing a plan is remembered against the thread it belongs to, never against
// the tab, so it is still the same plan when it is asked for again.
function remember(closed: string[], gone: BrowserTab[]): string[] {
  const plan = gone.find(t => t.kind === 'plan')
  if (!plan || closed.includes(plan.threadId)) return closed
  return [...closed, plan.threadId]
}

export const useBrowser = create<BrowserState>((set, get) => ({
  width: DEFAULT_WIDTH,
  tabs: [],
  activeTabId: null,
  closedPlans: [],
  setWidth: width => set({ width: clampWidth(width) }),
  resetWidth: () => set({ width: clampWidth(DEFAULT_WIDTH) }),
  openUrl: url => {
    const { tabs, activeTabId } = get()
    const existing = tabs.find(t => t.kind === 'web' && t.url === url)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const active = tabs.find(t => t.id === activeTabId)
    if (active && active.kind === 'web' && !active.initialUrl) {
      set(s => ({
        tabs: s.tabs.map(t => (t.id === active.id ? { ...t, initialUrl: url, url } : t))
      }))
      return
    }
    const tab = makeTab(url)
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  openImage: (src, name) => {
    const existing = get().tabs.find(t => t.kind === 'image' && t.initialUrl === src)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab = { ...makeTab(src), kind: 'image' as const, title: name }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  openFile: (path, line = null, diff = null) => {
    const { tabs, activeTabId } = get()
    const existing = tabs.find(t => t.kind === 'file' && t.path === path)
    if (existing) {
      set(s => ({
        activeTabId: existing.id,
        tabs: s.tabs.map(t => (t.id === existing.id ? { ...t, line, diff, generation: t.generation + 1 } : t))
      }))
      return
    }
    const active = tabs.find(t => t.id === activeTabId)
    if (active && active.kind === 'web' && !active.initialUrl) {
      set(s => ({
        tabs: s.tabs.map(t => (t.id === active.id ? { ...t, kind: 'file' as const, path, line, diff } : t))
      }))
      return
    }
    const tab = { ...makeTab(), kind: 'file' as const, path, line, diff }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  openFiles: () => {
    const { tabs, activeTabId } = get()
    const active = tabs.find(t => t.id === activeTabId)
    const existing = active?.kind === 'file' ? active : tabs.find(t => t.kind === 'file')
    if (existing) {
      set(s => ({
        activeTabId: existing.id,
        tabs: s.tabs.map(t => (t.id === existing.id ? { ...t, tree: true, open: reveal(t.open, t.path) } : t))
      }))
      return
    }
    const tab = { ...makeTab(), kind: 'file' as const, tree: true }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  // One crew, one music tab. Pressing it again brings the one that is already
  // open to the front rather than opening a second copy of the same thing.
  openMusic: () => {
    const { tabs, activeTabId } = get()
    const existing = tabs.find(t => t.kind === 'music')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const active = tabs.find(t => t.id === activeTabId)
    if (active && active.kind === 'web' && !active.initialUrl) {
      set(s => ({ tabs: s.tabs.map(t => (t.id === active.id ? { ...t, kind: 'music' as const } : t)) }))
      return
    }
    const tab = { ...makeTab(), kind: 'music' as const }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  // One tab for the games, the way there is one for the music. Pressing it again
  // brings the one that is open to the front rather than starting a second copy
  // of a game somebody is in the middle of.
  openGame: () => {
    const { tabs, activeTabId } = get()
    const existing = tabs.find(t => t.kind === 'game')
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const active = tabs.find(t => t.id === activeTabId)
    if (active && active.kind === 'web' && !active.initialUrl) {
      set(s => ({ tabs: s.tabs.map(t => (t.id === active.id ? { ...t, kind: 'game' as const } : t)) }))
      return
    }
    const tab = { ...makeTab(), kind: 'game' as const }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  // A helper opens in a tab of its own, and opening one that is already in a
  // tab brings that tab to the front rather than opening a second copy of it.
  // Three helpers running is three things to watch, so unlike the plan these
  // are ordinary tabs: closable, and as many as somebody wants.
  openSubagent: threadId => {
    const existing = get().tabs.find(t => t.kind === 'agent' && t.threadId === threadId)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const tab = { ...makeTab(), kind: 'agent' as const, threadId }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  showSubagents: parentThreadId => {
    const existing = get().tabs.find(t => t.kind === 'agent' && t.parentThreadId === parentThreadId)
    if (existing) {
      set(s => ({
        activeTabId: existing.id,
        tabs: s.tabs.map(t => (t.id === existing.id ? { ...t, threadId: '' } : t))
      }))
      return
    }
    const tab = { ...makeTab(), kind: 'agent' as const, parentThreadId }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  // The plan for the thread you are in. It stands at the head of the row, and
  // it is only ever the one plan, so opening another thread's takes the place
  // of the one before it. Asking for it back is asking for it, so a plan that
  // was put away is standing again from here.
  showPlan: threadId => {
    const closedPlans = get().closedPlans.filter(id => id !== threadId)
    const existing = get().tabs.find(t => t.kind === 'plan')
    if (existing?.threadId === threadId) {
      set({ activeTabId: existing.id, closedPlans })
      return
    }
    const tab = { ...makeTab(), kind: 'plan' as const, threadId }
    set(s => ({ tabs: [tab, ...s.tabs.filter(t => t.kind !== 'plan')], activeTabId: tab.id, closedPlans }))
  },
  hidePlan: () =>
    set(s => {
      const index = s.tabs.findIndex(t => t.kind === 'plan')
      if (index < 0) return {}
      const plan = s.tabs[index]
      const tabs = s.tabs.filter(t => t.id !== plan.id)
      const activeTabId =
        s.activeTabId === plan.id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : s.activeTabId
      return { tabs, activeTabId }
    }),
  closePlan: () => {
    const plan = get().tabs.find(t => t.kind === 'plan')
    if (plan) get().closeTab(plan.id)
  },
  toggleTree: id =>
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === id ? { ...t, tree: !t.tree, open: t.tree ? t.open : reveal(t.open, t.path) } : t
      )
    })),
  toggleFolder: (id, path) =>
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === id
          ? { ...t, open: t.open.includes(path) ? t.open.filter(one => one !== path) : [...t.open, path] }
          : t
      )
    })),
  addTab: () => {
    const tab = makeTab()
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  addTerminal: command => {
    const tab = { ...makeTab(), kind: 'terminal' as const, command: command ?? null }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  selectTab: id => set({ activeTabId: id }),
  closeTab: id =>
    set(s => {
      const index = s.tabs.findIndex(t => t.id === id)
      if (index < 0) return {}
      const tabs = s.tabs.filter(t => t.id !== id)
      const activeTabId =
        s.activeTabId === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : s.activeTabId
      return { tabs, activeTabId, closedPlans: remember(s.closedPlans, [s.tabs[index]]) }
    }),
  closeAll: () => set(s => ({ tabs: [], activeTabId: null, closedPlans: remember(s.closedPlans, s.tabs) })),
  navigateTab: (id, url) =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, initialUrl: url, url } : t)) })),
  navigateFile: (id, path) =>
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === id && t.path !== path
          ? { ...t, path, line: null, diff: null, back: [...t.back, t.path], forward: [] }
          : t
      )
    })),
  fileBack: id =>
    set(s => ({
      tabs: s.tabs.map(t => {
        if (t.id !== id || t.back.length === 0) return t
        const path = t.back[t.back.length - 1]
        return { ...t, path, line: null, diff: null, back: t.back.slice(0, -1), forward: [t.path, ...t.forward] }
      })
    })),
  fileForward: id =>
    set(s => ({
      tabs: s.tabs.map(t => {
        if (t.id !== id || t.forward.length === 0) return t
        const path = t.forward[0]
        return { ...t, path, line: null, diff: null, back: [...t.back, t.path], forward: t.forward.slice(1) }
      })
    })),
  reloadTab: id =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, generation: t.generation + 1 } : t)) })),
  updateTab: (id, patch) =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, ...patch } : t)) }))
}))
