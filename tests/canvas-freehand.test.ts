import { describe, expect, it } from 'vitest'
import {
  freehandCenterline,
  freehandOptions,
  freehandOutline,
  highlightOptions
} from '../src/renderer/src/canvas/shapes/freehand'

type Point = { x: number; y: number; z?: number }

function points(raw: number[][]): Point[] {
  return raw.map(([x, y, z]) => ({ x, y, z }))
}

function rounded(result: { x: number; y: number }[], places = 4): number[][] {
  return result.map(point => [Number(point.x.toFixed(places)), Number(point.y.toFixed(places))])
}

const CORNER = points([
  [0, 0],
  [20, 0],
  [40, 0],
  [40, 20],
  [40, 40],
  [20, 40]
])
const CORNER_OPTIONS = {
  size: 12,
  thinning: 0.5,
  streamline: 0.7,
  smoothing: 0.62,
  simulatePressure: true,
  last: true
}

const RUN = points([
  [0, 0],
  [20, 5],
  [40, 20],
  [60, 25],
  [80, 20]
])
const TAPER_OPTIONS = {
  size: 10,
  thinning: 0.5,
  streamline: 0.64,
  smoothing: 0.62,
  simulatePressure: true,
  last: true,
  start: { taper: true },
  end: { taper: 20 }
}

describe('freehand strokes', () => {
  it('draws the same outline tldraw draws around a hard corner', () => {
    expect(rounded(freehandOutline(CORNER, CORNER_OPTIONS))).toEqual([
      [0, -4.9249],
      [16.8629, -4.154],
      [28.53, 5.175],
      [34.8897, 20.995],
      [30.209, 30.7325],
      [23.1131, 41.8983],
      [21.0713, 43.4853],
      [18.4906, 43.3191],
      [16.6692, 41.4834],
      [16.5232, 38.9015],
      [18.1261, 36.8722],
      [20.6716, 36.4162],
      [22.8792, 37.7629],
      [23.6386, 40.2348],
      [22.5678, 42.5887],
      [20.2053, 43.6404],
      [17.7396, 42.861],
      [16.4108, 40.6424],
      [16.8875, 38.1007],
      [16.8869, 38.1017],
      [28.2587, 21.044],
      [23.148, 11.025],
      [15.5371, 4.154],
      [0, 4.9249],
      [-2.4625, 4.265],
      [-4.2651, 2.4623],
      [-4.9249, -0.0002],
      [-4.2649, -2.4627],
      [-2.4621, -4.2653],
      [0.0005, -4.9249]
    ])
  })

  it('tapers both ends to a point rather than capping them', () => {
    expect(rounded(freehandOutline(RUN, TAPER_OPTIONS))).toEqual([
      [0.0045, -0.0089],
      [38.27, 13.6795],
      [57.0259, 14.9188],
      [80.0008, 19.99],
      [80, 20],
      [79.9992, 20.01],
      [56.4975, 21.1223],
      [36.2952, 19.0431],
      [17.2635, 11.0754],
      [-0.0045, 0.0089]
    ])
  })

  it('draws a dot for a stroke too short to have a body', () => {
    const outline = freehandOutline(
      points([
        [0, 0],
        [2, 1]
      ]),
      { size: 10, thinning: 0.5, streamline: 0.64, smoothing: 0.62, simulatePressure: true, last: true }
    )
    expect(rounded(outline)).toEqual([
      [4.8297, -1.294],
      [4.8296, 1.2943],
      [3.5354, 3.5357],
      [1.2938, 4.8297],
      [-1.2945, 4.8295],
      [-3.5359, 3.5352],
      [-4.8298, 1.2935],
      [-4.8295, -1.2947],
      [-3.535, -3.5361],
      [-1.2933, -4.8298],
      [1.295, -4.8294],
      [3.5362, -3.5348]
    ])
  })

  it('strips the points bunched at either end of the input', () => {
    const bunched = points([
      [0, 0],
      [0.5, 0.2],
      [0.4, 0.6],
      [40, 20],
      [80, 40],
      [80.3, 40.2],
      [80.1, 40.4]
    ])
    const centerline = freehandCenterline(bunched, {
      size: 16,
      streamline: 0.64,
      simulatePressure: true,
      last: true
    })
    expect(centerline.length).toBe(3)
    expect(centerline[0].x).toBe(0)
    expect(centerline[centerline.length - 1].x).toBeCloseTo(80.1, 6)
  })

  it('grows the radius with pressure rather than shrinking it', () => {
    const straight = points([
      [0, 0],
      [30, 0],
      [60, 0],
      [90, 0]
    ])
    const options = { size: 20, thinning: 0.5, streamline: 0.5, smoothing: 0.5, simulatePressure: false, last: true }
    const soft = freehandOutline(
      straight.map(point => ({ ...point, z: 0.2 })),
      options
    )
    const hard = freehandOutline(
      straight.map(point => ({ ...point, z: 1 })),
      options
    )
    const spread = (outline: { y: number }[]) =>
      Math.max(...outline.map(point => point.y)) - Math.min(...outline.map(point => point.y))
    expect(spread(hard)).toBeGreaterThan(spread(soft))
    expect(spread(hard)).toBeCloseTo(20, 1)
  })
})

describe('freehand options', () => {
  it('runs a pen on real pressure and a finger on simulated pressure', () => {
    const pen = freehandOptions({ dash: 'draw', isPen: true, isComplete: true }, 10, false, false)
    const finger = freehandOptions({ dash: 'draw', isPen: false, isComplete: true }, 10, false, false)
    expect(pen).toMatchObject({ size: 13, thinning: 0.62, streamline: 0.62, simulatePressure: false })
    expect(finger).toMatchObject({ size: 10, thinning: 0.5, smoothing: 0.62, simulatePressure: true })
    expect(finger.streamline).toBeCloseTo(0.6486, 4)
  })

  it('keeps a pen on the plain solid settings when the dash is not draw', () => {
    const dashed = freehandOptions({ dash: 'dashed', isPen: true, isComplete: true }, 10, false, false)
    const forced = freehandOptions({ dash: 'draw', isPen: true, isComplete: true }, 10, false, true)
    expect(dashed.streamline).toBeCloseTo(0.6486, 4)
    expect(forced.streamline).toBe(0.62)
    expect(dashed.thinning).toBe(0)
    expect(forced.thinning).toBe(0)
  })

  it('clamps the streamline of a very wide or very narrow stroke', () => {
    expect(freehandOptions({ dash: 'solid', isPen: false, isComplete: true }, 2, false, false).streamline).toBe(0.64)
    expect(freehandOptions({ dash: 'solid', isPen: false, isComplete: true }, 40, false, false).streamline).toBe(0.74)
  })

  it('draws a highlighter one wider than its stroke and never thins it', () => {
    expect(highlightOptions(16, true)).toEqual({
      size: 17,
      thinning: 0,
      streamline: 0.5,
      smoothing: 0.5,
      simulatePressure: false,
      easing: expect.any(Function),
      last: true
    })
  })
})
