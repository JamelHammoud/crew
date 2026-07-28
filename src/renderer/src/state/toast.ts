import { useSyncExternalStore, type ReactNode } from 'react'

// A word from the app about what just happened, standing under the header for a
// few seconds. Nothing anybody has to come back to is ever said here: that goes
// in the chat, in a thread, or on the row it is about.
export type ToastTone = 'plain' | 'done' | 'fail' | 'busy'

export interface ToastAction {
  label: string
  onPress: () => void
  // The row goes when the button is pressed, unless the press is the start of
  // something rather than the end of it.
  keep?: boolean
}

export interface ToastOptions {
  tone?: ToastTone
  detail?: string
  mark?: ReactNode
  action?: ToastAction
  seconds?: number
  // One row per key. Asked for again under the same key, the row standing is
  // rewritten where it stands rather than a second one arriving under it.
  key?: string
}

export interface Toast extends ToastOptions {
  id: string
  text: string
  tone: ToastTone
  seconds: number
  leaving?: boolean
}

export interface ToastHandle {
  set: (text: string, opts?: ToastOptions) => void
  done: (text: string, opts?: ToastOptions) => void
  fail: (text: string, opts?: ToastOptions) => void
  close: () => void
}

const STAY: Record<ToastTone, number> = { plain: 4, done: 4, fail: 8, busy: 0 }
const LIMIT = 4

export const TOAST_OUT_MS = 180

interface Clock {
  left: number
  at: number
  timer?: ReturnType<typeof setTimeout>
}

let toasts: Toast[] = []
let held = false
let made = 0
const listeners = new Set<() => void>()
const clocks = new Map<string, Clock>()

function tell(): void {
  for (const listener of listeners) listener()
}

function put(next: Toast[]): void {
  toasts = next
  tell()
}

function start(id: string): void {
  const clock = clocks.get(id)
  if (!clock || clock.timer || held) return
  clock.at = Date.now()
  clock.timer = setTimeout(() => closeToast(id), clock.left)
}

function pause(id: string): void {
  const clock = clocks.get(id)
  if (!clock?.timer) return
  clearTimeout(clock.timer)
  clock.timer = undefined
  clock.left = Math.max(0, clock.left - (Date.now() - clock.at))
}

function arm(id: string, seconds: number): void {
  const clock = clocks.get(id)
  if (clock?.timer) clearTimeout(clock.timer)
  clocks.delete(id)
  if (seconds <= 0) return
  clocks.set(id, { left: seconds * 1000, at: Date.now() })
  start(id)
}

function record(id: string, text: string, opts: ToastOptions): Toast {
  const tone = opts.tone ?? 'plain'
  return { ...opts, id, text, tone, seconds: opts.seconds ?? STAY[tone] }
}

function rewrite(id: string, text: string, opts: ToastOptions): string {
  const next = record(id, text, opts)
  put(toasts.map(t => (t.id === id ? next : t)))
  arm(id, next.seconds)
  return id
}

function raise(text: string, opts: ToastOptions): string {
  const standing = opts.key ? toasts.find(t => t.key === opts.key && !t.leaving) : undefined
  if (standing) return rewrite(standing.id, text, opts)
  const next = record(`toast:${++made}`, text, opts)
  put([next, ...toasts])
  for (const old of toasts.filter(t => !t.leaving).slice(LIMIT)) closeToast(old.id)
  arm(next.id, next.seconds)
  return next.id
}

// A row leaves in two beats: it is marked on the way out so the stack can close
// over it, and it is really gone once that has played.
export function closeToast(id: string): void {
  const going = toasts.find(t => t.id === id)
  if (!going || going.leaving) return
  const clock = clocks.get(id)
  if (clock?.timer) clearTimeout(clock.timer)
  clocks.delete(id)
  put(toasts.map(t => (t.id === id ? { ...t, leaving: true } : t)))
  setTimeout(() => put(toasts.filter(t => t.id !== id)), TOAST_OUT_MS)
}

export function clearToasts(): void {
  for (const t of toasts) closeToast(t.id)
}

// Nothing runs out while it is being read. The pointer resting anywhere on the
// stack holds every clock in it, and lifting it hands back what was left.
export function holdToasts(on: boolean): void {
  if (held === on) return
  held = on
  for (const id of [...clocks.keys()]) (on ? pause : start)(id)
}

function handle(first: string): ToastHandle {
  let id = first
  let closed = false
  const live = (): boolean => toasts.some(t => t.id === id && !t.leaving)
  // A run that was going long enough for its row to have gone still has
  // something to say at the end of it, so it says it as a row of its own.
  const again = (text: string, opts: ToastOptions): void => {
    if (closed) return
    id = live() ? rewrite(id, text, opts) : raise(text, opts)
  }
  return {
    set: (text, opts = {}) => {
      if (!closed && live()) rewrite(id, text, opts)
    },
    done: (text, opts = {}) => again(text, { ...opts, tone: opts.tone ?? 'done' }),
    fail: (text, opts = {}) => again(text, { ...opts, tone: opts.tone ?? 'fail' }),
    close: () => {
      closed = true
      closeToast(id)
    }
  }
}

function open(text: string, opts: ToastOptions = {}): ToastHandle {
  return handle(raise(text, opts))
}

function inTone(tone: ToastTone) {
  return (text: string, opts: ToastOptions = {}): ToastHandle => open(text, { ...opts, tone })
}

export const toast = Object.assign(open, {
  done: inTone('done'),
  fail: inTone('fail'),
  busy: inTone('busy')
})

export function useToasts(): Toast[] {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, () => toasts)
}
