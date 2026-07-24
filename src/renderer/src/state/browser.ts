import { create } from 'zustand'

export type BrowserTab = {
  id: string
  initialUrl: string
  url: string
  title: string
  favicon: string | null
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

type BrowserState = {
  width: number
  tabs: BrowserTab[]
  activeTabId: string | null
  setWidth(width: number): void
  openUrl(url: string): void
  addTab(): void
  selectTab(id: string): void
  closeTab(id: string): void
  closeAll(): void
  navigateTab(id: string, url: string): void
  updateTab(id: string, patch: Partial<BrowserTab>): void
}

let seq = 0

function makeTab(url = ''): BrowserTab {
  seq += 1
  return {
    id: `tab-${seq}`,
    initialUrl: url,
    url,
    title: '',
    favicon: null,
    loading: false,
    canGoBack: false,
    canGoForward: false
  }
}

function clampWidth(width: number): number {
  const max = Math.max(360, window.innerWidth - 440)
  return Math.min(Math.max(width, 360), max)
}

export const useBrowser = create<BrowserState>((set, get) => ({
  open: false,
  width: 480,
  tabs: [],
  activeTabId: null,
  openPanel: () => {
    if (get().tabs.length === 0) {
      const tab = makeTab()
      set({ open: true, tabs: [tab], activeTabId: tab.id })
      return
    }
    set({ open: true })
  },
  closePanel: () => set({ open: false }),
  setWidth: width => set({ width: clampWidth(width) }),
  openUrl: url => {
    const { tabs, activeTabId } = get()
    const existing = tabs.find(t => t.url === url)
    if (existing) {
      set({ open: true, activeTabId: existing.id })
      return
    }
    const active = tabs.find(t => t.id === activeTabId)
    if (active && !active.initialUrl) {
      set(s => ({
        open: true,
        tabs: s.tabs.map(t => (t.id === active.id ? { ...t, initialUrl: url, url } : t))
      }))
      return
    }
    const tab = makeTab(url)
    set(s => ({ open: true, tabs: [...s.tabs, tab], activeTabId: tab.id }))
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
      return { tabs, activeTabId, open: tabs.length === 0 ? false : s.open }
    }),
  navigateTab: (id, url) =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, initialUrl: url, url } : t)) })),
  updateTab: (id, patch) =>
    set(s => ({ tabs: s.tabs.map(t => (t.id === id ? { ...t, ...patch } : t)) }))
}))
