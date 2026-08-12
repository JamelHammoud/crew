import { useSyncExternalStore } from 'react'
import { NO_UPDATE, type UpdateState, type UpdateWhy } from '../../../shared/update'
import { toast } from './toast'

const listeners = new Set<() => void>()
let state: UpdateState = NO_UPDATE
let watching = false

function say(why: UpdateWhy): void {
  // An update that did not happen is a moment rather than a record: the pill is
  // still standing there offering it again.
  // Several windows on one folder are one Crew, so closing windows does nothing
  // about this. What holds an update is another Crew open on another project.
  if (why === 'others') {
    toast('Quit your other Crews to update', { key: 'update' })
    return
  }
  const word = why === 'install' ? 'Crew did not update' : 'The update did not arrive'
  toast.fail(word, { key: 'update' })
}

function put(next: UpdateState): void {
  const told = next.why && next.told !== state.told
  state = next
  for (const listener of listeners) listener()
  if (told) say(next.why)
}

export function watchUpdates(): () => void {
  if (watching) return () => {}
  watching = true
  const stop = window.crew?.onUpdate(put)
  void window.crew?.updateState().then(put)
  return () => {
    watching = false
    stop?.()
  }
}

export function pressUpdate(): void {
  void window.crew?.pressUpdate()
}

export function useUpdate(): UpdateState {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state
  )
}
