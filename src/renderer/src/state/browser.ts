import { create } from 'zustand'

export type BrowserTab = {
  id: string
  kind: 'web' | 'file'
  initialUrl: string
  url: string
  title: string
  favicon: string | null
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  path: string
  line: number | null
  back: string[]
  forward: string[]
  generation: number
}

type BrowserState = {
  width: number
  tabs: BrowserTab[]
  activeTabId: string | null
  setWidth(width: number): void
  openUrl(url: string): void
  openFile(path: string, line?: number | null): void
  addTab(): void
  selectTab(id: string): void
  closeTab(id: string): void
  closeAll(): void
  navigateTab(id: string, url: string): void
  navigateFile(id: string, path: string): void
  fileBack(id: string): void
  fileForward(id: string): void
  reloadFile(id: string): void
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
    back: [],
    forward: [],
    generation: 0
  }
}

function clampWidth(width: number): number {
  const max = Math.max(360, window.innerWidth - 440)
  return Math.min(Math.max(width, 360), max)
}

export const useBrowser = create<BrowserState>((set, get) => ({
  width: 480,
  tabs: [],
  activeTabId: null,
  setWidth: width => set({ width: clampWidth(width) }),
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
  openFile: (path, line = null) => {
    const { tabs, activeTabId } = get()
    const existing = tabs.find(t => t.kind === 'file' && t.path === path)
    if (existing) {
      set(s => ({
        activeTabId: existing.id,
        tabs: s.tabs.map(t => (t.id === existing.id ? { ...t, line } : t))
      }))
      return
    }
    const active = tabs.find(t => t.id === activeTabId)
    if (active && active.kind === 'web' && !active.initialUrl) {
      set(s => ({
        tabs: s.tabs.map(t => (t.id === active.id ? { ...t, kind: 'file' as const, path, line } : t))
      }))
      return
    }
    const tab = { ...makeTab(), kind: 'file' as const, path, line }
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  addTab: () => {
    const tab = makeTab()
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
  },
  selectTab: id => set({ activeTabId: id }),
  closeTab: id =>
    set(s => {
      const index = s.tabs.findIndex(t => t.id === id)
      const tabs = s.tabs.filter(t => t.id !== id)
      const activeTabId =
        s.activeTabId === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : s.activeTabId
      return { tabs, activeTabId }
    }),
  closeAll: () => set({ tabs: [], activeTabId: null }),
  navigateTab: (id, url) =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, initialUrl: url, url } : t)) })),
  navigateFile: (id, path) =>
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === id && t.path !== path
          ? { ...t, path, line: null, back: [...t.back, t.path], forward: [] }
          : t
      )
    })),
  fileBack: id =>
    set(s => ({
      tabs: s.tabs.map(t => {
        if (t.id !== id || t.back.length === 0) return t
        const path = t.back[t.back.length - 1]
        return { ...t, path, line: null, back: t.back.slice(0, -1), forward: [t.path, ...t.forward] }
      })
    })),
  fileForward: id =>
    set(s => ({
      tabs: s.tabs.map(t => {
        if (t.id !== id || t.forward.length === 0) return t
        const path = t.forward[0]
        return { ...t, path, line: null, back: [...t.back, t.path], forward: t.forward.slice(1) }
      })
    })),
  reloadFile: id =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, generation: t.generation + 1 } : t)) })),
  updateTab: (id, patch) =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, ...patch } : t)) }))
}))
