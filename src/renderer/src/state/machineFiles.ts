import { create } from 'zustand'
import { revealedBy, type MachineDir } from '../../../shared/machinePath'

const FRESH_MS = 20_000

interface MachineFiles {
  dirs: Record<string, MachineDir[]>
  known: Set<string>
  read: (place: string, query: string) => void
}

let held: string | null = null
const at = new Map<string, number>()
const reading = new Set<string>()

export const useMachineFiles = create<MachineFiles>(set => ({
  dirs: {},
  known: new Set(),
  read: (place: string, query: string) => {
    if (place !== held) {
      held = place
      at.clear()
      reading.clear()
      set({ dirs: {}, known: new Set() })
    }
    const last = at.get(query)
    if (reading.has(query) || (last && Date.now() - last < FRESH_MS)) return
    reading.add(query)
    const ask = window.crew?.readDirs
    const asked = ask ? ask(query) : Promise.resolve<MachineDir[]>([])
    void asked
      .then(dirs => {
        at.set(query, Date.now())
        if (place !== held) return
        set(state => ({
          dirs: { ...state.dirs, [query]: dirs },
          known: new Set([...state.known, ...revealedBy(dirs)])
        }))
      })
      .catch(() => {
        at.set(query, Date.now())
      })
      .finally(() => {
        reading.delete(query)
      })
  }
}))
