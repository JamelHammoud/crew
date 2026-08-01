import { describe, expect, it } from 'vitest'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import {
  snapResizeBounds,
  snapTranslateBounds,
  type BoundsSnapNode,
  type GapsSnapIndicator,
  type PointsSnapIndicator
} from '../src/renderer/src/canvas/tools/snaps'

const node = (id: string, x: number, y: number, w = 10, h = 10): BoundsSnapNode => ({
  id,
  pageBounds: new Box(x, y, w, h)
})

const at = (id: string, box: Box, ...points: Vec[]): BoundsSnapNode => ({ id, pageBounds: box, points })

const points = (result: { indicators: unknown[] }) =>
  (result.indicators as PointsSnapIndicator[]).filter(indicator => indicator.type === 'points')

const gaps = (result: { indicators: unknown[] }) =>
  (result.indicators as GapsSnapIndicator[]).filter(indicator => indicator.type === 'gaps')

describe('bounds snapping against the reference', () => {
  it('takes a point exactly a threshold away and leaves one beyond it', () => {
    const options = {
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      snappableShapes: [node('target', 100, 0)]
    }

    expect(snapTranslateBounds({ ...options, dragDelta: new Vec(82, 0) }).nudge).toEqual(new Vec(8, 0))
    expect(snapTranslateBounds({ ...options, dragDelta: new Vec(81.9, 0) }).nudge).toEqual(new Vec(0, 0))
  })

  it('gathers the corners and the center of every shape it can snap to', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      dragDelta: new Vec(104, 0),
      snappableShapes: [node('target', 100, 0, 20, 20)]
    })

    expect(result.nudge).toEqual(new Vec(1, 0))
    const center = points(result).find(indicator => indicator.id === 'point:x:110')
    expect(center?.points.map(point => [point.x, point.y])).toEqual([
      [110, 10],
      [110, 5]
    ])
  })

  it('offers no point of its own for a shape that hands over an empty set', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      dragDelta: new Vec(97, 0),
      snappableShapes: [at('target', new Box(100, 0, 10, 10))]
    })

    expect(result.nudge).toEqual(new Vec(0, 0))
    expect(result.indicators).toEqual([])
  })

  it('keeps only the alignments that are exact once the nudge has been applied', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      initialSelectionSnapPoints: [{ id: 'corner', x: 0, y: 0 }],
      dragDelta: new Vec(100, 0),
      snappableShapes: [
        at('ahead', new Box(101, 0, 1, 1), new Vec(101, 0)),
        at('behind', new Box(99, 0, 1, 1), new Vec(99, 0))
      ]
    })

    expect(result.nudge).toEqual(new Vec(1, 0))
    expect(points(result).map(indicator => indicator.id)).toEqual(['point:x:101', 'point:y:0'])
  })

  it('reads two points closer together than the snap epsilon as one', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 50, 10, 10),
      initialSelectionSnapPoints: [{ id: 'corner', x: 0, y: 50.00005 }],
      dragDelta: new Vec(95, 0),
      lockedAxis: 'y',
      snappableShapes: [at('target', new Box(100, 50, 10, 10), new Vec(100, 50))]
    })

    expect(result.nudge).toEqual(new Vec(5, 0))
    const indicator = points(result).find(candidate => candidate.id === 'point:x:100')
    expect(indicator?.points).toHaveLength(1)
  })

  it('centers a selection in a gap only while the gap is the larger of the two', () => {
    const shapes = [at('left', new Box(0, 0, 10, 10)), at('right', new Box(50, 0, 10, 10))]

    expect(
      snapTranslateBounds({
        initialSelectionPageBounds: new Box(0, 0, 10, 10),
        dragDelta: new Vec(24, 0),
        snappableShapes: shapes
      }).nudge
    ).toEqual(new Vec(1, 0))

    expect(
      snapTranslateBounds({
        initialSelectionPageBounds: new Box(0, 0, 45, 10),
        dragDelta: new Vec(6.5, 0),
        snappableShapes: shapes
      }).nudge
    ).toEqual(new Vec(0, 0))
  })

  it('carries a run of equal gaps back through every shape in the chain', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      dragDelta: new Vec(79, 0),
      snappableShapes: [node('a', 0, 0), node('b', 20, 0), node('c', 40, 0), node('d', 60, 0)]
    })

    expect(result.nudge).toEqual(new Vec(1, 0))
    const drawn = gaps(result)
    expect(drawn).toHaveLength(1)
    expect(drawn[0].direction).toBe('horizontal')
    expect(drawn[0].gaps.map(gap => [gap.startEdge[0].x, gap.endEdge[0].x])).toEqual([
      [30, 40],
      [10, 20],
      [50, 60],
      [70, 80]
    ])
  })

  it('keeps a center snap for each vertical gap whose breadths only touch', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(5, 19, 10, 10),
      dragDelta: new Vec(0, 0),
      snappableShapes: [
        at('a', new Box(0, 0, 10, 10)),
        at('b', new Box(0, 40, 10, 10)),
        at('c', new Box(10, 0, 10, 10)),
        at('d', new Box(10, 40, 10, 10))
      ]
    })

    expect(result.nudge).toEqual(new Vec(0, 1))
    const drawn = gaps(result)
    expect(drawn).toHaveLength(2)
    expect(drawn.every(indicator => indicator.direction === 'vertical')).toBe(true)
    expect(drawn.map(indicator => indicator.gaps[0].startEdge[0].x)).toEqual([0, 10])
  })
})

describe('resize snapping against the reference', () => {
  it('holds the axis an edge handle cannot move', () => {
    const result = snapResizeBounds({
      initialSelectionPageBounds: new Box(0, 0, 20, 20),
      dragDelta: new Vec(78, 0),
      handle: 'right',
      snappableShapes: [node('target', 100, 23)]
    })

    expect(result.nudge).toEqual(new Vec(2, 0))
  })

  it('turns the handle over when it is dragged past the opposite edge', () => {
    const result = snapResizeBounds({
      initialSelectionPageBounds: new Box(0, 0, 20, 20),
      dragDelta: new Vec(-30, 0),
      handle: 'right',
      snappableShapes: [at('target', new Box(-13, 0, 2, 2), new Vec(-13, 0))]
    })

    expect(result.nudge).toEqual(new Vec(-3, 0))
  })

  it('nudges a locked corner diagonally, and back the other way on the counter diagonal', () => {
    const options = {
      initialSelectionPageBounds: new Box(0, 0, 20, 10),
      dragDelta: new Vec(80, 0),
      isAspectRatioLocked: true
    }

    expect(
      snapResizeBounds({
        ...options,
        handle: 'bottom_right',
        snappableShapes: [at('target', new Box(103, 500, 2, 2), new Vec(103, 500))]
      }).nudge
    ).toEqual(new Vec(3, 1.5))

    expect(
      snapResizeBounds({
        ...options,
        handle: 'top_right',
        snappableShapes: [at('target', new Box(103, -500, 2, 2), new Vec(103, -500))]
      }).nudge
    ).toEqual(new Vec(3, -1.5))
  })

  it('resizes about the center from both sides at once', () => {
    const result = snapResizeBounds({
      initialSelectionPageBounds: new Box(0, 0, 20, 20),
      dragDelta: new Vec(10, 0),
      handle: 'right',
      isResizingFromCenter: true,
      snappableShapes: [at('target', new Box(33, 0, 4, 4), new Vec(33, 0))]
    })

    expect(result.nudge).toEqual(new Vec(3, 0))
  })
})
