import { squashRecordDiffs, type RecordsDiff } from './RecordsDiff'
import type { UnknownRecord } from './RecordType'

export type ChangeSource = 'user' | 'remote'

export interface HistoryEntry<R extends UnknownRecord> {
  changes: RecordsDiff<R>
  source: ChangeSource
}

export class HistoryAccumulator<R extends UnknownRecord> {
  private history: HistoryEntry<R>[] = []
  private interceptors = new Set<(entry: HistoryEntry<R>) => void>()

  addInterceptor(fn: (entry: HistoryEntry<R>) => void): () => void {
    this.interceptors.add(fn)
    return () => {
      this.interceptors.delete(fn)
    }
  }

  add(entry: HistoryEntry<R>): void {
    this.history.push(entry)
    for (const interceptor of this.interceptors) interceptor(entry)
  }

  flush(): HistoryEntry<R>[] {
    const history = squashHistoryEntries(this.history)
    this.history = []
    return history
  }

  clear(): void {
    this.history = []
  }

  hasChanges(): boolean {
    return this.history.length > 0
  }
}

function squashHistoryEntries<R extends UnknownRecord>(entries: HistoryEntry<R>[]): HistoryEntry<R>[] {
  if (entries.length === 0) return []
  const chunked: HistoryEntry<R>[][] = []
  let chunk: HistoryEntry<R>[] = [entries[0]]
  for (let i = 1, n = entries.length; i < n; i++) {
    const entry = entries[i]
    if (chunk[0].source !== entry.source) {
      chunked.push(chunk)
      chunk = []
    }
    chunk.push(entry)
  }
  chunked.push(chunk)
  return chunked.map(chunk => ({
    source: chunk[0].source,
    changes: chunk.length === 1 ? chunk[0].changes : squashRecordDiffs(chunk.map(e => e.changes))
  }))
}
