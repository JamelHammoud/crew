import { useSyncExternalStore } from 'react'
import { NO_UPDATE, type UpdateState } from '../../../shared/update'
import { toast } from './toast'

const listeners = new Set<() => void>()
let state: UpdateState = NO_UPDATE
let watching = false

function put(next: UpdateState): void {
  // A download that was asked for and did not arrive is a moment rather than a
  // record: the pill is still standing there offering it again.
  if (next.stage === 'failed' && state.stage !== 'failed') {
    toast.fail('The update did not arrive', { key: 'update' })
  }
  state = next
  for (const listener of listeners) listener()
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
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, () => state)
}
