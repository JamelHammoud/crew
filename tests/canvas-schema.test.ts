import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  InstancePresenceRecordType,
  PageRecordType,
  ShapeRecordType,
  createTLStore,
  createTLSchema,
  decodePoints,
  encodePoints,
  getSnapshot,
  loadSnapshot,
  type TLRecord,
  type TLStoreSnapshot
} from '../src/renderer/src/canvas/schema'

const designsRoot = join(
  homedir(),
  'Library',
  'Application Support',
  'Crew',
  'projects',
  '8fe5a6ed2108672a',
  '.crew',
  'designs'
)

const boardFiles = existsSync(designsRoot)
  ? readdirSync(designsRoot)
      .filter(name => name.endsWith('.json'))
      .map(name => join(designsRoot, name))
  : []

describe('the Crew canvas schema', () => {
  it('validates and snapshots a document without session records', () => {
    const store = createTLStore()
    const page = PageRecordType.create({ id: PageRecordType.createId('page'), name: 'Page 1', index: 'a1' })
    const shape = ShapeRecordType.create({
      id: ShapeRecordType.createId('box'),
      type: 'geo',
      parentId: page.id,
      index: 'a1',
      props: {
        geo: 'rectangle',
        dash: 'draw',
        url: '',
        w: 120,
        h: 80,
        growY: 0,
        scale: 1,
        labelColor: 'black',
        color: 'black',
        fill: 'none',
        size: 'm',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        richText: { type: 'doc', content: [{ type: 'paragraph' }] }
      }
    })
    store.put([page, shape])
    const snapshot = getSnapshot(store).document
    expect(Object.values(snapshot.store).map(record => record.typeName).sort()).toEqual(['page', 'shape'])
    expect(snapshot.schema).toEqual(createTLSchema().serialize())
  })

  it('keeps local presence when a document snapshot lands', () => {
    const store = createTLStore()
    const page = PageRecordType.create({ id: PageRecordType.createId('page'), name: 'Page 1', index: 'a1' })
    const presence = InstancePresenceRecordType.create({
      id: InstancePresenceRecordType.createId('person'),
      userId: 'user:person',
      userName: 'Person',
      currentPageId: page.id
    })
    store.put([presence])
    loadSnapshot(store, { store: { [page.id]: page }, schema: createTLSchema().serialize() })
    expect(store.get(presence.id)).toEqual(presence)
    expect(store.get(page.id)).toEqual(page)
  })

  it('round trips the compact draw point codec', () => {
    const points = [
      { x: 12.25, y: -4.5, z: 0.75 },
      { x: 13, y: -3.25, z: 0.5 },
      { x: 15.5, y: 1, z: 1 }
    ]
    const encoded = encodePoints(points)
    expect(encoded).toHaveLength(32)
    const decoded = decodePoints(encoded)
    expect(decoded[0]).toEqual(points[0])
    expect(decoded[1].x).toBeCloseTo(points[1].x, 3)
    expect(decoded[1].y).toBeCloseTo(points[1].y, 3)
    expect(decoded[2].z).toBeCloseTo(points[2].z, 3)
  })

  it.skipIf(boardFiles.length === 0)('loads every existing Crew board and preserves its document snapshot', () => {
    for (const file of boardFiles) {
      const saved = JSON.parse(readFileSync(file, 'utf8')) as { document: TLStoreSnapshot }
      const document = saved.document
      const store = createTLStore()
      loadSnapshot(store, document)
      const records = Object.values(document.store) as TLRecord[]
      for (const record of records) expect(store.get(record.id)).toEqual(record)
      expect(getSnapshot(store).document).toEqual(document)
    }
  })
})
