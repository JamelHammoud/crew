import { describe, expect, it } from 'vitest'
import { Group2d } from '../src/renderer/src/canvas/geometry'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import { GeoShapeUtil, type ShapeEditor } from '../src/renderer/src/canvas/shapes'
import type { TLShape, TLShapeId } from '../src/renderer/src/canvas/schema'

const editor: ShapeEditor = {}
const util = new GeoShapeUtil(editor)
function geo(props: Partial<TLShape<'geo'>['props']> = {}): TLShape<'geo'> {
  return { id: 'shape:g' as TLShapeId, typeName: 'shape', type: 'geo', x: 0, y: 0, rotation: 0, index: 'a1',
    parentId: 'page:p' as TLShape['parentId'], isLocked: false, opacity: 1, meta: {},
    props: { ...util.getDefaultProps(), w: 200, h: 100, ...props } } as TLShape<'geo'>
}

describe('geo hit contract', () => {
  for (const kind of ['rectangle', 'ellipse', 'triangle', 'check-box', 'x-box'] as const) {
    it(`${kind} filled reports filled`, () => {
      const g = util.getGeometry(geo({ geo: kind, fill: 'semi' })) as Group2d
      expect(g instanceof Group2d).toBe(true)
      expect(g.children[0].isFilled, `${kind} children[0].isFilled`).toBe(true)
      expect(g.children[0].distanceToPoint(new Vec(100, 50), false)).toBeLessThan(0)
    })
    it(`${kind} hollow reports hollow`, () => {
      const g = util.getGeometry(geo({ geo: kind, fill: 'none' })) as Group2d
      expect(g.children[0].isFilled, `${kind} hollow`).toBe(false)
    })
  }
  it('always carries a label child', () => {
    for (const fill of ['none', 'semi'] as const) {
      const g = util.getGeometry(geo({ fill, richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Continue with Google' }] }] } })) as Group2d
      const label = g.children.find(c => c.isLabel)
      expect(label, `fill ${fill}`).toBeDefined()
      expect(label!.isPointInBounds(new Vec(100, 50)), `fill ${fill} centre in label`).toBe(true)
    }
  })
})
