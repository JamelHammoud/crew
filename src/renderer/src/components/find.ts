import { useSyncExternalStore } from 'react'
import type { ThreadItem } from './thread'

let query = ''
const listeners = new Set<() => void>()

// Published from the find bar's own event handler rather than from an effect,
// so a row that has to open to be found opens in the same commit the query
// lands in, before the bar walks the page for matches.
export function setFindQuery(next: string): void {
  if (next === query) return
  query = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useFindQuery = (): string => useSyncExternalStore(subscribe, () => query)

export function carries(query: string, text: Array<string | undefined>): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  return text.some(one => one !== undefined && one.toLowerCase().includes(needle))
}

const diffs = (item: ThreadItem): string[] => (item.files ?? []).map(file => file.diff ?? '')

// Everything a step is carrying. A folded run of reads draws none of it, so
// this is what decides whether the run opens.
export function stepText(item: ThreadItem): string[] {
  if (item.kind === 'thinking') return [item.text]
  return [item.detail, item.output, ...(item.files ?? []).map(file => file.path), ...diffs(item)]
}

// The part of it that is not on screen while the step is closed. A search that
// reads only what is drawn never reaches a thought, a diff, or the line a
// command printed, which is most of what a thread is made of.
export function stepHidden(item: ThreadItem): string[] {
  if (item.kind === 'thinking') return [item.text]
  const files = item.files ?? []
  if (files.length === 0) return [item.detail, item.output]
  const paths = files.length === 1 ? [] : files.map(file => file.path)
  return [...paths, ...diffs(item)]
}
