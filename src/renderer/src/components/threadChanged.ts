import type { SessionEvent } from '../../../shared/events'
import type { AgentStep } from '../../../shared/llm'
import type { ThreadMeta } from '../state/store'
import { eventIndex } from './eventIndex'

export interface Changed {
  added: number
  removed: number
}

export const NOTHING: Changed = { added: 0, removed: 0 }

const perRun = new WeakMap<AgentStep[], Changed>()

// What one run has changed. A step landing replaces that run's own array and
// leaves every other array where it was, so a feed of cards counts the one run
// that moved and reads the rest back off the cache.
export function runChanged(steps: AgentStep[]): Changed {
  const known = perRun.get(steps)
  if (known) return known
  let added = 0
  let removed = 0
  for (const step of steps) {
    for (const file of step.files ?? []) {
      added += file.added
      removed += file.removed
    }
  }
  const counted = added || removed ? { added, removed } : NOTHING
  perRun.set(steps, counted)
  return counted
}

// What each of the named threads has changed, the helpers it sent out included:
// a helper's edits are the thread's edits, the same reason a thread with
// helpers still out is not ready for review. The children are gathered once for
// the whole feed rather than the thread list being walked again for every card.
export function changedIn(
  ids: string[],
  events: SessionEvent[],
  steps: Record<string, AgentStep[]>,
  threads: Record<string, Pick<ThreadMeta, 'id' | 'parentThreadId'>>
): Map<string, Changed> {
  const { runsByThread } = eventIndex(events)
  const children = new Map<string, string[]>()
  for (const thread of Object.values(threads)) {
    if (!thread.parentThreadId) continue
    const held = children.get(thread.parentThreadId)
    if (held) held.push(thread.id)
    else children.set(thread.parentThreadId, [thread.id])
  }

  const out = new Map<string, Changed>()
  for (const id of ids) {
    let added = 0
    let removed = 0
    // A parent named in a circle settles rather than locking the window, which
    // is the rule `threadFamily` already holds.
    const walk = [id]
    const seen = new Set(walk)
    for (let at = 0; at < walk.length; at++) {
      for (const promptId of runsByThread.get(walk[at]) ?? []) {
        const run = steps[promptId]
        if (!run) continue
        const counted = runChanged(run)
        added += counted.added
        removed += counted.removed
      }
      for (const child of children.get(walk[at]) ?? []) {
        if (seen.has(child)) continue
        seen.add(child)
        walk.push(child)
      }
    }
    out.set(id, added || removed ? { added, removed } : NOTHING)
  }
  return out
}
