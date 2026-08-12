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

const axes = ['x', 'y'] as const

const along = (axis: (typeof axes)[number], main: number, cross: number, length: number, breadth: number) =>
  axis === 'x' ? new Box(main, cross, length, breadth) : new Box(cross, main, breadth, length)

const towards = (axis: (typeof axes)[number], main: number) => (axis === 'x' ? new Vec(main, 0) : new Vec(0, main))

describe('canvas bounds snapping', () => {
  it('snaps to the closest point on each axis and accumulates equal point matches', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 20, 10, 10),
      dragDelta: new Vec(89, 0),
      snappableShapes: [node('target', 100, 0, 10, 50)]
    })

    expect(result.nudge).toEqual(new Vec(1, 0))
    const vertical = result.indicators.find(
      (indicator): indicator is PointsSnapIndicator => indicator.type === 'points' && indicator.id === 'point:x:100'
    )
    expect(vertical?.points.map(point => [point.x, point.y])).toEqual([
      [100, 0],
      [100, 50],
      [100, 20],
      [100, 30]
    ])
  })

  it('uses a screen-pixel threshold at every zoom level', () => {
    const options = {
      initialSelectionPageBounds: new Box(0, 30, 10, 10),
      snappableShapes: [node('target', 100, 0)],
      snapThreshold: 8
    }

    expect(snapTranslateBounds({ ...options, dragDelta: new Vec(85.9, 0), zoom: 1 }).nudge.x).toBeCloseTo(4.1)
    expect(snapTranslateBounds({ ...options, dragDelta: new Vec(85.9, 0), zoom: 2 }).nudge.x).toBe(0)
    expect(snapTranslateBounds({ ...options, dragDelta: new Vec(86, 0), zoom: 2 }).nudge.x).toBe(4)
  })

  it('recalculates indicators after applying both nudge axes', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      initialSelectionSnapPoints: [{ id: 'selection', x: 10, y: 10 }],
      dragDelta: new Vec(89, 89),
      snappableShapes: [
        { id: 'vertical', pageBounds: new Box(100, 30, 10, 10), points: [new Vec(100, 35)] },
        { id: 'horizontal', pageBounds: new Box(30, 100, 10, 10), points: [new Vec(35, 100)] },
        { id: 'corner', pageBounds: new Box(100, 100, 10, 10), points: [new Vec(100, 100)] }
      ]
    })

    expect(result.nudge).toEqual(new Vec(1, 1))
    expect(
      result.indicators
        .filter((indicator): indicator is PointsSnapIndicator => indicator.type === 'points')
        .map(indicator => indicator.id)
    ).toEqual(['point:x:100', 'point:y:100'])
    expect(
      result.indicators
        .filter((indicator): indicator is PointsSnapIndicator => indicator.type === 'points')
        .every(indicator => indicator.points.some(point => point.equalsXY(100, 100)))
    ).toBe(true)
  })

  it('duplicates a gap and carries equal-distance indicators through adjacent shapes', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      dragDelta: new Vec(59, 0),
      snappableShapes: [node('a', 0, 0), node('b', 20, 0), node('c', 40, 0)]
    })

    expect(result.nudge).toEqual(new Vec(1, 0))
    const indicator = result.indicators.find((candidate): candidate is GapsSnapIndicator => candidate.type === 'gaps')
    expect(indicator?.direction).toBe('horizontal')
    expect(indicator?.gaps).toHaveLength(3)
    expect(indicator?.gaps.map(gap => [gap.startEdge[0].x, gap.endEdge[0].x])).toEqual([
      [10, 20],
      [30, 40],
      [50, 60]
    ])
  })

  it('centers a selection inside a larger gap and draws both resulting distances', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      dragDelta: new Vec(24, 0),
      snappableShapes: [node('left', 0, 0), node('right', 50, 0)]
    })

    expect(result.nudge).toEqual(new Vec(1, 0))
    const indicator = result.indicators.find((candidate): candidate is GapsSnapIndicator => candidate.type === 'gaps')
    expect(indicator?.gaps.map(gap => [gap.startEdge[0].x, gap.endEdge[0].x])).toEqual([
      [10, 25],
      [35, 50]
    ])
  })

  it('accumulates equal vertical gaps without repeating an edge', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      dragDelta: new Vec(0, 59),
      snappableShapes: [node('a', 0, 0), node('b', 0, 20), node('c', 0, 40)]
    })

    expect(result.nudge).toEqual(new Vec(0, 1))
    const indicator = result.indicators.find(
      (candidate): candidate is GapsSnapIndicator => candidate.type === 'gaps' && candidate.direction === 'vertical'
    )
    const distances = indicator?.gaps.map(gap => [gap.startEdge[0].y, gap.endEdge[0].y])
    expect(distances).toEqual([
      [10, 20],
      [30, 40],
      [50, 60]
    ])
    expect(new Set(distances?.map(distance => distance.join(':'))).size).toBe(3)
  })

  it('snaps resized edges with the same zoom-aware point pass', () => {
    const result = snapResizeBounds({
      initialSelectionPageBounds: new Box(0, 20, 20, 20),
      dragDelta: new Vec(78, 0),
      handle: 'right',
      snappableShapes: [node('target', 100, 0, 10, 60)],
      zoom: 2
    })

    expect(result.nudge).toEqual(new Vec(2, 0))
    expect(result.indicators.some(indicator => indicator.id === 'point:x:100')).toBe(true)
  })
})

describe('how far a snap reaches', () => {
  const reach = (dragDelta: number, zoom: number, snapThreshold?: number) =>
    snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 10, 10),
      initialSelectionSnapPoints: [{ id: 'corner', x: 0, y: 0 }],
      dragDelta: new Vec(dragDelta, 0),
      snappableShapes: [at('target', new Box(100, 0, 10, 10), new Vec(100, 0))],
      zoom,
      snapThreshold
    }).nudge.x

  for (const { zoom, snapThreshold, page } of [
    { zoom: 1, snapThreshold: undefined, page: 8 },
    { zoom: 2, snapThreshold: undefined, page: 4 },
    { zoom: 0.5, snapThreshold: undefined, page: 16 },
    { zoom: 0.1, snapThreshold: undefined, page: 80 },
    { zoom: 10, snapThreshold: undefined, page: 0.8 },
    { zoom: 1, snapThreshold: 16, page: 16 },
    { zoom: 2, snapThreshold: 16, page: 8 }
  ]) {
    it(`covers ${page} across the page at ${zoom}x on a ${snapThreshold ?? 8} pixel reach`, () => {
      expect(reach(100 - page, zoom, snapThreshold)).toBeCloseTo(page, 8)
      expect(reach(100 - page - 0.001, zoom, snapThreshold)).toBe(0)
    })
  }

  it('reads a point a hair beyond the reach as being on it', () => {
    expect(reach(92 - 1e-9, 1)).toBeCloseTo(8, 8)
    expect(reach(92 - 1e-6, 1)).toBe(0)
  })
})

describe('snapping the way Figma does', () => {
  it('takes the edges of a shape it is standing on top of', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 20, 20),
      dragDelta: new Vec(52, 52),
      snappableShapes: [node('under', 50, 50, 100, 100)]
    })

    expect(result.nudge).toEqual(new Vec(-2, -2))
    expect(result.indicators.some(indicator => indicator.id === 'point:x:50')).toBe(true)
  })

  it('centers a shape inside a larger one on both axes at once', () => {
    const result = snapTranslateBounds({
      initialSelectionPageBounds: new Box(0, 0, 20, 20),
      dragDelta: new Vec(137, 137),
      snappableShapes: [node('frame', 100, 100, 100, 100)]
    })

    expect(result.nudge).toEqual(new Vec(3, 3))
    expect(result.indicators.map(indicator => indicator.id)).toEqual(['point:x:150', 'point:y:150'])
  })

  for (const axis of axes) {
    for (const { where, drag, nudge } of [
      { where: 'between two others', drag: 24, nudge: 1 },
      { where: 'ahead of a pair', drag: -49, nudge: -1 },
      { where: 'behind a pair', drag: 99, nudge: 1 }
    ]) {
      it(`spaces a shape evenly ${where} along ${axis}`, () => {
        const result = snapTranslateBounds({
          initialSelectionPageBounds: along(axis, 0, 0, 10, 10),
          dragDelta: towards(axis, drag),
          snappableShapes: [
            { id: 'first', pageBounds: along(axis, 0, 0, 10, 10) },
            { id: 'second', pageBounds: along(axis, 50, 0, 10, 10) }
          ]
        })

        expect(result.nudge[axis]).toBe(nudge)
        expect(result.indicators.some(indicator => indicator.type === 'gaps')).toBe(true)
      })
    }
  }
})

describe('both axes snap alike', () => {
  for (const axis of axes) {
    it(`takes a closer equal distance over a center that was also in reach along ${axis}`, () => {
      const result = snapTranslateBounds({
        initialSelectionPageBounds: along(axis, -1, 0, 1, 10),
        dragDelta: new Vec(0, 0),
        snappableShapes: [at('first', along(axis, 0, 0, 1, 10)), at('second', along(axis, 3, 0, 1, 10))]
      })

      expect(result.nudge[axis]).toBe(-2)
    })

    it(`keeps a center for each gap whose breadths only touch along ${axis}`, () => {
      const result = snapTranslateBounds({
        initialSelectionPageBounds: along(axis, 19, 5, 10, 10),
        dragDelta: new Vec(0, 0),
        snappableShapes: [
          at('a', along(axis, 0, 0, 10, 10)),
          at('b', along(axis, 40, 0, 10, 10)),
          at('c', along(axis, 0, 10, 10, 10)),
          at('d', along(axis, 40, 10, 10, 10))
        ]
      })

      const drawn = result.indicators.filter((indicator): indicator is GapsSnapIndicator => indicator.type === 'gaps')
      expect(result.nudge[axis]).toBe(1)
      expect(drawn).toHaveLength(2)
      const cross = axis === 'x' ? 'y' : 'x'
      expect(drawn.map(indicator => indicator.gaps[0].startEdge[0][cross])).toEqual([0, 10])
    })
  }
})
