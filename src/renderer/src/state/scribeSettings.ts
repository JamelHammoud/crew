import { useSyncExternalStore } from 'react'
import { cleanSettings, defaultSettings, type ScribeSettings } from '../../../shared/scribe'

// Everything about dictation is this machine's own: your key, your microphone,
// your dictionary. None of it is in the event log, none of it goes over the
// wire, and the crew is never told any of it. So it lives here, the way the
// volume and the theme do, and a terminal is this machine's shell rather than
// the crew's for exactly the same reason.

const KEY = 'crew.scribe'

const platform = (): string =>
  globalThis.navigator?.platform?.toLowerCase().includes('mac') ? 'darwin' : 'win32'

function read(): ScribeSettings {
  try {
    const held = globalThis.localStorage?.getItem(KEY)
    return cleanSettings(held ? JSON.parse(held) : null, platform())
  } catch {
    return defaultSettings(platform())
  }
}

let held = read()
const listeners = new Set<() => void>()

export function scribeSettings(): ScribeSettings {
  return held
}

// The window holds them and main acts on them, so the key is armed and the pill
// is told in the same breath as the switch being turned.
export function setScribeSettings(next: Partial<ScribeSettings>): void {
  held = cleanSettings({ ...held, ...next }, platform())
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(held))
  } catch {
    // Storage turned off keeps the choice for this session and no longer.
  }
  for (const listener of listeners) listener()
  void globalThis.window?.crew?.applyScribe(held)
}

// Said again on every start, because main holds no copy of its own and a key
// that was armed yesterday has to be armed again today.
export function publishScribe(): void {
  void globalThis.window?.crew?.applyScribe(held)
}

export function useScribeSettings(): ScribeSettings {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => held
  )
}
