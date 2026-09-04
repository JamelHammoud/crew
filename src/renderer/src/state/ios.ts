import { create } from 'zustand'
import type { IosFrame, IosLiveState } from '../../../shared/iosLive'
import { useBrowser } from './browser'

const LOG_KEPT = 120_000

function blank(): IosLiveState {
  return {
    phase: 'off',
    folder: '',
    project: '',
    scheme: '',
    bundleId: '',
    device: null,
    message: '',
    issues: [],
    builds: 0,
    builtAt: 0,
    setup: null
  }
}

type IosStore = {
  live: IosLiveState
  frame: IosFrame | null
  log: string
  starting: boolean
  finishing: boolean
  problem: string
  arrive(place: string): void
  open(): void
  start(): Promise<void>
  finish(): Promise<void>
  rebuild(): void
  end(): void
}

let listening = false
let arrived: string | null = null

function listen(set: (patch: Partial<IosStore>) => void, get: () => IosStore): void {
  if (listening || !window.crew?.onIosState) return
  listening = true
  window.crew.onIosState(live => set({ live }))
  window.crew.onIosFrame(frame => set({ frame }))
  window.crew.onIosOutput(output => set({ log: (get().log + output.text).slice(-LOG_KEPT) }))
}

export const useIos = create<IosStore>((set, get) => ({
  live: blank(),
  frame: null,
  log: '',
  starting: false,
  finishing: false,
  problem: '',
  // A folder that builds an app gets the tab without being asked for one, and
  // it waits there the way a plan does rather than taking the screen: booting a
  // simulator and building the whole app is minutes nobody pressed anything for.
  arrive: place => {
    if (!place || place === arrived) return
    arrived = place
    void window.crew?.hasIosProject?.().then(found => {
      if (found && arrived === place) useBrowser.getState().addSimulator()
    })
  },
  open: () => {
    useBrowser.getState().openSimulator()
    if (get().live.phase === 'off' && !get().starting) void get().start()
  },
  start: async () => {
    if (get().starting) return
    listen(set, get)
    set({ starting: true, problem: '', log: '' })
    try {
      const live = await window.crew.startIos({})
      set({ live })
    } catch (error) {
      set({ problem: error instanceof Error ? error.message : 'The simulator could not start.' })
    } finally {
      set({ starting: false })
    }
  },
  finish: async () => {
    if (get().finishing) return
    set({ finishing: true, problem: '' })
    try {
      const done = await window.crew.finishIosSetup()
      if (!done.ok && !done.turnedDown) set({ problem: done.message })
      if (done.ok) await get().start()
      else set({ live: { ...get().live, setup: await window.crew.iosSetup() } })
    } finally {
      set({ finishing: false })
    }
  },
  rebuild: () => void window.crew.rebuildIos(),
  end: () => {
    void window.crew.endIos()
    set({ live: blank(), frame: null, log: '' })
  }
}))
