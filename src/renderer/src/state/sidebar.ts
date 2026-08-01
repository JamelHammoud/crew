import { create } from 'zustand'

export const SIDEBAR_W = 264

const KEY = 'crew.sidebar'
const GRACE_MS = 160

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

let closing: ReturnType<typeof setTimeout> | null = null

const hold = (): void => {
  if (closing === null) return
  clearTimeout(closing)
  closing = null
}

export const useSidebar = create<SidebarState>((set, get) => ({
  pinned: held(),
  peeking: false,
  toggle: () => {
    hold()
    const pinned = !get().pinned
    keep(pinned)
    set({ pinned, peeking: false })
  },
  peek: on => {
    hold()
    if (on) {
      if (!get().pinned) set({ peeking: true })
      return
    }
    closing = setTimeout(() => {
      closing = null
      set({ peeking: false })
    }, GRACE_MS)
  }
}))
