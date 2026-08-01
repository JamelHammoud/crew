import { describe, expect, it, vi } from 'vitest'
import {
  createRecordType,
  getStoreSnapshot,
  loadStoreSnapshot,
  reverseRecordsDiff,
  squashRecordDiffs,
  Store,
  StoreSchema,
  type BaseRecord,
  type HistoryEntry,
  type RecordId,
  type RecordsDiff
} from '../src/renderer/src/canvas/store'

interface Shape extends BaseRecord<'shape', RecordId<Shape>> {
  x: number
}
interface Camera extends BaseRecord<'camera', RecordId<Camera>> {
  zoom: number
}
type Rec = Shape | Camera

const ShapeType = createRecordType<Shape>('shape', { scope: 'document' }).withDefaultProperties(() => ({ x: 0 }))
const CameraType = createRecordType<Camera>('camera', { scope: 'session' }).withDefaultProperties(() => ({ zoom: 1 }))

function makeStore() {
  return new Store<Rec>({ schema: StoreSchema.create<Rec>({ shape: ShapeType, camera: CameraType }) })
}

const shapeId = (n: string) => ShapeType.createId(n)

describe('probe: store diff algebra', () => {
  it('added over removed becomes updated', () => {
    const before = ShapeType.create({ id: shapeId('a'), x: 1 })
    const after = ShapeType.create({ id: shapeId('a'), x: 2 })
    const squashed = squashRecordDiffs<Rec>([
      { added: {}, updated: {}, removed: { [before.id]: before } } as RecordsDiff<Rec>,
      { added: { [after.id]: after }, updated: {}, removed: {} } as RecordsDiff<Rec>
    ])
    expect(squashed.removed).toEqual({})
    expect(squashed.added).toEqual({})
    expect(squashed.updated[after.id]).toEqual([before, after])
  })

  it('added over removed with the identical record cancels out', () => {
    const rec = ShapeType.create({ id: shapeId('a'), x: 1 })
    const squashed = squashRecordDiffs<Rec>([
      { added: {}, updated: {}, removed: { [rec.id]: rec } } as RecordsDiff<Rec>,
      { added: { [rec.id]: rec }, updated: {}, removed: {} } as RecordsDiff<Rec>
    ])
    expect(squashed.added).toEqual({})
    expect(squashed.removed).toEqual({})
    expect(squashed.updated).toEqual({})
  })

  it('removed over updated keeps the original from value', () => {
    const v1 = ShapeType.create({ id: shapeId('a'), x: 1 })
    const v2 = ShapeType.create({ id: shapeId('a'), x: 2 })
    const squashed = squashRecordDiffs<Rec>([
      { added: {}, updated: { [v1.id]: [v1, v2] }, removed: {} } as RecordsDiff<Rec>,
      { added: {}, updated: {}, removed: { [v2.id]: v2 } } as RecordsDiff<Rec>
    ])
    expect(squashed.updated).toEqual({})
    expect(squashed.removed[v1.id]).toEqual(v1)
  })

  it('removed over added drops the record entirely', () => {
    const rec = ShapeType.create({ id: shapeId('a'), x: 1 })
    const squashed = squashRecordDiffs<Rec>([
      { added: { [rec.id]: rec }, updated: {}, removed: {} } as RecordsDiff<Rec>,
      { added: {}, updated: {}, removed: { [rec.id]: rec } } as RecordsDiff<Rec>
    ])
    expect(squashed.added).toEqual({})
    expect(squashed.removed).toEqual({})
    expect(squashed.updated).toEqual({})
  })

  it('updated over added stays added with the latest value', () => {
    const v1 = ShapeType.create({ id: shapeId('a'), x: 1 })
    const v2 = ShapeType.create({ id: shapeId('a'), x: 2 })
    const squashed = squashRecordDiffs<Rec>([
      { added: { [v1.id]: v1 }, updated: {}, removed: {} } as RecordsDiff<Rec>,
      { added: {}, updated: { [v1.id]: [v1, v2] }, removed: {} } as RecordsDiff<Rec>
    ])
    expect(squashed.added[v1.id]).toEqual(v2)
    expect(squashed.updated).toEqual({})
  })

  it('updated over updated keeps the first from and the last to', () => {
    const v1 = ShapeType.create({ id: shapeId('a'), x: 1 })
    const v2 = ShapeType.create({ id: shapeId('a'), x: 2 })
    const v3 = ShapeType.create({ id: shapeId('a'), x: 3 })
    const squashed = squashRecordDiffs<Rec>([
      { added: {}, updated: { [v1.id]: [v1, v2] }, removed: {} } as RecordsDiff<Rec>,
      { added: {}, updated: { [v1.id]: [v2, v3] }, removed: {} } as RecordsDiff<Rec>
    ])
    expect(squashed.updated[v1.id]).toEqual([v1, v3])
  })

  it('does not mutate the source diffs it squashes', () => {
    const v1 = ShapeType.create({ id: shapeId('a'), x: 1 })
    const v2 = ShapeType.create({ id: shapeId('a'), x: 2 })
    const v3 = ShapeType.create({ id: shapeId('a'), x: 3 })
    const first = { added: {}, updated: { [v1.id]: [v1, v2] }, removed: {} } as unknown as RecordsDiff<Rec>
    const second = { added: {}, updated: { [v1.id]: [v2, v3] }, removed: {} } as unknown as RecordsDiff<Rec>
    squashRecordDiffs<Rec>([first, second])
    expect(first.updated[v1.id]).toEqual([v1, v2])
    expect(second.updated[v1.id]).toEqual([v2, v3])
  })

  it('reverses a diff', () => {
    const v1 = ShapeType.create({ id: shapeId('a'), x: 1 })
    const v2 = ShapeType.create({ id: shapeId('a'), x: 2 })
    const added = ShapeType.create({ id: shapeId('b'), x: 0 })
    const removed = ShapeType.create({ id: shapeId('c'), x: 0 })
    const diff = {
      added: { [added.id]: added },
      updated: { [v1.id]: [v1, v2] },
      removed: { [removed.id]: removed }
    } as unknown as RecordsDiff<Rec>
    const reversed = reverseRecordsDiff(diff)
    expect(reversed.added).toEqual({ [removed.id]: removed })
    expect(reversed.removed).toEqual({ [added.id]: added })
    expect(reversed.updated[v1.id]).toEqual([v2, v1])
  })
})

describe('probe: store sources and scopes', () => {
  it('stamps a remote merge as remote and a local edit as user', async () => {
    const store = makeStore()
    const seen: HistoryEntry<Rec>[] = []
    store.listen(entry => seen.push(entry))
    store.put([ShapeType.create({ id: shapeId('a'), x: 1 })])
    store.flushHistory()
    store.mergeRemoteChanges(() => {
      store.put([ShapeType.create({ id: shapeId('b'), x: 2 })])
    })
    store.flushHistory()
    expect(seen.map(e => e.source)).toEqual(['user', 'remote'])
  })

  it('reports the source to a history interceptor', () => {
    const store = makeStore()
    const sources: string[] = []
    store.addHistoryInterceptor((_entry, source) => sources.push(source))
    store.put([ShapeType.create({ id: shapeId('a'), x: 1 })])
    store.mergeRemoteChanges(() => {
      store.put([ShapeType.create({ id: shapeId('b'), x: 2 })])
    })
    expect(sources).toEqual(['user', 'remote'])
  })

  it('filters listeners by source', () => {
    const store = makeStore()
    const remoteOnly: HistoryEntry<Rec>[] = []
    store.listen(entry => remoteOnly.push(entry), { source: 'remote' })
    store.put([ShapeType.create({ id: shapeId('a'), x: 1 })])
    store.flushHistory()
    expect(remoteOnly).toHaveLength(0)
    store.mergeRemoteChanges(() => {
      store.put([ShapeType.create({ id: shapeId('b'), x: 2 })])
    })
    store.flushHistory()
    expect(remoteOnly).toHaveLength(1)
  })

  it('filters listeners by scope', () => {
    const store = makeStore()
    const documentOnly: HistoryEntry<Rec>[] = []
    const sessionOnly: HistoryEntry<Rec>[] = []
    store.listen(entry => documentOnly.push(entry), { scope: 'document' })
    store.listen(entry => sessionOnly.push(entry), { scope: 'session' })
    store.put([CameraType.create({ id: CameraType.createId('c'), zoom: 2 })])
    store.flushHistory()
    expect(documentOnly).toHaveLength(0)
    expect(sessionOnly).toHaveLength(1)
    store.put([ShapeType.create({ id: shapeId('a'), x: 1 })])
    store.flushHistory()
    expect(documentOnly).toHaveLength(1)
    expect(sessionOnly).toHaveLength(1)
  })

  it('serializes only the asked for scope', () => {
    const store = makeStore()
    store.put([
      ShapeType.create({ id: shapeId('a'), x: 1 }),
      CameraType.create({ id: CameraType.createId('c'), zoom: 2 })
    ])
    expect(Object.keys(store.serialize('document'))).toHaveLength(1)
    expect(Object.keys(store.serialize('session'))).toHaveLength(1)
    expect(Object.keys(store.serialize('all'))).toHaveLength(2)
  })
})

describe('probe: side effects', () => {
  it('does not fire an after change effect for a structurally equal replacement', () => {
    const store = makeStore()
    store.put([ShapeType.create({ id: shapeId('a'), x: 1 })])
    const afterChange = vi.fn()
    store.sideEffects.registerAfterChangeHandler('shape', afterChange)
    const existing = store.get(shapeId('a'))!
    store.put([{ ...existing }])
    expect(afterChange).not.toHaveBeenCalled()
  })

  it('does fire an after change effect for a real change', () => {
    const store = makeStore()
    store.put([ShapeType.create({ id: shapeId('a'), x: 1 })])
    const afterChange = vi.fn()
    store.sideEffects.registerAfterChangeHandler('shape', afterChange)
    const existing = store.get(shapeId('a'))!
    store.put([{ ...existing, x: 9 }])
    expect(afterChange).toHaveBeenCalledTimes(1)
  })
})

describe('probe: snapshots', () => {
  it('round trips a snapshot', () => {
    const store = makeStore()
    store.put([
      ShapeType.create({ id: shapeId('a'), x: 1 }),
      ShapeType.create({ id: shapeId('b'), x: 2 }),
      CameraType.create({ id: CameraType.createId('c'), zoom: 3 })
    ])
    const snapshot = getStoreSnapshot(store, 'all')
    const next = makeStore()
    loadStoreSnapshot(next, snapshot)
    expect(getStoreSnapshot(next, 'all')).toEqual(snapshot)
    expect(JSON.stringify(getStoreSnapshot(next, 'all'))).toBe(JSON.stringify(snapshot))
  })

  it('loading a snapshot clears what was there before', () => {
    const store = makeStore()
    store.put([ShapeType.create({ id: shapeId('old'), x: 1 })])
    const other = makeStore()
    other.put([ShapeType.create({ id: shapeId('new'), x: 2 })])
    loadStoreSnapshot(store, getStoreSnapshot(other, 'all'))
    expect(store.get(shapeId('old'))).toBeUndefined()
    expect(store.get(shapeId('new'))).toBeDefined()
  })
})
