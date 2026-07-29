import { useEffect, useState } from 'react'
import type { Said } from '../../../shared/scribeSaid'

// The last few dictations, so one can be copied again after it has landed
// somewhere. Main holds them, because main is the one place every dictation
// passes through on its way out, and it says so when the list changes rather
// than being asked: a page that is open while somebody is talking fills itself
// in as they finish.
//
// Like the rest of Scribe it never leaves this machine. Nothing here is in the
// event log, nothing goes over the wire, and the crew is never told a word of it.

export function useScribeSaid(): Said[] {
  const [said, setSaid] = useState<Said[]>([])

  useEffect(() => {
    let live = true
    void window.crew.scribeSaid().then(list => live && setSaid(list))
    const off = window.crew.onScribeSaid(setSaid)
    return () => {
      live = false
      off()
    }
  }, [])

  return said
}

// One row, or the lot. Main answers with the list it is left holding, and every
// window is told, so nothing here has to write the change down twice.
export function forgetSaid(id?: string): void {
  void window.crew.forgetScribeSaid(id)
}
