import { create } from 'zustand'
import { playSound } from '../media/sounds'

export const ARM_MS = 150
export const GRACE_MS = 100

type TasksState = {
  pinned: boolean
  peeking: boolean
  toggle(): void
  peek(on: boolean): void
  keep(): void
  close(): void
}

let arming: ReturnType<typeof setTimeout> | null = null
let closing: ReturnType<typeof setTimeout> | null = null

const disarm = (): void => {
  if (arming === null) return
  clearTimeout(arming)
  arming = null
}

const hold = (): void => {
  if (closing === null) return
  clearTimeout(closing)
  closing = null
}

export const tasksShowing = (s: TasksState): boolean => s.pinned || s.peeking

export const useTasks = create<TasksState>((set, get) => ({
  pinned: false,
  peeking: false,
  toggle: () => {
    disarm()
    hold()
    if (get().pinned) {
      set({ pinned: false, peeking: false })
      return
    }
    if (!get().peeking) playSound('tasks.open')
    set({ pinned: true, peeking: false })
  },
  peek: on => {
    hold()
    if (on) {
      if (get().pinned || get().peeking || arming !== null) return
      arming = setTimeout(() => {
        arming = null
        if (get().pinned) return
        playSound('tasks.open')
        set({ peeking: true })
      }, ARM_MS)
      return
    }
    disarm()
    if (get().pinned) return
    closing = setTimeout(() => {
      closing = null
      set({ peeking: false })
    }, GRACE_MS)
  },
  keep: () => {
    disarm()
    hold()
    if (!get().peeking) return
    set({ pinned: true, peeking: false })
  },
  close: () => {
    disarm()
    hold()
    set({ pinned: false, peeking: false })
  }
}))
