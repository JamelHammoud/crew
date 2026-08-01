import { Vec, type VecLike } from '../../math/Vec'
import {
  MIN_PRESSURE,
  RATE_OF_PRESSURE_CHANGE,
  easeOutCubic,
  easeOutQuad,
  linear,
  resolveTaper,
  type StrokeOptions,
  type StrokePoint
} from './types'

interface Staged {
  x: number
  y: number
  z: number
}

function pressureOf(point: VecLike, clamp: boolean): number {
  const z = point.z === undefined ? 1 : point.z
  return clamp && z < MIN_PRESSURE ? MIN_PRESSURE : z
}

function stage(input: readonly VecLike[], size: number, simulatePressure: boolean): { points: Staged[]; trimmed: number } {
  const minDistance = (size / 3) ** 2
  const clamp = !simulatePressure
  const first = input[0]
  let firstPressure = pressureOf(first, clamp)
  let start = 1
  while (start < input.length) {
    const point = input[start]
    const dx = point.x - first.x
    const dy = point.y - first.y
    if (dx * dx + dy * dy > minDistance) break
    firstPressure = Math.max(firstPressure, pressureOf(point, clamp))
    start++
  }

  const points: Staged[] = [{ x: first.x, y: first.y, z: firstPressure }]
  for (let index = start; index < input.length; index++) {
    const point = input[index]
    points.push({ x: point.x, y: point.y, z: pressureOf(point, clamp) })
  }

  let trimmed = 0
  if (points.length > 1) {
    const last = points[points.length - 1]
    let index = points.length - 2
    while (index >= 0) {
      const dx = points[index].x - last.x
      const dy = points[index].y - last.y
      if (dx * dx + dy * dy > minDistance) break
      index--
      trimmed++
    }
    if (index < points.length - 2) points.splice(index + 1, points.length - index - 1, last)
  }

  return { points, trimmed }
}

function spread(points: Staged[]): Staged[] {
  const [from, to] = points
  const filled: Staged[] = [from]
  for (let index = 1; index < 5; index++) {
    const along = index / 4
    filled.push({
      x: from.x + (to.x - from.x) * along,
      y: from.y + (to.y - from.y) * along,
      z: ((from.z + (to.z - from.z)) * index) / 4
    })
  }
  return filled
}

export function strokePoints(input: readonly VecLike[], options: StrokeOptions = {}): StrokePoint[] {
  const { streamline = 0.5, size = 16, simulatePressure = false } = options
  if (input.length === 0) return []

  const t = 0.15 + (1 - streamline) * 0.85
  const staged = stage(input, size, simulatePressure)
  let points = staged.points

  const isComplete =
    options.last === true ||
    !simulatePressure ||
    (points.length > 1 &&
      (points[points.length - 1].x - points[points.length - 2].x) ** 2 +
        (points[points.length - 1].y - points[points.length - 2].y) ** 2 <
        size ** 2) ||
    staged.trimmed > 0

  if (points.length === 2 && simulatePressure) points = spread(points)
  if (isComplete && streamline > 0) points = [...points, points[points.length - 1]]

  const first = points[0]
  const out: StrokePoint[] = [
    {
      point: new Vec(first.x, first.y, first.z),
      input: new Vec(first.x, first.y, first.z),
      pressure: simulatePressure ? 0.5 : first.z,
      distance: 0,
      runningLength: 0,
      radius: 1,
      isCap: true
    }
  ]

  const blend = 1 - t
  let totalLength = 0
  let previousX = first.x
  let previousY = first.y

  for (let index = 1; index < points.length; index++) {
    const staging = points[index]
    const smoothed = !t || (options.last === true && index === points.length - 1)
    const x = smoothed ? staging.x : staging.x + (previousX - staging.x) * blend
    const y = smoothed ? staging.y : staging.y + (previousY - staging.y) * blend
    if (Math.abs(previousX - x) < 0.0001 && Math.abs(previousY - y) < 0.0001) continue

    const distance = ((y - previousY) ** 2 + (x - previousX) ** 2) ** 0.5
    totalLength += distance
    if (index < 4 && totalLength < size) continue

    out.push({
      point: new Vec(x, y, staging.z),
      input: new Vec(staging.x, staging.y, staging.z),
      pressure: simulatePressure ? 0.5 : staging.z,
      distance,
      runningLength: totalLength,
      radius: 1,
      isCap: false
    })
    previousX = x
    previousY = y
  }

  if (totalLength < 1) {
    let highest = 0.5
    for (const point of out) highest = Math.max(highest, point.pressure)
    for (const point of out) point.pressure = highest
  }

  out[out.length - 1].isCap = true
  return out
}

export function computeRadii(points: StrokePoint[], options: StrokeOptions): void {
  const {
    size = 16,
    thinning = 0.5,
    simulatePressure = true,
    easing = linear,
    start = {},
    end = {}
  } = options
  if (points.length === 0) return

  const taperStartEase = start.easing ?? easeOutQuad
  const taperEndEase = end.easing ?? easeOutCubic
  const totalLength = points[points.length - 1].runningLength

  if (!simulatePressure && totalLength < size) {
    let highest = 0.5
    for (const point of points) highest = Math.max(highest, point.pressure)
    const radius = size * easing(0.5 - thinning * (0.5 - highest))
    for (const point of points) {
      point.pressure = highest
      point.radius = radius
    }
    return
  }

  let previousPressure = points[0].pressure
  for (const point of points) {
    if (point.runningLength > size * 5) break
    const speed = Math.min(1, point.distance / size)
    const next = simulatePressure
      ? Math.min(1, previousPressure + (Math.min(1, 1 - speed) - previousPressure) * (speed * RATE_OF_PRESSURE_CHANGE))
      : Math.min(1, previousPressure + (point.pressure - previousPressure) * 0.5)
    previousPressure = previousPressure + (next - previousPressure) * 0.5
  }

  const taperStart = resolveTaper(start.taper, size, totalLength)
  const taperEnd = resolveTaper(end.taper, size, totalLength)
  const tapered = taperStart || taperEnd

  for (const point of points) {
    let radius: number
    if (thinning) {
      const speed = Math.min(1, point.distance / size)
      const pressure = simulatePressure
        ? Math.min(1, previousPressure + (Math.min(1, 1 - speed) - previousPressure) * (speed * RATE_OF_PRESSURE_CHANGE))
        : Math.min(1, previousPressure + (point.pressure - previousPressure) * (speed * RATE_OF_PRESSURE_CHANGE))
      radius = size * easing(0.5 - thinning * (0.5 - pressure))
      previousPressure = pressure
    } else {
      radius = size / 2
    }

    if (tapered) {
      const run = point.runningLength
      const fromStart = run < taperStart ? taperStartEase(run / taperStart) : 1
      const toEnd = totalLength - run < taperEnd ? taperEndEase((totalLength - run) / taperEnd) : 1
      radius = Math.max(0.01, radius * Math.min(fromStart, toEnd))
    }

    point.radius = radius
  }
}
