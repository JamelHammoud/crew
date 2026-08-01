import { atom, computed, transact, unsafe__withoutCapture, type Atom, type Computed } from '../signals'
import { hasAnyKey, squashRecordDiffs, type RecordsDiff } from './RecordsDiff'
import { HistoryAccumulator, type ChangeSource, type HistoryEntry } from './historyAccumulator'
import { SideEffectManager } from './SideEffectManager'
import type { IdOf, RecordScope, UnknownRecord } from './RecordType'
import type { RecordValidationPhase, StoreSchema } from './StoreSchema'
import { uniqueId } from './uniqueId'

export type { ChangeSource, HistoryEntry }

export interface StoreListenerFilters {
  source: ChangeSource | 'all'
  scope: RecordScope | 'all'
}

export type StoreListener<R extends UnknownRecord> = (entry: HistoryEntry<R>) => void

export type SerializedStore<R extends UnknownRecord> = Record<IdOf<R>, R>

export interface StoreConfig<R extends UnknownRecord> {
  schema: StoreSchema<R>
  initialData?: SerializedStore<R>
  id?: string
}

export class Store<R extends UnknownRecord> {
  readonly id: string
  readonly schema: StoreSchema<R>
  readonly sideEffects = new SideEffectManager<R>(this)
  readonly scopedTypes: { readonly [K in RecordScope]: ReadonlySet<string> }

  private readonly atoms = new Map<IdOf<R>, Atom<R | undefined>>()
  private readonly revision = atom('store.revision', 0)
  private readonly version = atom('store.version', 0)
  private readonly queries = new Map<string, Computed<R[]>>()
  private readonly listeners = new Set<{
    onHistory: StoreListener<R>
    filters: StoreListenerFilters
  }>()
  private readonly historyAccumulator = new HistoryAccumulator<R>()
  private cancelScheduledFlush: (() => void) | null = null

  constructor(config: StoreConfig<R>) {
    this.id = config.id ?? uniqueId()
    this.schema = config.schema
    this.scopedTypes = {
      document: scopedTypeNames(this.schema, 'document'),
      session: scopedTypeNames(this.schema, 'session'),
      presence: scopedTypeNames(this.schema, 'presence')
    }
    if (config.initialData) {
      for (const record of Object.values(config.initialData) as R[]) {
        const validated = this.schema.validateRecord(this, record, 'initialize', null)
        this.atoms.set(validated.id as IdOf<R>, atom(`store.record:${validated.id}`, validated))
      }
    }
  }

  get(id: IdOf<R>): R | undefined {
    const record = this.atoms.get(id)
    if (record) return record.get()
    this.version.get()
    return undefined
  }

  unsafeGetWithoutCapture(id: IdOf<R>): R | undefined {
    const record = this.atoms.get(id)
    if (!record) return undefined
    return unsafe__withoutCapture(() => record.get())
  }

  has(id: IdOf<R>): boolean {
    return this.get(id) !== undefined
  }

  getRevision(): number {
    return this.revision.get()
  }

  ids(): IdOf<R>[] {
    this.version.get()
    return Array.from(this.atoms.keys())
  }

  records(): R[] {
    this.version.get()
    const result: R[] = []
    for (const record of this.atoms.values()) {
      const value = record.get()
      if (value) result.push(value)
    }
    return result
  }

  allRecords(): R[] {
    return this.records()
  }

  query<T extends R['typeName']>(typeName: T): Computed<Extract<R, { typeName: T }>[]> {
    let query = this.queries.get(typeName)
    if (!query) {
      query = computed(`store.query:${typeName}`, () => this.records().filter(record => record.typeName === typeName))
      this.queries.set(typeName, query)
    }
    return query as Computed<Extract<R, { typeName: T }>[]>
  }

  put(records: R[], phaseOverride?: RecordValidationPhase): void {
    this.atomic(() => {
      const updates = {} as RecordsDiff<R>['updated']
      const additions = {} as RecordsDiff<R>['added']
      let didChange = false
      const source: ChangeSource = this.isMergingRemoteChanges ? 'remote' : 'user'

      for (let i = 0, n = records.length; i < n; i++) {
        let record = records[i]
        const initialValue = this.unsafeGetWithoutCapture(record.id as IdOf<R>)
        if (initialValue) {
          record = this.sideEffects.handleBeforeChange(initialValue, record, source)
          const validated = this.schema.validateRecord(this, record, phaseOverride ?? 'updateRecord', initialValue)
          if (validated === initialValue) continue
          record = validated
          this.setRecord(record)
          didChange = true
          updates[record.id as IdOf<R>] = [initialValue, record]
          this.addDiffForAfterEvent(initialValue, record)
        } else {
          record = this.sideEffects.handleBeforeCreate(record, source)
          record = this.schema.validateRecord(this, record, phaseOverride ?? 'createRecord', null)
          didChange = true
          additions[record.id as IdOf<R>] = record
          this.addDiffForAfterEvent(null, record)
          this.setRecord(record)
        }
      }

      if (!didChange) return
      this.updateHistory({ added: additions, updated: updates, removed: {} as RecordsDiff<R>['removed'] })
    })
  }

  remove(ids: IdOf<R>[]): void {
    this.atomic(() => {
      const toDelete = new Set(ids)
      const source: ChangeSource = this.isMergingRemoteChanges ? 'remote' : 'user'

      if (this.sideEffects.isEnabled()) {
        for (const id of ids) {
          const record = this.unsafeGetWithoutCapture(id)
          if (!record) continue
          if (this.sideEffects.handleBeforeDelete(record, source) === false) toDelete.delete(id)
        }
      }

      const removed = {} as RecordsDiff<R>['removed']
      let didChange = false
      for (const id of toDelete) {
        const record = this.deleteRecord(id)
        if (!record) continue
        didChange = true
        removed[id] = record
        this.addDiffForAfterEvent(record, null)
      }

      if (!didChange) return
      this.updateHistory({
        added: {} as RecordsDiff<R>['added'],
        updated: {} as RecordsDiff<R>['updated'],
        removed
      })
    })
  }

  update(id: IdOf<R>, updater: (record: R) => R): void {
    const existing = this.unsafeGetWithoutCapture(id)
    if (!existing) return
    this.put([updater(existing)])
  }

  clear(): void {
    this.remove(Array.from(this.atoms.keys()))
  }

  serialize(scope: RecordScope | 'all' = 'document'): SerializedStore<R> {
    const result = {} as SerializedStore<R>
    for (const record of this.records()) {
      if (scope === 'all' || this.scopedTypes[scope].has(record.typeName)) {
        result[record.id as IdOf<R>] = record
      }
    }
    return result
  }

  applyDiff(diff: RecordsDiff<R>, options?: { runCallbacks?: boolean; ignoreEphemeralKeys?: boolean }): void {
    const runCallbacks = options?.runCallbacks ?? true
    const ignoreEphemeralKeys = options?.ignoreEphemeralKeys ?? false
    this.atomic(() => {
      const toPut = Object.values(diff.added) as R[]
      for (const [, to] of Object.values(diff.updated) as [R, R][]) {
        const type = this.schema.getType(to.typeName)
        if (ignoreEphemeralKeys && type.ephemeralKeySet.size) {
          const existing = this.get(to.id as IdOf<R>)
          if (!existing) {
            toPut.push(to)
            continue
          }
          let changed: Record<string, unknown> | null = null
          for (const [key, value] of Object.entries(to)) {
            if (type.ephemeralKeySet.has(key) || Object.is(value, (existing as Record<string, unknown>)[key])) {
              continue
            }
            changed ??= { ...(existing as Record<string, unknown>) }
            changed[key] = value
          }
          if (changed) toPut.push(changed as unknown as R)
        } else {
          toPut.push(to)
        }
      }
      const toRemove = Object.keys(diff.removed) as IdOf<R>[]
      if (toPut.length) this.put(toPut)
      if (toRemove.length) this.remove(toRemove)
    }, runCallbacks)
  }

  listen(onHistory: StoreListener<R>, filters?: Partial<StoreListenerFilters>): () => void {
    this.flushHistory()
    const listener = {
      onHistory,
      filters: {
        source: filters?.source ?? 'all',
        scope: filters?.scope ?? 'all'
      } as StoreListenerFilters
    }
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  addHistoryInterceptor(fn: (entry: HistoryEntry<R>, source: ChangeSource) => void): () => void {
    return this.historyAccumulator.addInterceptor(entry => fn(entry, this.isMergingRemoteChanges ? 'remote' : 'user'))
  }

  extractingChanges(fn: () => void): RecordsDiff<R> {
    const changes: RecordsDiff<R>[] = []
    const dispose = this.historyAccumulator.addInterceptor(entry => changes.push(entry.changes))
    try {
      transact(fn)
      return squashRecordDiffs(changes)
    } finally {
      dispose()
    }
  }

  mergeRemoteChanges(fn: () => void): void {
    if (this.isMergingRemoteChanges) {
      fn()
      return
    }
    if (this.isInAtomicOp) {
      throw new Error('Cannot merge remote changes while in atomic operation')
    }
    this.atomic(fn, true, true)
  }

  atomic<T>(fn: () => T, runCallbacks = true, isMergingRemoteChanges = false): T {
    return transact(() => {
      if (this.isInAtomicOp) {
        if (!this.pendingAfterEvents) this.pendingAfterEvents = new Map()
        if (isMergingRemoteChanges) {
          throw new Error('Cannot merge remote changes while in atomic operation')
        }
        const wasEnabled = this.sideEffects.isEnabled()
        try {
          if (wasEnabled && !runCallbacks) this.sideEffects.setIsEnabled(false)
          return fn()
        } finally {
          this.sideEffects.setIsEnabled(wasEnabled)
        }
      }

      this.pendingAfterEvents = new Map()
      const wasEnabled = this.sideEffects.isEnabled()
      this.sideEffects.setIsEnabled(runCallbacks && wasEnabled)
      this.isInAtomicOp = true
      if (isMergingRemoteChanges) this.isMergingRemoteChanges = true

      try {
        const result = fn()
        this.isMergingRemoteChanges = false
        this.flushAtomicCallbacks(isMergingRemoteChanges)
        return result
      } finally {
        this.pendingAfterEvents = null
        this.sideEffects.setIsEnabled(wasEnabled)
        this.isInAtomicOp = false
        this.isMergingRemoteChanges = false
      }
    })
  }

  flushHistory(): void {
    if (this.cancelScheduledFlush) {
      this.cancelScheduledFlush()
      this.cancelScheduledFlush = null
    }
    if (!this.historyAccumulator.hasChanges()) return
    for (const { changes, source } of this.historyAccumulator.flush()) {
      let documentChanges: RecordsDiff<R> | null | undefined
      let sessionChanges: RecordsDiff<R> | null | undefined
      let presenceChanges: RecordsDiff<R> | null | undefined
      for (const { onHistory, filters } of this.listeners) {
        if (filters.source !== 'all' && filters.source !== source) continue
        if (filters.scope === 'all') {
          onHistory({ changes, source })
          continue
        }
        if (filters.scope === 'document') {
          documentChanges ??= this.filterChangesByScope(changes, 'document')
          if (documentChanges) onHistory({ changes: documentChanges, source })
        } else if (filters.scope === 'session') {
          sessionChanges ??= this.filterChangesByScope(changes, 'session')
          if (sessionChanges) onHistory({ changes: sessionChanges, source })
        } else {
          presenceChanges ??= this.filterChangesByScope(changes, 'presence')
          if (presenceChanges) onHistory({ changes: presenceChanges, source })
        }
      }
    }
  }

  dispose(): void {
    this.cancelScheduledFlush?.()
    this.cancelScheduledFlush = null
    this.listeners.clear()
  }

  private isMergingRemoteChanges = false
  private isInAtomicOp = false
  private pendingAfterEvents: Map<IdOf<R>, { before: R | null; after: R | null }> | null = null

  private setRecord(record: R): void {
    const existing = this.atoms.get(record.id as IdOf<R>)
    if (existing) {
      existing.set(record)
      this.revision.update(value => value + 1)
      return
    }
    this.atoms.set(record.id as IdOf<R>, atom(`store.record:${record.id}`, record))
    this.version.update(v => v + 1)
    this.revision.update(value => value + 1)
  }

  private deleteRecord(id: IdOf<R>): R | undefined {
    const existing = this.atoms.get(id)
    if (!existing) return undefined
    const record = unsafe__withoutCapture(() => existing.get())
    this.atoms.delete(id)
    existing.set(undefined)
    this.version.update(v => v + 1)
    this.revision.update(value => value + 1)
    return record
  }

  private filterChangesByScope(changes: RecordsDiff<R>, scope: RecordScope): RecordsDiff<R> | null {
    const types = this.scopedTypes[scope]
    const result = {
      added: filterEntries(changes.added, record => types.has(record.typeName)),
      updated: filterEntries(changes.updated, ([, to]) => types.has(to.typeName)),
      removed: filterEntries(changes.removed, record => types.has(record.typeName))
    } as RecordsDiff<R>
    if (!hasAnyKey(result.added) && !hasAnyKey(result.updated) && !hasAnyKey(result.removed)) {
      return null
    }
    return result
  }

  private updateHistory(changes: RecordsDiff<R>): void {
    this.historyAccumulator.add({
      changes,
      source: this.isMergingRemoteChanges ? 'remote' : 'user'
    })
    if (this.listeners.size === 0) {
      this.historyAccumulator.clear()
      return
    }
    if (!this.cancelScheduledFlush) {
      this.cancelScheduledFlush = nextFrame(() => {
        this.cancelScheduledFlush = null
        this.flushHistory()
      })
    }
  }

  private addDiffForAfterEvent(before: R | null, after: R | null): void {
    if (!this.pendingAfterEvents) throw new Error('must be in an atomic operation')
    if (before === after) return
    if (!before && !after) return
    const id = (before ?? after)!.id as IdOf<R>
    const existing = this.pendingAfterEvents.get(id)
    if (existing) existing.after = after
    else this.pendingAfterEvents.set(id, { before, after })
  }

  private flushAtomicCallbacks(isMergingRemoteChanges: boolean): void {
    let depth = 0
    let source: ChangeSource = isMergingRemoteChanges ? 'remote' : 'user'
    while (this.pendingAfterEvents) {
      const events = this.pendingAfterEvents
      this.pendingAfterEvents = null
      if (!this.sideEffects.isEnabled()) continue
      depth++
      if (depth > 100) throw new Error('Maximum store update depth exceeded, bailing out')
      for (const { before, after } of events.values()) {
        if (before && after && before !== after) {
          this.sideEffects.handleAfterChange(before, after, source)
        } else if (before && !after) {
          this.sideEffects.handleAfterDelete(before, source)
        } else if (!before && after) {
          this.sideEffects.handleAfterCreate(after, source)
        }
      }
      if (!this.pendingAfterEvents) this.sideEffects.handleOperationComplete(source)
      else source = 'user'
    }
  }
}

function scopedTypeNames<R extends UnknownRecord>(schema: StoreSchema<R>, scope: RecordScope): ReadonlySet<string> {
  const names = new Set<string>()
  for (const [typeName, type] of Object.entries(schema.types)) {
    if ((type as { scope: RecordScope }).scope === scope) names.add(typeName)
  }
  return names
}

function filterEntries<T>(entries: Record<string, T>, keep: (value: T) => boolean): Record<string, T> {
  const result: Record<string, T> = {}
  for (const key in entries) {
    if (keep(entries[key])) result[key] = entries[key]
  }
  return result
}

function nextFrame(fn: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(() => fn())
    return () => cancelAnimationFrame(handle)
  }
  const handle = setTimeout(fn, 0)
  return () => clearTimeout(handle)
}
