import { useSyncExternalStore } from 'react'

// How loud a file plays where you are sitting. It is this machine's own, the way
// the music's volume is, and it is kept apart from it: turning a clip down is no
// reason for the crew's music to go quiet with it.
export interface MediaSound {
  volume: number
  muted: boolean
}

const KEY = 'crew.media.sound'
const DEFAULTS: MediaSound = { volume: 1, muted: false }
const listeners = new Set<() => void>()

function parse(raw: string | null): MediaSound {
  try {
    const saved = raw ? JSON.parse(raw) : null
    const level = typeof saved?.volume === 'number' ? saved.volume : DEFAULTS.volume
    return {
      volume: Math.min(1, Math.max(0, level)),
      muted: typeof saved?.muted === 'boolean' ? saved.muted : DEFAULTS.muted
    }
  } catch {
    return DEFAULTS
  }
}

let seen: string | null = null
let held: MediaSound = DEFAULTS

export function mediaSound(): MediaSound {
  const raw = globalThis.localStorage?.getItem(KEY) ?? null
  if (raw !== seen) {
    seen = raw
    held = parse(raw)
  }
  return held
}

function write(next: MediaSound): void {
  globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  for (const listener of listeners) listener()
}

export function setMediaVolume(volume: number): void {
  const level = Math.min(1, Math.max(0, volume))
  write({ volume: level, muted: level === 0 ? mediaSound().muted : false })
}

export function setMediaMuted(muted: boolean): void {
  write({ ...mediaSound(), muted })
}

export function useMediaSound(): MediaSound {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, mediaSound)
}
