import { canPreview } from '../../../shared/files'
import { create } from 'zustand'

export type BrowserTab = {
  id: string
  kind:
    | 'web'
    | 'file'
    | 'terminal'
    | 'image'
    | 'attachment'
    | 'music'
    | 'game'
    | 'plan'
    | 'work'
    | 'aside'
    | 'agent'
    | 'review'
    | 'scan'
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
  folder: string
  mime: string
  size: number
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
  // Whether a file that is written to be read as a page, a markdown one or an
  // html one, is being read that way rather than as the text it is written in.
  // It rides on the tab, so walking from one page to the next keeps reading them
  // the way you asked for.
  preview: boolean
  generation: number
}

export const DEFAULT_WIDTH = 480
export const MIN_WIDTH = 360
export const MINIMIZE_AT = 240

export type PanelMemory = {
  tabs: BrowserTab[]
  activeTabId: string | null
  width: number
  open: boolean
  closedPlans: string[]
  closedBoards: string[]
}

type BrowserState = {
  width: number
  // Whether the panel is standing. It is a place rather than a side effect of a
  // tab existing, so it can be open on nothing and say what it can hold, and so
  // closing it is putting it away rather than throwing away what is in it.
  open: boolean
  tabs: BrowserTab[]
  activeTabId: string | null
  // The threads whose plan was put away by hand. A plan comes up with the
  // thread it belongs to, and once it has been closed it waits to be asked for
  // rather than arriving again every time that thread is opened.
  closedPlans: string[]
  // The threads whose board was put away by hand, the way a plan is.
  closedBoards: string[]
  setWidth(width: number): void
  resetWidth(): void
  togglePanel(): void
  openPanel(): void
  closePanel(): void
  openUrl(url: string): void
  showPage(url: string): void
  showFile(path: string): void
  openImage(src: string, name: string): void
  openAttachment(url: string, name: string, mime: string, size?: number): void
  openFile(path: string, line?: number | null, diff?: string | null): void
  addFileTab(path: string): void
  openFiles(): void
  openMusic(): void
  openGame(): void
  openReview(): void
  openScan(): void
  openAside(threadId: string, title: string): void
  openSubagent(threadId: string, parentThreadId: string): void
  showSubagents(parentThreadId: string): void
  leaveThreads(open: string[]): void
  showPlan(threadId: string): void
  hidePlan(): void
  showWork(threadId: string): void
  hideWork(): void
  toggleTree(id: string): void
  togglePreview(id: string): void
  toggleFolder(id: string, path: string): void
  addTab(): void
  addTerminal(command?: string, folder?: string): void
  stash(): PanelMemory
  restore(memory: PanelMemory | null): void
  selectTab(id: string): void
  moveTab(id: string, to: number): void
  closeTab(id: string): void
  closeOthers(id: string): void
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
    folder: '',
    mime: '',
    size: 0,
    game: null,
    threadId: '',
    parentThreadId: '',
    back: [],
    forward: [],
    tree: false,
    open: [],
    preview: false,
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

const sameAddress = (a: string, b: string): boolean =>
  Boolean(a) && a.replace(/\/+$/, '') === b.replace(/\/+$/, '')

function clampWidth(width: number): number {
  const max = Math.max(MIN_WIDTH, window.innerWidth - 440)
  return Math.min(Math.max(width, MIN_WIDTH), max)
}

// Taking tabs out of the row and standing on whatever is left where they were.
// The one that was up keeps its place unless it is among them, and nothing is
// written when none of them were there.
function without(
  state: BrowserState,
  gone: (tab: BrowserTab) => boolean
): Pick<BrowserState, 'tabs' | 'activeTabId'> | null {
  const index = state.tabs.findIndex(gone)
  if (index < 0) return null
  const tabs = state.tabs.filter(tab => !gone(tab))
  const activeTabId = tabs.some(tab => tab.id === state.activeTabId)
    ? state.activeTabId
    : (tabs[Math.min(index, tabs.length - 1)]?.id ?? null)
  return { tabs, activeTabId }
}

// Closing a plan or a board is remembered against the thread it belongs to,
// never against the tab, so it is still the same one when it is asked for again.
function remember(closed: string[], gone: BrowserTab[], kind: BrowserTab['kind']): string[] {
  const tab = gone.find(t => t.kind === kind)
  if (!tab || closed.includes(tab.threadId)) return closed
  return [...closed, tab.threadId]
}

// Which thread's board somebody is really looking at, or null. A tab standing
// behind another one or behind a panel that is put away is not on the screen.
export const boardOnScreen = (): string | null => {
  const { open, tabs, activeTabId } = useBrowser.getState()
  if (!open) return null
  const tab = tabs.find(one => one.id === activeTabId)
  return tab?.kind === 'work' ? tab.threadId : null
}

export const useBrowser = create<BrowserState>((write, get) => {
  // Putting something in the panel opens it, and that is written here rather
  // than on each of the dozen ways in, so a thirteenth cannot open a tab into a
  // panel nobody can see. It counts what arrived rather than what is there: a
  // page that finished loading while the panel was put away is not a way in.
  // The thread's own things are the one exception, and they write straight
  // through this: a plan and a board arrive because you opened a thread rather
  // than because you put them there, so they stand in the row and wait.
  const set: typeof write = (patch, replace) => {
    const before = get().tabs.length
    write(patch as never, replace as never)
    if (get().tabs.length > before) write({ open: true } as never)
  }

  // Nothing left in the panel is nothing to stand on, so the last tab out takes
  // the panel with it. That covers a tab that goes because you moved, a plan
  // that came with a thread you have left, and every tab closed by hand.
  // Opening it again on nothing is what the Start tab is for.
  const settle = () => {
    if (get().tabs.length === 0) write({ open: false } as never)
  }

  return {
    width: DEFAULT_WIDTH,
    open: false,
    tabs: [],
    activeTabId: null,
    closedPlans: [],
    closedBoards: [],
    setWidth: width => set({ width: clampWidth(width) }),
    resetWidth: () => set({ width: clampWidth(DEFAULT_WIDTH) }),
    // Closing keeps what is in it, so it is a toggle rather than a way to lose
    // three tabs by aiming at the wrong thing.
    togglePanel: () => write({ open: !get().open }),
    // Standing the panel up on what is already in it. A tab that is there
    // already is not something arriving, so asking for one by name never opens
    // the panel on its own: only somebody pressing something does.
    openPanel: () => write({ open: true }),
    closePanel: () => write({ open: false }),
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
    // A page an agent asked somebody to look at. It stands the panel up rather
    // than waiting to be found, which is the whole of what showing one is, and a
    // page already in a tab is loaded again rather than left standing at what it
    // looked like before the change being shown. An address the webview has
    // tidied is the same address, so a trailing slash is not a second tab.
    showPage: url => {
      const existing = get().tabs.find(
        t => t.kind === 'web' && (sameAddress(t.url, url) || sameAddress(t.initialUrl, url))
      )
      if (existing) {
        write({ activeTabId: existing.id, open: true } as never)
        get().reloadTab(existing.id)
        return
      }
      const tab = makeTab(url)
      set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    },
    showFile: path => {
      const preview = canPreview(path)
      const existing = get().tabs.find(t => t.kind === 'file' && t.path === path)
      if (existing) {
        write({ activeTabId: existing.id, open: true } as never)
        set(s => ({
          tabs: s.tabs.map(t => (t.id === existing.id ? { ...t, preview, generation: t.generation + 1 } : t))
        }))
        return
      }
      const tab = { ...makeTab(), kind: 'file' as const, path, preview }
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
    // A file in the panel, whatever it is. One already standing on the same file
    // is brought to the front rather than read a second time beside itself.
    openAttachment: (url, name, mime, size = 0) => {
      const existing = get().tabs.find(t => t.kind === 'attachment' && t.initialUrl === url)
      if (existing) {
        set({ activeTabId: existing.id })
        return
      }
      // A file written to be looked at opens as the page or the picture it is,
      // and the words it is written in are one press away. Everything else reads
      // the one way it has, so the flag is nothing to it.
      const tab = { ...makeTab(url), kind: 'attachment' as const, title: name, mime, size, preview: true }
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
    // A file in a tab of its own, beside the one it was picked from rather than
    // in place of it. It is a new tab every time, since that is what was asked
    // for: keeping the file already showing is half the reason to ask for one,
    // and a row that says new tab and does nothing is worse than a second tab.
    addFileTab: path => {
      const tab = { ...makeTab(), kind: 'file' as const, path }
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
    // One project, one review. Pressing it again brings the tab that is open to
    // the front rather than opening a second copy of the same working tree, and
    // a message half typed into the commit box is still there.
    openReview: () => {
      const { tabs, activeTabId } = get()
      const existing = tabs.find(t => t.kind === 'review')
      if (existing) {
        set({ activeTabId: existing.id })
        return
      }
      const active = tabs.find(t => t.id === activeTabId)
      if (active && active.kind === 'web' && !active.initialUrl) {
        set(s => ({ tabs: s.tabs.map(t => (t.id === active.id ? { ...t, kind: 'review' as const } : t)) }))
        return
      }
      const tab = { ...makeTab(), kind: 'review' as const }
      set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    },
    openScan: () => {
      const { tabs, activeTabId } = get()
      const existing = tabs.find(t => t.kind === 'scan')
      if (existing) {
        set({ activeTabId: existing.id })
        return
      }
      const active = tabs.find(t => t.id === activeTabId)
      if (active && active.kind === 'web' && !active.initialUrl) {
        set(s => ({ tabs: s.tabs.map(t => (t.id === active.id ? { ...t, kind: 'scan' as const } : t)) }))
        return
      }
      const tab = { ...makeTab(), kind: 'scan' as const }
      set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    },
    // A helper opens in a tab of its own, and opening one that is already in a
    // tab brings that tab to the front rather than opening a second copy of it.
    // Three helpers running is three things to watch, so unlike the plan these
    // are ordinary tabs: closable, and as many as somebody wants.
    // A question asked on the side, opened where it is answered. Each one is its
    // own tab rather than the one before it being written over, so a question
    // asked while an answer is still being read leaves that answer where it is.
    openAside: (threadId, title) => {
      const existing = get().tabs.find(t => t.kind === 'aside' && t.threadId === threadId)
      if (existing) {
        set({ activeTabId: existing.id })
        return
      }
      const tab = { ...makeTab(), kind: 'aside' as const, threadId, title }
      set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    },
    // A helper is opened with the thread that sent it, never on its own. The way
    // back out of one is one half of why, and the button in the thread's own
    // header is the other: both ask which thread a helper tab is standing in, and
    // a tab that only knows the helper cannot answer.
    openSubagent: (threadId, parentThreadId) => {
      const existing = get().tabs.find(t => t.kind === 'agent' && t.parentThreadId === parentThreadId)
      if (existing) {
        set(s => ({
          activeTabId: existing.id,
          tabs: s.tabs.map(t => (t.id === existing.id ? { ...t, threadId } : t))
        }))
        return
      }
      const tab = { ...makeTab(), kind: 'agent' as const, threadId, parentThreadId }
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
    // The thread's own things stand only while you are in it, so the helpers of
    // a thread you have left go with it the way its plan and its board do. A
    // plan and a board are taken down by the same rule that brings them up,
    // since both come with the thread; a helper is opened by hand and never
    // opens itself, so leaving is the only thing that can take one down.
    leaveThreads: open => {
      set(s => without(s, t => t.kind === 'agent' && !open.includes(t.parentThreadId)) ?? {})
      settle()
    },
    // The plan for the thread you are in. It stands at the head of the row, and
    // it is only ever the one plan, so opening another thread's takes the place
    // of the one before it. Asking for it back is asking for it, so a plan that
    // was put away is standing again from here.
    showPlan: threadId => {
      const closedPlans = get().closedPlans.filter(id => id !== threadId)
      const existing = get().tabs.find(t => t.kind === 'plan')
      if (existing?.threadId === threadId) {
        write({ activeTabId: existing.id, closedPlans })
        return
      }
      const tab = { ...makeTab(), kind: 'plan' as const, threadId }
      write(s => ({ tabs: [tab, ...s.tabs.filter(t => t.kind !== 'plan')], activeTabId: tab.id, closedPlans }))
    },
    hidePlan: () => {
      set(s => without(s, t => t.kind === 'plan') ?? {})
      settle()
    },
    // The board for the thread you are in, held the way the plan is: one of them,
    // at the head of the row, taking the place of another thread's when you move.
    showWork: threadId => {
      const closedBoards = get().closedBoards.filter(id => id !== threadId)
      const existing = get().tabs.find(t => t.kind === 'work')
      if (existing?.threadId === threadId) {
        write({ activeTabId: existing.id, closedBoards })
        return
      }
      const tab = { ...makeTab(), kind: 'work' as const, threadId }
      write(s => ({ tabs: [tab, ...s.tabs.filter(t => t.kind !== 'work')], activeTabId: tab.id, closedBoards }))
    },
    hideWork: () => {
      set(s => without(s, t => t.kind === 'work') ?? {})
      settle()
    },
    toggleTree: id =>
      set(s => ({
        tabs: s.tabs.map(t =>
          t.id === id ? { ...t, tree: !t.tree, open: t.tree ? t.open : reveal(t.open, t.path) } : t
        )
      })),
    togglePreview: id => set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, preview: !t.preview } : t)) })),
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
    addTerminal: (command, folder = '') => {
      const tab = { ...makeTab(), kind: 'terminal' as const, command: command ?? null, folder }
      set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    },
    selectTab: id => set({ activeTabId: id }),
    // The row is the order somebody put it in, so a tab dragged into another
    // place in it stays there. Which tab is up is untouched: arranging the row is
    // not going anywhere, and the one being dragged is often not the one open.
    moveTab: (id, to) =>
      set(s => {
        const from = s.tabs.findIndex(t => t.id === id)
        if (from < 0 || to === from || to < 0 || to >= s.tabs.length) return {}
        const tabs = [...s.tabs]
        tabs.splice(to, 0, ...tabs.splice(from, 1))
        return { tabs }
      }),
    closeTab: id => {
      set(s => {
        const next = without(s, t => t.id === id)
        if (!next) return {}
        const gone = s.tabs.filter(t => t.id === id)
        return {
          ...next,
          closedPlans: remember(s.closedPlans, gone, 'plan'),
          closedBoards: remember(s.closedBoards, gone, 'work')
        }
      })
      settle()
    },
    closeOthers: id => {
      set(s => {
        const kept = s.tabs.find(t => t.id === id)
        if (!kept || s.tabs.length < 2) return {}
        const gone = s.tabs.filter(t => t.id !== id)
        return {
          tabs: [kept],
          activeTabId: kept.id,
          closedPlans: remember(s.closedPlans, gone, 'plan'),
          closedBoards: remember(s.closedBoards, gone, 'work')
        }
      })
      settle()
    },
    closeAll: () => {
      set(s => ({
        tabs: [],
        activeTabId: null,
        closedPlans: remember(s.closedPlans, s.tabs, 'plan'),
        closedBoards: remember(s.closedBoards, s.tabs, 'work')
      }))
      settle()
    },
    stash: () => {
      const { tabs, activeTabId, width, open, closedPlans, closedBoards } = get()
      const mine = tabs.filter(t => t.kind !== 'terminal')
      const terminals = tabs.filter(t => t.kind === 'terminal')
      const held = terminals.some(t => t.id === activeTabId) ? activeTabId : null
      write({ tabs: terminals, activeTabId: held ?? terminals[0]?.id ?? null })
      settle()
      return {
        tabs: mine,
        activeTabId: mine.some(t => t.id === activeTabId) ? activeTabId : null,
        width,
        open,
        closedPlans,
        closedBoards
      }
    },
    restore: memory => {
      const { tabs, activeTabId } = get()
      const terminals = tabs.filter(t => t.kind === 'terminal')
      const held = terminals.some(t => t.id === activeTabId) ? activeTabId : null
      if (!memory) {
        write({
          tabs: terminals,
          activeTabId: held ?? terminals[0]?.id ?? null,
          width: DEFAULT_WIDTH,
          open: terminals.length > 0,
          closedPlans: [],
          closedBoards: []
        })
        settle()
        return
      }
      write({
        tabs: [...memory.tabs, ...terminals],
        activeTabId: held ?? memory.activeTabId,
        width: memory.width,
        open: memory.open,
        closedPlans: memory.closedPlans,
        closedBoards: memory.closedBoards
      })
      settle()
    },
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
  }
})
