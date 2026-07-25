import { useSyncExternalStore } from 'react'

const KEY = 'crew.sound'
const listeners = new Set<() => void>()

export function soundsOn(): boolean {
  return globalThis.localStorage?.getItem(KEY) !== 'off'
}

export function setSounds(on: boolean): void {
  globalThis.localStorage?.setItem(KEY, on ? 'on' : 'off')
  for (const listener of listeners) listener()
}

export function useSounds(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, soundsOn)
}
