import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BindingRecordType,
  CameraRecordType,
  DIM_2D,
  DIM_3D,
  InstancePresenceRecordType,
  PageRecordType,
  ShapeRecordType,
  UserRecordType,
  ZERO_INDEX_KEY,
  createTLSchema,
  createTLStore,
  decodePoints,
  encodePoints,
  getSnapshot,
  isSinglePoint,
  loadSnapshot,
  type TLRecord,
  type TLStoreSnapshot
} from '../src/renderer/src/canvas/schema'

const designsRoot = join(homedir(), 'Library', 'Application Support', 'Crew', 'projects')

function savedBoards(): TLStoreSnapshot[] {
  if (!existsSync(designsRoot)) return []
  const boards: TLStoreSnapshot[] = []
  for (const project of readdirSync(designsRoot)) {
    const folder = join(designsRoot, project, '.crew', 'designs')
    if (!existsSync(folder)) continue
    for (const name of readdirSync(folder)) {
      if (!name.endsWith('.json')) continue
      const saved = JSON.parse(readFileSync(join(folder, name), 'utf8')) as { document?: TLStoreSnapshot }
      if (saved.document) boards.push(saved.document)
    }
  }
  return boards
}

const boards = savedBoards()

function drawPaths(): { path: string; dim: number }[] {
  const paths: { path: string; dim: number }[] = []
  for (const board of boards) {
    for (const record of Object.values(board.store) as TLRecord[]) {
      if (record.typeName !== 'shape') continue
      const props = (record as { props?: { segments?: { path?: string; dim?: number }[] } }).props
      for (const segment of props?.segments ?? []) {
        if (typeof segment.path === 'string' && segment.path.length > 0) {
          paths.push({ path: segment.path, dim: segment.dim ?? DIM_3D })
        }
      }
    }
  }
  return paths
}

const paths = drawPaths()

describe('a binding, which no saved board carries', () => {
  const page = PageRecordType.create({ id: PageRecordType.createId('page'), name: 'Page 1', index: ZERO_INDEX_KEY })
  const from = ShapeRecordType.createId('arrow')
  const to = ShapeRecordType.createId('box')

  const binding = () =>
    BindingRecordType.create({
      id: BindingRecordType.createId('bound'),
      type: 'arrow',
      fromId: from,
      toId: to,
      props: {
        terminal: 'end',
        normalizedAnchor: { x: 0.5, y: 0.25 },
        isExact: false,
        isPrecise: true,
        snap: 'edge'
      }
    })

  it('takes every prop the arrow binding is specified with', () => {
    const record = binding()
    expect(record.typeName).toBe('binding')
    expect(record.props).toEqual({
      terminal: 'end',
      normalizedAnchor: { x: 0.5, y: 0.25 },
      isExact: false,
      isPrecise: true,
      snap: 'edge'
    })
    expect(record.meta).toEqual({})
  })

  it.each(['center', 'edge-point', 'edge', 'none'])('takes %s as a way to snap', snap => {
    const store = createTLStore()
    const record = { ...binding(), props: { ...binding().props, snap } }
    expect(() => store.put([page, record as TLRecord])).not.toThrow()
  })

  it('refuses a way to snap that nothing answers to', () => {
    const store = createTLStore()
    const record = { ...binding(), props: { ...binding().props, snap: 'sideways' } }
    expect(() => store.put([page, record as TLRecord])).toThrow()
  })

  it('refuses a terminal that is neither end', () => {
    const store = createTLStore()
    const record = { ...binding(), props: { ...binding().props, terminal: 'middle' } }
    expect(() => store.put([page, record as TLRecord])).toThrow()
  })

  it('rides through a document snapshot unchanged', () => {
    const store = createTLStore()
    const record = binding()
    store.put([page, record])
    const snapshot = getSnapshot(store).document
    expect(snapshot.store[record.id]).toEqual(record)

    const second = createTLStore()
    loadSnapshot(second, snapshot)
    expect(second.get(record.id)).toEqual(record)
  })
})

describe('the scope a record is kept in', () => {
  it('leaves what belongs to this window out of the document', () => {
    const store = createTLStore()
    const page = PageRecordType.create({ id: PageRecordType.createId('page'), name: 'Page 1', index: ZERO_INDEX_KEY })
    const camera = CameraRecordType.create({ id: CameraRecordType.createId('camera') })
    const presence = InstancePresenceRecordType.create({
      id: InstancePresenceRecordType.createId('person'),
      userId: UserRecordType.createId('person'),
      userName: 'Person',
      currentPageId: page.id
    })
    store.put([page, camera, presence])

    const document = getSnapshot(store).document
    const kinds = Object.values(document.store).map(record => record.typeName)
    expect(kinds).toContain('page')
    expect(kinds).not.toContain('camera')
    expect(kinds).not.toContain('instance_presence')
  })

  it('keeps the camera in the session snapshot instead', () => {
    const store = createTLStore()
    const camera = CameraRecordType.create({ id: CameraRecordType.createId('camera') })
    store.put([camera])
    const session = getSnapshot(store).session
    expect(Object.values(session?.store ?? {}).map(record => record.typeName)).toContain('camera')
  })

  it('says which scope every type it knows is kept in', () => {
    const store = createTLStore()
    expect(store.scopedTypes.document.has('shape')).toBe(true)
    expect(store.scopedTypes.document.has('page')).toBe(true)
    expect(store.scopedTypes.document.has('binding')).toBe(true)
    expect(store.scopedTypes.session.has('camera')).toBe(true)
    expect(store.scopedTypes.session.has('instance')).toBe(true)
    expect(store.scopedTypes.presence.has('instance_presence')).toBe(true)
  })
})

describe('the paths the saved boards were drawn with', () => {
  it('found some to read', () => {
    expect(paths.length).toBeGreaterThan(0)
  })

  it.skipIf(paths.length === 0)('reads every one of them back as real points', () => {
    for (const { path, dim } of paths) {
      const points = decodePoints(path, dim as 2 | 3)
      expect(points.length).toBeGreaterThan(0)
      for (const point of points) {
        expect(Number.isFinite(point.x)).toBe(true)
        expect(Number.isFinite(point.y)).toBe(true)
        expect(Number.isFinite(point.z)).toBe(true)
      }
    }
  })

  it.skipIf(paths.length === 0)('writes every one of them back out as the same run of points', () => {
    for (const { path, dim } of paths) {
      const points = decodePoints(path, dim as 2 | 3)
      const again = decodePoints(encodePoints(points, dim as 2 | 3), dim as 2 | 3)
      expect(again).toEqual(points)
    }
  })

  it.skipIf(paths.length === 0)('holds the first point of each to full precision', () => {
    for (const { path, dim } of paths) {
      const points = decodePoints(path, dim as 2 | 3)
      const again = decodePoints(encodePoints(points, dim as 2 | 3), dim as 2 | 3)
      expect(again[0].x).toBe(points[0].x)
      expect(again[0].y).toBe(points[0].y)
    }
  })
})

describe('the compact codec a path is written with', () => {
  it('spends sixteen characters on the first point and eight on each one after it', () => {
    const points = [
      { x: 1, y: 2, z: 0.5 },
      { x: 3, y: 4, z: 0.5 },
      { x: 5, y: 6, z: 0.5 }
    ]
    expect(encodePoints(points, DIM_3D)).toHaveLength(16 + 8 * 2)
  })

  it('spends twelve characters on the first point and four on each one after it without pressure', () => {
    const points = [
      { x: 1, y: 2, z: 0.5 },
      { x: 3, y: 4, z: 0.5 },
      { x: 5, y: 6, z: 0.5 },
      { x: 7, y: 8, z: 0.5 }
    ]
    expect(encodePoints(points, DIM_2D)).toHaveLength(12 + 4 * 3)
  })

  it('reads one point on its own as one point', () => {
    expect(isSinglePoint(encodePoints([{ x: 1, y: 2, z: 0.5 }], DIM_3D), DIM_3D)).toBe(true)
    expect(isSinglePoint(encodePoints([{ x: 1, y: 2, z: 0.5 }], DIM_2D), DIM_2D)).toBe(true)
    expect(
      isSinglePoint(
        encodePoints(
          [
            { x: 1, y: 2, z: 0.5 },
            { x: 3, y: 4, z: 0.5 }
          ],
          DIM_3D
        ),
        DIM_3D
      )
    ).toBe(false)
  })

  it('writes nothing for no points and reads nothing back', () => {
    expect(encodePoints([], DIM_3D)).toBe('')
    expect(decodePoints('', DIM_3D)).toEqual([])
    expect(decodePoints('', DIM_2D)).toEqual([])
  })

  it('hands back the pressure everything assumes when a path was written without it', () => {
    const decoded = decodePoints(
      encodePoints(
        [
          { x: 1, y: 2, z: 0.9 },
          { x: 3, y: 4, z: 0.1 }
        ],
        DIM_2D
      ),
      DIM_2D
    )
    expect(decoded.map(point => point.z)).toEqual([0.5, 0.5])
  })

  it('keeps a long run of points from drifting away from where they were drawn', () => {
    const points = Array.from({ length: 400 }, (_, at) => ({
      x: 500 + Math.sin(at / 9) * 120,
      y: -300 + Math.cos(at / 7) * 90,
      z: 0.5
    }))
    const decoded = decodePoints(encodePoints(points, DIM_2D), DIM_2D)
    expect(decoded).toHaveLength(points.length)
    for (let at = 0; at < points.length; at++) {
      expect(Math.abs(decoded[at].x - points[at].x)).toBeLessThan(1)
      expect(Math.abs(decoded[at].y - points[at].y)).toBeLessThan(1)
    }
  })
})

describe('every saved board', () => {
  it('found some to read', () => {
    expect(boards.length).toBeGreaterThan(0)
  })

  it.skipIf(boards.length === 0)('comes back out of the store exactly as it went in', () => {
    for (const document of boards) {
      const store = createTLStore()
      loadSnapshot(store, document)
      expect(getSnapshot(store).document).toEqual(document)
    }
  })

  it.skipIf(boards.length === 0)('is written under a schema this build still answers to', () => {
    const current = createTLSchema().serialize()
    for (const document of boards) {
      expect(document.schema.schemaVersion).toBe(current.schemaVersion)
    }
  })
})
