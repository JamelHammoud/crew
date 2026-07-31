import { Vec, type VecLike } from '../math/Vec'

export interface StrokeOptions {
  size?: number
  thinning?: number
  smoothing?: number
  streamline?: number
  easing?(pressure: number): number
  simulatePressure?: boolean
  start?: { cap?: boolean; taper?: number | boolean; easing?(distance: number): number }
  end?: { cap?: boolean; taper?: number | boolean; easing?(distance: number): number }
  last?: boolean
}

const linear = (value: number) => value
const easeOutSine = (value: number) => Math.sin((value * Math.PI) / 2)
const penEasing = (value: number) => value * 0.65 + Math.sin((value * Math.PI) / 2) * 0.35

function modulate(value: number, from: [number, number], to: [number, number]): number {
  return Math.max(to[0], Math.min(to[1], to[0] + (to[1] - to[0]) * ((value - from[0]) / (from[1] - from[0]))))
}

export function freehandOptions(
  props: { dash: string; isPen: boolean; isComplete: boolean },
  strokeWidth: number,
  forceComplete: boolean,
  forceSolid: boolean
): StrokeOptions {
  const last = props.isComplete || forceComplete
  if (forceSolid || props.dash !== 'draw') {
    return {
      size: strokeWidth,
      thinning: 0,
      streamline: props.isPen ? 0.62 : modulate(strokeWidth, [9, 16], [0.64, 0.74]),
      smoothing: 0.62,
      simulatePressure: false,
      easing: linear,
      last
    }
  }
  return props.isPen
    ? {
        size: 1 + strokeWidth * 1.2,
        thinning: 0.62,
        streamline: 0.62,
        smoothing: 0.62,
        simulatePressure: false,
        easing: penEasing,
        last
      }
    : {
        size: strokeWidth,
        thinning: 0.5,
        streamline: modulate(strokeWidth, [9, 16], [0.64, 0.74]),
        smoothing: 0.62,
        simulatePressure: true,
        easing: easeOutSine,
        last
      }
}

export function highlightOptions(strokeWidth: number, showAsComplete: boolean): StrokeOptions {
  return {
    size: 1 + strokeWidth,
    thinning: 0,
    streamline: 0.5,
    smoothing: 0.5,
    simulatePressure: false,
    easing: easeOutSine,
    last: showAsComplete
  }
}

interface StrokePoint {
  point: Vec
  pressure: number
  distance: number
  runningLength: number
  vector: Vec
}

function strokePoints(input: readonly VecLike[], options: StrokeOptions): StrokePoint[] {
  if (input.length === 0) return []
  const streamline = options.streamline ?? 0.5
  const t = 0.15 + (1 - streamline) * 0.85
  const source = input.length === 1 ? [input[0], { x: input[0].x + 1, y: input[0].y + 1, z: input[0].z }] : input
  const points: StrokePoint[] = []
  let previous = Vec.From(source[0])
  let runningLength = 0
  for (let index = 0; index < source.length; index++) {
    const raw = Vec.From(source[index])
    const point = index === 0 ? raw : previous.clone().lrp(raw, t)
    const distance = index === 0 ? 0 : Vec.Dist(point, previous)
    if (index > 0 && distance < 0.01 && index < source.length - 1) continue
    runningLength += distance
    const vector = index === 0 ? new Vec(1, 1).uni() : previous.clone().sub(point).uni()
    points.push({ point, pressure: raw.z ?? 0.5, distance, runningLength, vector })
    previous = point
  }
  if (points.length > 1) points[0].vector = points[1].vector.clone()
  return points
}

export function freehandCenterline(input: readonly VecLike[], options: StrokeOptions = {}): Vec[] {
  return strokePoints(input, options).map(point => point.point)
}

function taperValue(value: number | boolean | undefined, totalLength: number): number {
  if (value === true) return Math.max(totalLength, 1)
  return typeof value === 'number' ? Math.max(0, value) : 0
}

export function freehandOutline(input: readonly VecLike[], options: StrokeOptions = {}): Vec[] {
  const points = strokePoints(input, options)
  if (points.length === 0) return []
  const size = options.size ?? 16
  const thinning = options.thinning ?? 0.5
  const smoothing = options.smoothing ?? 0.5
  const easing = options.easing ?? linear
  const simulate = options.simulatePressure ?? true
  const totalLength = points[points.length - 1].runningLength
  const startTaper = taperValue(options.start?.taper, totalLength)
  const endTaper = taperValue(options.end?.taper, totalLength)
  const startEase = options.start?.easing ?? linear
  const endEase = options.end?.easing ?? linear
  const left: Vec[] = []
  const right: Vec[] = []
  let simulatedPressure = 0.25
  let previousLeft: Vec | undefined
  let previousRight: Vec | undefined
  for (let index = 0; index < points.length; index++) {
    const current = points[index]
    if (simulate) {
      const target = Math.min(1, 1 - current.distance / Math.max(size, 1))
      simulatedPressure = Math.min(1, simulatedPressure + (target - simulatedPressure) * 0.275)
    }
    const pressure = simulate ? simulatedPressure : current.pressure
    let radius = Math.max(0.01, (size / 2) * (1 - thinning * (0.5 - easing(pressure))))
    if (startTaper > 0) radius *= startEase(Math.min(1, current.runningLength / startTaper))
    if (endTaper > 0) radius *= endEase(Math.min(1, (totalLength - current.runningLength) / endTaper))
    const nextVector = points[Math.min(points.length - 1, index + 1)].vector
    const direction = current.vector.clone().add(nextVector).uni()
    const normal = new Vec(-direction.y, direction.x)
    let leftPoint = current.point.clone().add(normal.clone().mul(radius))
    let rightPoint = current.point.clone().sub(normal.clone().mul(radius))
    if (previousLeft) leftPoint = previousLeft.clone().lrp(leftPoint, 0.5 + smoothing * 0.5)
    if (previousRight) rightPoint = previousRight.clone().lrp(rightPoint, 0.5 + smoothing * 0.5)
    if (!previousLeft || Vec.Dist2(previousLeft, leftPoint) > 0.04) left.push(leftPoint)
    if (!previousRight || Vec.Dist2(previousRight, rightPoint) > 0.04) right.push(rightPoint)
    previousLeft = leftPoint
    previousRight = rightPoint
  }
  const first = points[0].point
  const last = points[points.length - 1].point
  const startCap: Vec[] = []
  const endCap: Vec[] = []
  const startRadius = Vec.Dist(first, left[0] ?? first)
  const endRadius = Vec.Dist(last, left[left.length - 1] ?? last)
  if (options.start?.cap === false || startTaper > 0) startCap.push(right[0] ?? first, left[0] ?? first)
  else {
    const origin = right[0] ?? first
    for (let step = 1; step < 10; step++) startCap.push(origin.clone().rotWith(first, (Math.PI * step) / 9))
  }
  if (options.end?.cap === false || endTaper > 0 || !options.last)
    endCap.push(left[left.length - 1] ?? last, right[right.length - 1] ?? last)
  else {
    const origin = left[left.length - 1] ?? last
    for (let step = 1; step < 10; step++) endCap.push(origin.clone().rotWith(last, (Math.PI * step) / 9))
  }
  if (input.length === 1 || totalLength < Math.max(startRadius, endRadius)) {
    return Array.from(
      { length: 16 },
      (_, index) =>
        new Vec(
          first.x + Math.cos((index * Math.PI * 2) / 16) * Math.max(startRadius, size / 2),
          first.y + Math.sin((index * Math.PI * 2) / 16) * Math.max(startRadius, size / 2)
        )
    )
  }
  return [...left, ...endCap, ...right.reverse(), ...startCap]
}
