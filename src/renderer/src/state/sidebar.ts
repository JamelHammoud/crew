import { create } from 'zustand'

export const SIDEBAR_W = 264

const KEY = 'crew.sidebar'

const held = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'open'
  } catch {
    return false
  }
}

const keep = (pinned: boolean): void => {
  try {
    globalThis.localStorage?.setItem(KEY, pinned ? 'open' : 'shut')
  } catch {
    return
  }
}

type SidebarState = {
  pinned: boolean
  peeking: boolean
  toggle(): void
  peek(on: boolean): void
}

export const useSidebar = create<SidebarState>((set, get) => ({
  pinned: held(),
  peeking: false,
  toggle: () => {
    const pinned = !get().pinned
    keep(pinned)
    set({ pinned, peeking: false })
  },
  peek: on => set({ peeking: on && !get().pinned })
}))
