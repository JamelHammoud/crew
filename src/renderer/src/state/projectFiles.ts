import { create } from 'zustand'
import { pathIndex, type PathIndex } from '../../../shared/pathMention'

// What the project is made of, held once for the whole window. The Files pane
// reads its own list per tab, which it can afford because it is opened by hand.
// A composer cannot: the list is wanted on the keystroke that opens the menu,
// and asking git for it there is a menu that arrives after the word is typed.

const FRESH_MS = 20_000
const EMPTY: PathIndex = { paths: [], dirs: new Set(), all: new Set() }

interface ProjectFiles {
  index: PathIndex
  read: (place: string) => void
}

let held: string | null = null
let at = 0
let reading = false

export const useProjectFiles = create<ProjectFiles>(set => ({
  index: EMPTY,
  read: (place: string) => {
    // A window carries on standing while it changes project, so the list it is
    // holding belongs to the place it was read in and to no other.
    if (place !== held) {
      held = place
      at = 0
      set({ index: EMPTY })
    }
    if (reading || (at && Date.now() - at < FRESH_MS)) return
    reading = true
    const list = window.crew?.listFiles
    const asked = list ? list() : Promise.resolve<string[]>([])
    void asked
      .then(files => {
        at = Date.now()
        if (place === held) set({ index: pathIndex(files) })
      })
      .catch(() => {
        at = Date.now()
      })
      .finally(() => {
        reading = false
      })
  }
}))
