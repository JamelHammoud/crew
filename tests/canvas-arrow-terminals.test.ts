import { describe, expect, it } from 'vitest'
import { Ellipse2d, Rectangle2d, type Geometry2d } from '../src/renderer/src/canvas/geometry'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import type { TLBinding, TLShape, TLShapeId } from '../src/renderer/src/canvas/schema'
import {
  boundShapeRelationship,
  isArrowStraight,
  straightArrowTerminals,
  terminalsInArrowSpace
} from '../src/renderer/src/canvas/shapes/arrowTerminals'
import type { ShapeEditor } from '../src/renderer/src/canvas/shapes'

const base = {
  typeName: 'shape' as const,
  rotation: 0,
  index: 'a1' as TLShape['index'],
  parentId: 'page:page' as TLShape['parentId'],
  isLocked: false,
  opacity: 1,
  meta: {}
}

type Target = { id: string; x: number; y: number; rotation?: number; w: number; h: number; size: string }

function targetShape(target: Target): TLShape {
  return {
    ...base,
    id: target.id as TLShapeId,
    type: 'geo',
    x: target.x,
    y: target.y,
    rotation: target.rotation ?? 0,
    props: { w: target.w, h: target.h, size: target.size }
  } as unknown as TLShape
}

function arrowShape(props: Record<string, unknown> = {}): TLShape<'arrow'> {
  return {
    ...base,
    id: 'shape:arrow' as TLShapeId,
    type: 'arrow',
    x: 0,
    y: 0,
    props: {
      kind: 'arc',
      size: 'm',
      scale: 1,
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 300, y: 300 },
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
      ...props
    }
  } as unknown as TLShape<'arrow'>
}

function binding(terminal: 'start' | 'end', toId: string, props: Record<string, unknown> = {}): TLBinding<'arrow'> {
  return {
    id: `binding:${terminal}` as TLBinding<'arrow'>['id'],
    typeName: 'binding',
    type: 'arrow',
    fromId: 'shape:arrow' as TLShapeId,
    toId: toId as TLShapeId,
    props: {
      terminal,
      normalizedAnchor: { x: 0.5, y: 0.5 },
      isExact: false,
      isPrecise: false,
      snap: 'none',
      ...props
    },
    meta: {}
  } as TLBinding<'arrow'>
}

function stubEditor(arrow: TLShape, targets: Target[], geometries: Record<string, Geometry2d>): ShapeEditor {
  const shapes = new Map(targets.map(target => [target.id, targetShape(target)]))
  const of = (value: unknown): TLShape => {
    const id = typeof value === 'string' ? value : (value as TLShape).id
    return shapes.get(id as string) ?? arrow
  }
  return {
    getShape: id => of(id),
    getShapeGeometry: value =>
      geometries[of(value).id as string] ?? new Rectangle2d({ width: 1, height: 1, isFilled: false }),
    getShapePageTransform: value => {
      const found = of(value)
      return { applyToPoint: point => new Vec(point.x, point.y).rot(found.rotation).addXY(found.x, found.y) }
    },
    getPointInShapeSpace: (found, point) => new Vec(point.x - found.x, point.y - found.y).rot(-found.rotation),
    getShapePageBounds: value => {
      const found = of(value)
      const target = targets.find(entry => entry.id === (found.id as string))
      return new Box(found.x, found.y, target?.w ?? 1, target?.h ?? 1)
    }
  }
}

const BOX: Target = { id: 'shape:target', x: 20, y: 40, w: 200, h: 100, size: 'm' }
const rect = (w: number, h: number) => new Rectangle2d({ width: w, height: h, isFilled: true })

function terminals(
  arrow: TLShape<'arrow'>,
  targets: Target[],
  geometries: Record<string, Geometry2d>,
  bindings: TLBinding<'arrow'>[]
) {
  const editor = stubEditor(arrow, targets, geometries)
  const pair = {
    start: bindings.find(b => b.props.terminal === 'start'),
    end: bindings.find(b => b.props.terminal === 'end')
  }
  const points = straightArrowTerminals(editor, arrow, pair)
  const handles = terminalsInArrowSpace(editor, arrow, pair)
  return {
    start: [Number(points.start.x.toFixed(4)), Number(points.start.y.toFixed(4))],
    end: [Number(points.end.x.toFixed(4)), Number(points.end.y.toFixed(4))],
    handles: [
      [Number(handles.start.x.toFixed(4)), Number(handles.start.y.toFixed(4))],
      [Number(handles.end.x.toFixed(4)), Number(handles.end.y.toFixed(4))]
    ]
  }
}

describe('where a bound arrow stops', () => {
  it('aims at the middle of a shape it was dropped on without hovering', () => {
    const result = terminals(arrowShape(), [BOX], { 'shape:target': rect(200, 100) }, [binding('end', 'shape:target')])
    expect(result.handles[1]).toEqual([120, 90])
    expect(result.end).toEqual([42.5333, 31.9])
  })

  it('aims at the anchor once the binding is precise', () => {
    const result = terminals(arrowShape(), [BOX], { 'shape:target': rect(200, 100) }, [
      binding('end', 'shape:target', { isPrecise: true, normalizedAnchor: { x: 0.25, y: 0.75 } })
    ])
    expect(result.handles[1]).toEqual([70, 115])
    expect(result.end).toEqual([17.3285, 28.4683])
  })

  it('runs all the way to the anchor when the binding is exact', () => {
    const result = terminals(arrowShape(), [BOX], { 'shape:target': rect(200, 100) }, [
      binding('end', 'shape:target', { isExact: true })
    ])
    expect(result.end).toEqual([120, 90])
  })

  it('stops on the edge rather than short of it when there is no arrowhead', () => {
    const result = terminals(arrowShape({ arrowheadEnd: 'none' }), [BOX], { 'shape:target': rect(200, 100) }, [
      binding('end', 'shape:target')
    ])
    expect(result.end).toEqual([53.3333, 40])
  })

  it('follows the outline of an ellipse rather than the box around it', () => {
    const round = terminals(
      arrowShape(),
      [BOX],
      { 'shape:target': new Ellipse2d({ width: 200, height: 100, isFilled: true }) },
      [binding('end', 'shape:target')]
    )
    const square = terminals(arrowShape(), [BOX], { 'shape:target': rect(200, 100) }, [binding('end', 'shape:target')])
    expect(round.end).toEqual([54.1534, 40.6151])
    expect(round.end).not.toEqual(square.end)
  })

  it('leaves both ends where they are when one shape holds them both', () => {
    const result = terminals(arrowShape({ arrowheadStart: 'arrow' }), [BOX], { 'shape:target': rect(200, 100) }, [
      binding('start', 'shape:target'),
      binding('end', 'shape:target', { isPrecise: true, normalizedAnchor: { x: 0.9, y: 0.9 } })
    ])
    expect(result.start).toEqual([120, 90])
    expect(result.end).toEqual([200, 130])
  })

  it('stands off each end by that shape own stroke as well as the arrow one', () => {
    const targets: Target[] = [BOX, { id: 'shape:second', x: 400, y: 40, w: 100, h: 100, size: 'l' }]
    const result = terminals(
      arrowShape({ arrowheadStart: 'arrow' }),
      targets,
      {
        'shape:target': rect(200, 100),
        'shape:second': rect(100, 100)
      },
      [binding('start', 'shape:target'), binding('end', 'shape:second')]
    )
    expect(result.start).toEqual([233.5, 90])
    expect(result.end).toEqual([385.75, 90])
  })

  it('turns the stand off inward when the two shapes are too close together', () => {
    const targets: Target[] = [BOX, { id: 'shape:second', x: 225, y: 40, w: 40, h: 100, size: 's' }]
    const result = terminals(
      arrowShape({ arrowheadStart: 'arrow' }),
      targets,
      {
        'shape:target': rect(200, 100),
        'shape:second': rect(40, 100)
      },
      [binding('start', 'shape:target'), binding('end', 'shape:second')]
    )
    expect(result.start).toEqual([233.5, 90])
    expect(result.end).toEqual([212.25, 90])
  })

  it('reads the anchor through the rotation of the shape it is on', () => {
    const targets: Target[] = [{ ...BOX, rotation: 0.6 }]
    const result = terminals(arrowShape(), targets, { 'shape:target': rect(200, 100) }, [
      binding('end', 'shape:target')
    ])
    expect(result.handles[1]).toEqual([74.3014, 137.731])
    expect(result.end).toEqual([16.0926, 29.8305])
  })

  it('keeps the anchor off the very edge of the shape', () => {
    const result = terminals(arrowShape(), [BOX], { 'shape:target': rect(200, 100) }, [
      binding('end', 'shape:target', { isPrecise: true, normalizedAnchor: { x: 0, y: 1 } })
    ])
    expect(result.handles[1][0]).toBeGreaterThan(20)
    expect(result.handles[1][1]).toBeLessThan(140)
  })
})

describe('what a pair of bound shapes is to each other', () => {
  it('names the shape that holds the other one', () => {
    const targets: Target[] = [
      { id: 'shape:outer', x: 0, y: 0, w: 400, h: 400, size: 'm' },
      { id: 'shape:inner', x: 50, y: 50, w: 100, h: 100, size: 'm' }
    ]
    const editor = stubEditor(arrowShape(), targets, {})
    expect(boundShapeRelationship(editor, 'shape:outer' as TLShapeId, 'shape:inner' as TLShapeId)).toBe(
      'start-contains-end'
    )
    expect(boundShapeRelationship(editor, 'shape:inner' as TLShapeId, 'shape:outer' as TLShapeId)).toBe(
      'end-contains-start'
    )
    expect(boundShapeRelationship(editor, 'shape:inner' as TLShapeId, 'shape:inner' as TLShapeId)).toBe('double-bound')
    expect(boundShapeRelationship(editor, undefined, 'shape:inner' as TLShapeId)).toBe('safe')
  })
})

describe('when an arrow counts as straight', () => {
  it('snaps a small bend away and never calls an elbow straight', () => {
    expect(isArrowStraight(arrowShape({ bend: 7 }))).toBe(true)
    expect(isArrowStraight(arrowShape({ bend: -7 }))).toBe(true)
    expect(isArrowStraight(arrowShape({ bend: 9 }))).toBe(false)
    expect(isArrowStraight(arrowShape({ bend: 7, scale: 2 }))).toBe(true)
    expect(isArrowStraight(arrowShape({ bend: 17, scale: 2 }))).toBe(false)
    expect(isArrowStraight(arrowShape({ kind: 'elbow', bend: 0 }))).toBe(false)
  })
})
