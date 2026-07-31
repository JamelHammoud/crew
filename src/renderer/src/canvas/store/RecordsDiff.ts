import type { IdOf, UnknownRecord } from './RecordType'

export interface RecordsDiff<R extends UnknownRecord> {
  added: Record<IdOf<R>, R>
  updated: Record<IdOf<R>, [from: R, to: R]>
  removed: Record<IdOf<R>, R>
}

export function createEmptyRecordsDiff<R extends UnknownRecord>(): RecordsDiff<R> {
  return { added: {}, updated: {}, removed: {} } as RecordsDiff<R>
}

export function hasAnyKey(obj: object): boolean {
  for (const _ in obj) return true
  return false
}

export function isRecordsDiffEmpty<R extends UnknownRecord>(diff: RecordsDiff<R>): boolean {
  return !hasAnyKey(diff.added) && !hasAnyKey(diff.updated) && !hasAnyKey(diff.removed)
}

export function reverseRecordsDiff<R extends UnknownRecord>(diff: RecordsDiff<R>): RecordsDiff<R> {
  const result: RecordsDiff<R> = { added: diff.removed, removed: diff.added, updated: {} } as RecordsDiff<R>
  for (const [from, to] of Object.values(diff.updated) as [R, R][]) {
    result.updated[from.id as IdOf<R>] = [to, from]
  }
  return result
}

export function squashRecordDiffs<R extends UnknownRecord>(
  diffs: RecordsDiff<R>[],
  options?: { mutateFirstDiff?: boolean }
): RecordsDiff<R> {
  const result = options?.mutateFirstDiff ? diffs[0] : createEmptyRecordsDiff<R>()
  squashRecordDiffsMutable(result, options?.mutateFirstDiff ? diffs.slice(1) : diffs)
  return result
}

export function squashRecordDiffsMutable<R extends UnknownRecord>(
  target: RecordsDiff<R>,
  diffs: RecordsDiff<R>[]
): void {
  for (const diff of diffs) {
    const targetHasRemoved = hasAnyKey(target.removed)

    for (const _id in diff.added) {
      const id = _id as IdOf<R>
      const value = diff.added[id]
      if (targetHasRemoved && target.removed[id]) {
        const original = target.removed[id]
        delete target.removed[id]
        if (original !== value) {
          target.updated[id] = [original, value]
        }
      } else {
        target.added[id] = value
      }
    }

    const targetHasAdded = hasAnyKey(target.added)

    for (const _id in diff.updated) {
      const id = _id as IdOf<R>
      const to = diff.updated[id][1]
      if (targetHasAdded && target.added[id]) {
        target.added[id] = to
        delete target.updated[id]
        if (targetHasRemoved) delete target.removed[id]
        continue
      }
      const existing = target.updated[id]
      if (existing) {
        existing[1] = to
        if (targetHasRemoved) delete target.removed[id]
        continue
      }
      target.updated[id] = [diff.updated[id][0], to]
      if (targetHasRemoved) delete target.removed[id]
    }

    for (const _id in diff.removed) {
      const id = _id as IdOf<R>
      if (target.added[id]) {
        delete target.added[id]
      } else if (target.updated[id]) {
        target.removed[id] = target.updated[id][0]
        delete target.updated[id]
      } else {
        target.removed[id] = diff.removed[id]
      }
    }
  }
}
