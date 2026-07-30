import { useSyncExternalStore } from 'react'

// Whether this machine stays awake while Crew is open. It is yours alone, it
// sits on this machine, and nothing about it is ever sent: whether your laptop
// sleeps is no business of the crew's. Off until somebody says otherwise, the
// way the volume is kept except that main has to be told for it to be worth
// anything.

const KEY = 'crew.awake'

function read(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

let held = read()
const listeners = new Set<() => void>()

export function awake(): boolean {
  return held
}

export function setAwake(on: boolean): void {
  held = on
  try {
    globalThis.localStorage?.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // Storage turned off keeps the choice for this session and no longer.
  }
  for (const listener of listeners) listener()
  globalThis.window?.crew?.keepAwake?.(held)
}

// Said again on every start, because main holds no copy of its own and a
// machine kept awake yesterday has to be asked for again today.
export function publishAwake(): void {
  globalThis.window?.crew?.keepAwake?.(held)
}

export function useAwake(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => held
  )
}
