import { create } from 'zustand'

export const SIDEBAR_W = 264
export const PIN_MS = 200

const KEY = 'crew.sidebar'
const GRACE_MS = 100

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
  near: boolean
  over: boolean
  toggle(): void
  peek(on: boolean): void
  hold(on: boolean): void
}

let closing: ReturnType<typeof setTimeout> | null = null
let settling: ReturnType<typeof setTimeout> | null = null

const stay = (): void => {
  if (closing === null) return
  clearTimeout(closing)
  closing = null
}

const landed = (): void => {
  if (settling === null) return
  clearTimeout(settling)
  settling = null
}

export const useSidebar = create<SidebarState>((set, get) => {
  const settle = (): void => {
    const { pinned, near, over } = get()
    if (pinned) return
    set({ peeking: near || over })
  }

  return {
    pinned: held(),
    peeking: false,
    near: false,
    over: false,
    toggle: () => {
      stay()
      landed()
      const pinned = !get().pinned
      keep(pinned)
      if (pinned && get().peeking) {
        set({ pinned })
        settling = setTimeout(() => {
          settling = null
          set({ peeking: false, near: false, over: false })
        }, PIN_MS)
        return
      }
      set({ pinned, peeking: false, near: false, over: false })
    },
    peek: on => {
      stay()
      if (on) {
        set({ near: true })
        settle()
        return
      }
      closing = setTimeout(() => {
        closing = null
        set({ near: false })
        settle()
      }, GRACE_MS)
    },
    hold: on => {
      if (on) stay()
      set({ over: on })
      settle()
    }
  }
})
