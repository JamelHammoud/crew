import { describe, expect, it, vi } from 'vitest'
import {
  createEmptyRecordsDiff,
  createRecordType,
  getStoreSnapshot,
  HistoryManager,
  isRecordsDiffEmpty,
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
  y: number
  parentId: string | null
}

interface Camera extends BaseRecord<'camera', RecordId<Camera>> {
  zoom: number
}

interface Cursor extends BaseRecord<'cursor', RecordId<Cursor>> {
  x: number
}

type Rec = Shape | Camera | Cursor

const ShapeType = createRecordType<Shape>('shape', { scope: 'document' }).withDefaultProperties(() => ({
  x: 0,
  y: 0,
  parentId: null
}))
const CameraType = createRecordType<Camera>('camera', { scope: 'session' }).withDefaultProperties(() => ({ zoom: 1 }))
const CursorType = createRecordType<Cursor>('cursor', { scope: 'presence' }).withDefaultProperties(() => ({ x: 0 }))

function makeSchema() {
  return StoreSchema.create<Rec>(
    { shape: ShapeType, camera: CameraType, cursor: CursorType },
    { sequences: { 'com.crew.shape': 2, 'com.crew.camera': 1, 'com.crew.cursor': 1 } }
  )
}

function makeStore(initialData?: Record<string, Rec>) {
  return new Store<Rec>({ schema: makeSchema(), initialData, id: 'test' })
}

function shape(id: string, props: Partial<Shape> = {}): Shape {
  return ShapeType.create({ id: ShapeType.createId(id), x: 0, y: 0, parentId: null, ...props })
}

function diffOf(parts: Partial<RecordsDiff<Rec>>): RecordsDiff<Rec> {
  return { ...createEmptyRecordsDiff<Rec>(), ...parts }
}

function tick() {
  return new Promise(resolve => setTimeout(resolve, 5))
}

describe('the diff algebra', () => {
  it('squashes an update over an add into the add', () => {
    const a = shape('a')
    const b = { ...a, x: 1 }
    const c = { ...a, x: 2 }
    const squashed = squashRecordDiffs<Rec>([diffOf({ added: { [a.id]: a } }), diffOf({ updated: { [a.id]: [b, c] } })])
    expect(squashed.added[a.id]).toBe(c)
    expect(squashed.updated[a.id]).toBeUndefined()
  })

  it('keeps the first from and the last to across two updates', () => {
    const a = shape('a')
    const b = { ...a, x: 1 }
    const c = { ...a, x: 2 }
    const squashed = squashRecordDiffs<Rec>([
      diffOf({ updated: { [a.id]: [a, b] } }),
      diffOf({ updated: { [a.id]: [b, c] } })
    ])
    expect(squashed.updated[a.id]).toEqual([a, c])
  })

  it('turns an add landing over a remove into an update', () => {
    const a = shape('a')
    const b = { ...a, x: 1 }
    const squashed = squashRecordDiffs<Rec>([diffOf({ removed: { [a.id]: a } }), diffOf({ added: { [a.id]: b } })])
    expect(squashed.updated[a.id]).toEqual([a, b])
    expect(squashed.added[a.id]).toBeUndefined()
    expect(squashed.removed[a.id]).toBeUndefined()
  })

  it('drops an add over a remove of the very same record', () => {
    const a = shape('a')
    const squashed = squashRecordDiffs<Rec>([diffOf({ removed: { [a.id]: a } }), diffOf({ added: { [a.id]: a } })])
    expect(isRecordsDiffEmpty(squashed)).toBe(true)
  })

  it('keeps the original from when a remove lands over an update', () => {
    const a = shape('a')
    const b = { ...a, x: 1 }
    const squashed = squashRecordDiffs<Rec>([
      diffOf({ updated: { [a.id]: [a, b] } }),
      diffOf({ removed: { [a.id]: b } })
    ])
    expect(squashed.removed[a.id]).toBe(a)
    expect(squashed.updated[a.id]).toBeUndefined()
  })

  it('cancels an add followed by a remove', () => {
    const a = shape('a')
    const squashed = squashRecordDiffs<Rec>([diffOf({ added: { [a.id]: a } }), diffOf({ removed: { [a.id]: a } })])
    expect(isRecordsDiffEmpty(squashed)).toBe(true)
  })

  it('reverses a diff and comes back to where it started', () => {
    const a = shape('a')
    const b = shape('b')
    const c = shape('c')
    const c2 = { ...c, x: 9 }
    const diff = diffOf({
      added: { [a.id]: a },
      updated: { [c.id]: [c, c2] },
      removed: { [b.id]: b }
    })
    const reversed = reverseRecordsDiff(diff)
    expect(reversed.removed[a.id]).toBe(a)
    expect(reversed.added[b.id]).toBe(b)
    expect(reversed.updated[c.id]).toEqual([c2, c])
    expect(reverseRecordsDiff(reversed)).toEqual(diff)
  })
})

describe('the store', () => {
  it('puts, gets, updates and removes', () => {
    const store = makeStore()
    const a = shape('a')
    store.put([a])
    expect(store.get(a.id)).toBe(a)
    expect(store.has(a.id)).toBe(true)
    store.update(a.id, record => ({ ...record, x: 5 }))
    expect((store.get(a.id) as Shape).x).toBe(5)
    store.remove([a.id])
    expect(store.get(a.id)).toBeUndefined()
    expect(store.has(a.id)).toBe(false)
    expect(store.ids()).toEqual([])
  })

  it('answers a query over one type name', () => {
    const store = makeStore()
    const a = shape('a')
    store.put([a, CameraType.create({ id: CameraType.createId('one') })])
    const shapes = store.query('shape')
    expect(shapes.get().map(record => record.id)).toEqual([a.id])
    store.put([shape('b')])
    expect(shapes.get()).toHaveLength(2)
    store.remove([a.id])
    expect(shapes.get()).toHaveLength(1)
  })

  it('reports the changes made inside extractingChanges', () => {
    const store = makeStore()
    const a = shape('a')
    store.put([a])
    const changes = store.extractingChanges(() => {
      store.put([{ ...a, x: 4 }])
      store.put([shape('b')])
    })
    expect(Object.keys(changes.updated)).toEqual([a.id])
    expect(Object.keys(changes.added)).toHaveLength(1)
  })

  it('filters what a listener hears by scope', async () => {
    const store = makeStore()
    const heard: HistoryEntry<Rec>[] = []
    store.listen(entry => heard.push(entry), { scope: 'document' })
    store.put([CameraType.create({ id: CameraType.createId('one') })])
    store.put([CursorType.create({ id: CursorType.createId('one') })])
    await tick()
    expect(heard).toHaveLength(0)
    store.put([shape('a')])
    await tick()
    expect(heard).toHaveLength(1)
    expect(Object.keys(heard[0].changes.added)).toHaveLength(1)
  })

  it('filters what a listener hears by source', async () => {
    const store = makeStore()
    const user: HistoryEntry<Rec>[] = []
    const remote: HistoryEntry<Rec>[] = []
    store.listen(entry => user.push(entry), { source: 'user' })
    store.listen(entry => remote.push(entry), { source: 'remote' })
    store.put([shape('a')])
    await tick()
    expect(user).toHaveLength(1)
    expect(remote).toHaveLength(0)
    store.mergeRemoteChanges(() => store.put([shape('b')]))
    await tick()
    expect(user).toHaveLength(1)
    expect(remote).toHaveLength(1)
  })

  it('stamps a change made inside mergeRemoteChanges as remote', async () => {
    const store = makeStore()
    const heard: HistoryEntry<Rec>[] = []
    store.listen(entry => heard.push(entry))
    store.mergeRemoteChanges(() => {
      store.put([shape('a')])
      store.put([shape('b')])
    })
    await tick()
    expect(heard).toHaveLength(1)
    expect(heard[0].source).toBe('remote')
    expect(Object.keys(heard[0].changes.added)).toHaveLength(2)
  })

  it('squashes what a listener hears into one entry a frame', async () => {
    const store = makeStore()
    const heard: HistoryEntry<Rec>[] = []
    store.listen(entry => heard.push(entry))
    const a = shape('a')
    store.put([a])
    store.put([{ ...a, x: 1 }])
    store.put([{ ...a, x: 2 }])
    await tick()
    expect(heard).toHaveLength(1)
    expect((heard[0].changes.added[a.id] as Shape).x).toBe(2)
    expect(heard[0].changes.updated[a.id]).toBeUndefined()
  })
})

describe('a snapshot', () => {
  it('comes back byte identical', () => {
    const store = makeStore()
    store.put([
      shape('a', { x: 1 }),
      shape('b', { x: 2, parentId: 'shape:a' }),
      CameraType.create({ id: CameraType.createId('one'), zoom: 3 })
    ])
    const snapshot = getStoreSnapshot(store)
    expect(Object.keys(snapshot.store)).toEqual(['shape:a', 'shape:b'])
    expect(snapshot.schema).toEqual({
      schemaVersion: 2,
      sequences: { 'com.crew.shape': 2, 'com.crew.camera': 1, 'com.crew.cursor': 1 }
    })

    const next = makeStore()
    loadStoreSnapshot(next, snapshot)
    expect(JSON.stringify(getStoreSnapshot(next))).toBe(JSON.stringify(snapshot))

    loadStoreSnapshot(store, snapshot)
    expect(JSON.stringify(getStoreSnapshot(store))).toBe(JSON.stringify(snapshot))
  })

  it('takes the records a scope holds and no others', () => {
    const store = makeStore()
    store.put([
      shape('a'),
      CameraType.create({ id: CameraType.createId('one') }),
      CursorType.create({ id: CursorType.createId('one') })
    ])
    expect(Object.keys(getStoreSnapshot(store, 'session').store)).toEqual(['camera:one'])
    expect(Object.keys(getStoreSnapshot(store, 'presence').store)).toEqual(['cursor:one'])
    expect(Object.keys(getStoreSnapshot(store, 'all').store)).toHaveLength(3)
  })
})

describe('side effects', () => {
  it('lets a before handler rewrite the record that lands', () => {
    const store = makeStore()
    store.sideEffects.registerBeforeCreateHandler('shape', record => ({ ...record, x: 100 }))
    store.sideEffects.registerBeforeChangeHandler('shape', (_prev, next) => ({ ...next, y: 50 }))
    const a = shape('a')
    store.put([a])
    expect((store.get(a.id) as Shape).x).toBe(100)
    store.put([{ ...a, x: 3, y: 3 }])
    expect((store.get(a.id) as Shape).y).toBe(50)
  })

  it('lets a before delete handler refuse the delete', () => {
    const store = makeStore()
    const a = shape('a')
    store.put([a])
    store.sideEffects.registerBeforeDeleteHandler('shape', () => false)
    store.remove([a.id])
    expect(store.has(a.id)).toBe(true)
  })

  it('cascades a delete through the records that hang off it', async () => {
    const store = makeStore()
    const parent = shape('parent')
    const child = shape('child', { parentId: 'shape:parent' })
    store.put([parent, child])
    store.sideEffects.registerAfterDeleteHandler('shape', record => {
      const children = store
        .query('shape')
        .get()
        .filter(other => other.parentId === record.id)
      if (children.length) store.remove(children.map(other => other.id))
    })

    const heard: HistoryEntry<Rec>[] = []
    store.listen(entry => heard.push(entry))
    store.remove([parent.id])
    await tick()

    expect(store.has(parent.id)).toBe(false)
    expect(store.has(child.id)).toBe(false)
    expect(heard).toHaveLength(1)
    expect(Object.keys(heard[0].changes.removed).sort()).toEqual(['shape:child', 'shape:parent'])
  })

  it('says when an operation is complete once for the whole atomic op', () => {
    const store = makeStore()
    let complete = 0
    store.sideEffects.registerOperationCompleteHandler(() => complete++)
    store.put([shape('a')])
    expect(complete).toBe(1)
    store.atomic(() => {
      store.put([shape('b')])
      store.put([shape('c')])
    })
    expect(complete).toBe(2)
  })
})

describe('history', () => {
  it('undoes and redoes back to where it was', () => {
    const store = makeStore()
    const history = new HistoryManager<Rec>({ store })
    const a = shape('a')
    store.put([a])
    history.markHistoryStoppingPoint()
    store.put([{ ...a, x: 7 }])

    expect(history.getNumUndos()).toBe(3)
    history.undo()
    expect((store.get(a.id) as Shape).x).toBe(0)
    history.redo()
    expect((store.get(a.id) as Shape).x).toBe(7)
  })

  it('lands a run of marked changes as one undo once it is squashed to a mark', () => {
    const store = makeStore()
    const history = new HistoryManager<Rec>({ store })
    const a = shape('a')
    store.put([a])

    const mark = history.markHistoryStoppingPoint('drag')
    store.put([{ ...a, x: 1 }])
    history.markHistoryStoppingPoint()
    store.put([{ ...a, x: 2 }])
    history.markHistoryStoppingPoint()
    store.put([{ ...a, x: 3 }])

    history.squashToMark(mark)
    history.undo()
    expect((store.get(a.id) as Shape).x).toBe(0)
    expect(store.has(a.id)).toBe(true)

    history.redo()
    expect((store.get(a.id) as Shape).x).toBe(3)
  })

  it('bails to a mark without touching the redo stack', () => {
    const store = makeStore()
    const history = new HistoryManager<Rec>({ store })
    const a = shape('a')
    store.put([a])
    const mark = history.markHistoryStoppingPoint()
    store.put([{ ...a, x: 1 }])
    store.put([{ ...a, x: 2 }])

    history.bailToMark(mark)
    expect((store.get(a.id) as Shape).x).toBe(0)
    expect(history.getNumRedos()).toBe(0)
  })

  it('never takes a remote change into the undo stack', () => {
    const store = makeStore()
    const history = new HistoryManager<Rec>({ store })
    const a = shape('a')

    store.mergeRemoteChanges(() => store.put([a]))
    expect(history.getNumUndos()).toBe(0)

    history.undo()
    expect(store.has(a.id)).toBe(true)

    const b = shape('b')
    store.put([b])
    store.mergeRemoteChanges(() => store.put([{ ...a, x: 4 }]))
    history.undo()
    expect(store.has(b.id)).toBe(false)
    expect((store.get(a.id) as Shape).x).toBe(4)
  })

  it('drops what happens inside ignore', () => {
    const store = makeStore()
    const history = new HistoryManager<Rec>({ store })
    const a = shape('a')
    history.ignore(() => store.put([a]))
    expect(history.getNumUndos()).toBe(0)
    history.undo()
    expect(store.has(a.id)).toBe(true)
  })

  it('clears both stacks', () => {
    const store = makeStore()
    const history = new HistoryManager<Rec>({ store })
    store.put([shape('a')])
    history.markHistoryStoppingPoint()
    store.put([shape('b')])
    history.undo()
    expect(history.getNumRedos()).toBeGreaterThan(0)
    history.clear()
    expect(history.getNumUndos()).toBe(0)
    expect(history.getNumRedos()).toBe(0)
  })
})

describe('the squash rules the diff algebra rests on', () => {
  it('turns an add over a remove into an update', () => {
    const before = shape('a', { x: 1 })
    const after = shape('a', { x: 2 })
    const squashed = squashRecordDiffs<Rec>([diffOf({ removed: { [before.id]: before } }), diffOf({ added: { [after.id]: after } })])
    expect(squashed.removed).toEqual({})
    expect(squashed.added).toEqual({})
    expect(squashed.updated[after.id]).toEqual([before, after])
  })

  it('cancels an add over a remove of the very same record', () => {
    const record = shape('a', { x: 1 })
    const squashed = squashRecordDiffs<Rec>([
      diffOf({ removed: { [record.id]: record } }),
      diffOf({ added: { [record.id]: record } })
    ])
    expect(squashed.added).toEqual({})
    expect(squashed.removed).toEqual({})
    expect(squashed.updated).toEqual({})
  })

  it('keeps the original from value when a remove lands over an update', () => {
    const first = shape('a', { x: 1 })
    const second = { ...first, x: 2 }
    const squashed = squashRecordDiffs<Rec>([
      diffOf({ updated: { [first.id]: [first, second] } }),
      diffOf({ removed: { [second.id]: second } })
    ])
    expect(squashed.updated).toEqual({})
    expect(squashed.removed[first.id]).toEqual(first)
  })

  it('drops a record a remove lands over an add of', () => {
    const record = shape('a', { x: 1 })
    const squashed = squashRecordDiffs<Rec>([
      diffOf({ added: { [record.id]: record } }),
      diffOf({ removed: { [record.id]: record } })
    ])
    expect(squashed.added).toEqual({})
    expect(squashed.removed).toEqual({})
    expect(squashed.updated).toEqual({})
  })

  it('keeps the first from and the last to across two updates', () => {
    const first = shape('a', { x: 1 })
    const second = { ...first, x: 2 }
    const third = { ...first, x: 3 }
    const squashed = squashRecordDiffs<Rec>([
      diffOf({ updated: { [first.id]: [first, second] } }),
      diffOf({ updated: { [first.id]: [second, third] } })
    ])
    expect(squashed.updated[first.id]).toEqual([first, third])
  })

  it('leaves the diffs it was handed exactly as they were', () => {
    const first = shape('a', { x: 1 })
    const second = { ...first, x: 2 }
    const third = { ...first, x: 3 }
    const one = diffOf({ updated: { [first.id]: [first, second] } })
    const two = diffOf({ updated: { [first.id]: [second, third] } })
    squashRecordDiffs<Rec>([one, two])
    expect(one.updated[first.id]).toEqual([first, second])
    expect(two.updated[first.id]).toEqual([second, third])
  })

  it('reverses every part of a diff', () => {
    const first = shape('a', { x: 1 })
    const second = { ...first, x: 2 }
    const added = shape('b')
    const removed = shape('c')
    const reversed = reverseRecordsDiff(
      diffOf({
        added: { [added.id]: added },
        updated: { [first.id]: [first, second] },
        removed: { [removed.id]: removed }
      })
    )
    expect(reversed.added).toEqual({ [removed.id]: removed })
    expect(reversed.removed).toEqual({ [added.id]: added })
    expect(reversed.updated[first.id]).toEqual([second, first])
    expect(isRecordsDiffEmpty(createEmptyRecordsDiff<Rec>())).toBe(true)
  })
})

describe('where a change came from', () => {
  it('stamps a remote merge remote and a local edit user', () => {
    const store = makeStore()
    const seen: HistoryEntry<Rec>[] = []
    store.listen(entry => seen.push(entry))
    store.put([shape('a', { x: 1 })])
    store.flushHistory()
    store.mergeRemoteChanges(() => {
      store.put([shape('b', { x: 2 })])
    })
    store.flushHistory()
    expect(seen.map(entry => entry.source)).toEqual(['user', 'remote'])
  })

  it('tells a history interceptor the same thing', () => {
    const store = makeStore()
    const sources: string[] = []
    store.addHistoryInterceptor((_entry, source) => sources.push(source))
    store.put([shape('a', { x: 1 })])
    store.mergeRemoteChanges(() => {
      store.put([shape('b', { x: 2 })])
    })
    expect(sources).toEqual(['user', 'remote'])
  })

  it('keeps a collaborator out of a listener that only wants your own', () => {
    const store = makeStore()
    const mine: HistoryEntry<Rec>[] = []
    store.listen(entry => mine.push(entry), { source: 'user' })
    store.mergeRemoteChanges(() => {
      store.put([shape('a', { x: 1 })])
    })
    store.flushHistory()
    expect(mine).toHaveLength(0)
    store.put([shape('b', { x: 2 })])
    store.flushHistory()
    expect(mine).toHaveLength(1)
  })

  it('refuses to merge remote changes inside an atomic operation', () => {
    const store = makeStore()
    expect(() =>
      store.atomic(() => {
        store.mergeRemoteChanges(() => {
          store.put([shape('a')])
        })
      })
    ).toThrow()
  })
})

describe('the scope a listener asked for', () => {
  it('hands each listener only the records of its own scope', () => {
    const store = makeStore()
    const document: HistoryEntry<Rec>[] = []
    const session: HistoryEntry<Rec>[] = []
    store.listen(entry => document.push(entry), { scope: 'document' })
    store.listen(entry => session.push(entry), { scope: 'session' })
    store.put([CameraType.create({ id: CameraType.createId('c'), zoom: 2 })])
    store.flushHistory()
    expect(document).toHaveLength(0)
    expect(session).toHaveLength(1)
    store.put([shape('a', { x: 1 })])
    store.flushHistory()
    expect(document).toHaveLength(1)
    expect(session).toHaveLength(1)
  })

  it('serializes only the scope it was asked for', () => {
    const store = makeStore()
    store.put([
      shape('a', { x: 1 }),
      CameraType.create({ id: CameraType.createId('c'), zoom: 2 }),
      CursorType.create({ id: CursorType.createId('p'), x: 3 })
    ])
    expect(Object.keys(store.serialize('document'))).toHaveLength(1)
    expect(Object.keys(store.serialize('session'))).toHaveLength(1)
    expect(Object.keys(store.serialize('presence'))).toHaveLength(1)
    expect(Object.keys(store.serialize('all'))).toHaveLength(3)
  })
})

describe('what a side effect is told about', () => {
  it('says nothing when a record is replaced by one just like it', () => {
    const store = makeStore()
    store.put([shape('a', { x: 1 })])
    const afterChange = vi.fn()
    store.sideEffects.registerAfterChangeHandler('shape', afterChange)
    const existing = store.get(ShapeType.createId('a'))!
    store.put([{ ...existing }])
    expect(afterChange).not.toHaveBeenCalled()
  })

  it('says so when something really moved', () => {
    const store = makeStore()
    store.put([shape('a', { x: 1 })])
    const afterChange = vi.fn()
    store.sideEffects.registerAfterChangeHandler('shape', afterChange)
    const existing = store.get(ShapeType.createId('a'))!
    store.put([{ ...existing, x: 9 }])
    expect(afterChange).toHaveBeenCalledTimes(1)
  })

  it('reads the value rather than the reference it arrived under', () => {
    const store = makeStore()
    store.put([shape('a', { x: 1 })])
    const afterChange = vi.fn()
    store.sideEffects.registerAfterChangeHandler('shape', afterChange)
    store.put([shape('a', { x: 1 })])
    expect(afterChange).not.toHaveBeenCalled()
    store.put([shape('a', { x: 2 })])
    expect(afterChange).toHaveBeenCalledTimes(1)
  })
})

describe('a snapshot of the whole store', () => {
  it('comes back the same on the other side', () => {
    const store = makeStore()
    store.put([
      shape('a', { x: 1 }),
      shape('b', { x: 2 }),
      CameraType.create({ id: CameraType.createId('c'), zoom: 3 })
    ])
    const snapshot = getStoreSnapshot(store, 'all')
    const next = makeStore()
    loadStoreSnapshot(next, snapshot)
    expect(JSON.stringify(getStoreSnapshot(next, 'all'))).toBe(JSON.stringify(snapshot))
  })

  it('takes what was there before it away', () => {
    const store = makeStore()
    store.put([shape('old', { x: 1 })])
    const other = makeStore()
    other.put([shape('new', { x: 2 })])
    loadStoreSnapshot(store, getStoreSnapshot(other, 'all'))
    expect(store.get(ShapeType.createId('old'))).toBeUndefined()
    expect(store.get(ShapeType.createId('new'))).toBeDefined()
  })
})
