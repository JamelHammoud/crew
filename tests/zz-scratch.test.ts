import { describe, it } from 'vitest'
import { createTLStore, getSnapshot } from '../src/renderer/src/canvas'
import { snapshotToSvg, svgDataUrl } from '../src/renderer/src/canvas/export'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'
import { createShapeId } from '../src/renderer/src/canvas/schema'

describe('scratch preview', () => {
  it('draws an empty board and a full one', () => {
    const store = createTLStore({ id: 'preview', shapeUtils: designShapeUtils })
    const empty = getSnapshot(store).document
    const svgEmpty = snapshotToSvg(
      { store: empty.store, schema: empty.schema },
      { background: false, darkMode: false, padding: 24, preserveAspectRatio: 'xMidYMid meet' }
    )
    console.log('empty svg', svgEmpty === null ? 'null' : typeof svgEmpty, svgEmpty ? String(svgEmpty).slice(0, 60) : '')

    store.put([
      {
        id: createShapeId('a'),
        typeName: 'shape',
        type: 'design-node',
        x: 0,
        y: 0,
        rotation: 0,
        index: 'a1',
        parentId: [...store.allRecords()].find(r => r.typeName === 'page')!.id,
        isLocked: false,
        opacity: 1,
        meta: {},
        props: { w: 100, h: 60, name: 'a' }
      } as never
    ])
    const full = getSnapshot(store).document
    const svgFull = snapshotToSvg(
      { store: full.store, schema: full.schema },
      { background: false, darkMode: false, padding: 24, preserveAspectRatio: 'xMidYMid meet' }
    )
    console.log('full svg', svgFull ? String(svgFull).slice(0, 120) : 'null')
    console.log('data url', svgFull ? svgDataUrl(svgFull).slice(0, 60) : 'none')
  })
})
