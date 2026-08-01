import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import { getShapeAtPoint } from '../src/renderer/src/canvas/editor/hitTest'
import { defaultShapeUtils, type ShapeEditor } from '../src/renderer/src/canvas/shapes'
import { DesignNodeUtil } from '../src/renderer/src/design/DesignNodeUtil'
import type { TLShape } from '../src/renderer/src/canvas/schema'

const FILE =
  '/Users/jamel/Library/Application Support/Crew/projects/8fe5a6ed2108672a/.crew/designs/untitled-6eto.json'
const saved = JSON.parse(readFileSync(FILE, 'utf8'))
const all = Object.values(saved.document?.store ?? {}) as { typeName?: string }[]
const shapes = all.filter(r => r.typeName === 'shape') as TLShape[]
const byId = new Map(shapes.map(s => [s.id as string, s]))

const editor: ShapeEditor = {}
const utils = new Map<string, { getGeometry(s: never): unknown; getClipPath?(s: never): unknown }>()
for (const U of defaultShapeUtils) utils.set(U.type as string, new U(editor as never) as never)
utils.set('design-node', new DesignNodeUtil(editor as never) as never)

function utilFor(shape: TLShape) {
  return utils.get(shape.type) as unknown as {
    getGeometry(s: TLShape): { bounds: Box }
    getClipPath?(s: TLShape): Vec[] | undefined
  }
}
const geometryOf = (shape: TLShape) => utilFor(shape).getGeometry(shape)

function pageOffset(shape: TLShape): Vec {
  let x = 0
  let y = 0
  let current: TLShape | undefined = shape
  while (current) {
    x += current.x
    y += current.y
    current = byId.get(current.parentId as string)
  }
  return new Vec(x, y)
}

const host = {
  hitTestMargin: 8,
  getZoomLevel: () => 1,
  getViewportPageBounds: () => new Box(-100000, -100000, 200000, 200000),
  getCurrentPageShapesSorted: () => shapes,
  getCurrentPageRenderingShapesSorted: () => shapes,
  getShapeGeometry: (shape: TLShape) => geometryOf(shape) as never,
  getPointInShapeSpace: (shape: TLShape, point: Vec) => Vec.Sub(point, pageOffset(shape)),
  getShapeMask: () => undefined,
  getShapePageBounds: (shape: TLShape) => {
    const b = geometryOf(shape).bounds
    const at = pageOffset(shape)
    return new Box(at.x + b.minX, at.y + b.minY, b.w, b.h)
  },
  getShapeText: (shape: TLShape) => (shape.props as { richText?: unknown; name?: string }).name ?? '',
  isShapeFrameLike: (shape: TLShape) => shape.type === 'frame',
  isShapeHidden: () => false,
  isShapeOfType: (shape: TLShape, type: string) => shape.type === type,
  candidatesAtPoint: () => null
}

describe('hit testing the real board', () => {
  it('every geometry exposes a real Box', () => {
    const bad: string[] = []
    for (const shape of shapes) {
      const bounds = geometryOf(shape).bounds
      if (!(bounds instanceof Box) || typeof bounds.containsPoint !== 'function') {
        bad.push(`${shape.type} ${shape.id} -> ${bounds?.constructor?.name}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('finds a filled geo at its own centre', () => {
    const geos = shapes.filter(s => s.type === 'geo')
    const misses: string[] = []
    for (const shape of geos) {
      const props = shape.props as unknown as { fill: string; w: number; h: number; growY: number }
      if (props.fill === 'none') continue
      const at = pageOffset(shape)
      const centre = new Vec(at.x + props.w / 2, at.y + (props.h + (props.growY ?? 0)) / 2)
      const found = getShapeAtPoint(host as never, centre, { hitInside: true })
      if (found?.id !== shape.id) misses.push(`${shape.id} -> ${found?.type ?? 'nothing'} ${found?.id ?? ''}`)
    }
    console.log(`filled geo probed: ${geos.filter(g => (g.props as never as { fill: string }).fill !== 'none').length}, misses: ${misses.length}`)
    for (const miss of misses.slice(0, 6)) console.log('  miss', miss)
    expect(misses).toEqual([])
  })
})
