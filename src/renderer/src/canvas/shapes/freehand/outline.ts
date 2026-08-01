import { Vec } from '../../math/Vec'
import { resolveTaper, type StrokeOptions, type StrokePoint } from './types'

const FIXED_PI = Math.PI + 0.0001
const TRACK_TOLERANCE_RATIO = 0.05
const SIMPLIFY_WINDOW = 8
const MIN_ROUNDED_CORNER_STEPS = 8
const MAX_ROUNDED_CORNER_STEPS = 13
const MIN_CAP_STEPS = 8
const MAX_CAP_STEPS = 29
const HARD_CORNER_DPR = -0.62

function backVector(points: StrokePoint[], index: number, toward: number): Vec {
  const from = points[index].point
  const to = points[toward].point
  const dx = from.x - to.x
  const dy = from.y - to.y
  const length = (dx * dx + dy * dy) ** 0.5
  return length === 0 ? new Vec(dx, dy) : new Vec(dx / length, dy / length)
}

function simplify(track: Vec[], tolerance: number): Vec[] {
  if (track.length <= 2 || tolerance <= 0) return track
  const squared = tolerance * tolerance
  const kept = [track[0]]
  const last = track.length - 1
  let anchor = 0
  while (anchor < last) {
    let best = anchor + 1
    const limit = Math.min(anchor + SIMPLIFY_WINDOW, last)
    const from = track[anchor]
    for (let candidate = anchor + 2; candidate <= limit; candidate++) {
      const alongX = track[candidate].x - from.x
      const alongY = track[candidate].y - from.y
      const lengthSquared = alongX * alongX + alongY * alongY
      let within = true
      for (let inner = anchor + 1; inner < candidate; inner++) {
        const raw =
          lengthSquared === 0
            ? 0
            : ((track[inner].x - from.x) * alongX + (track[inner].y - from.y) * alongY) / lengthSquared
        const along = raw < 0 ? 0 : raw > 1 ? 1 : raw
        const errorX = track[inner].x - (from.x + alongX * along)
        const errorY = track[inner].y - (from.y + alongY * along)
        if (errorX * errorX + errorY * errorY > squared) {
          within = false
          break
        }
      }
      if (!within) break
      best = candidate
    }
    kept.push(track[best])
    anchor = best
  }
  return kept
}

export function strokeTracks(points: StrokePoint[], options: StrokeOptions = {}): { left: Vec[]; right: Vec[] } {
  const { size = 16, smoothing = 0.5 } = options
  const left: Vec[] = []
  const right: Vec[] = []
  const count = points.length
  if (count === 0 || size <= 0) return { left, right }

  const totalLength = points[count - 1].runningLength
  const minDistance = (size * smoothing) ** 2

  let vector = count > 1 ? backVector(points, 0, 1) : new Vec(1, 1)
  let previousVector = vector.clone()
  let previousLeft = points[0].point.clone()
  let previousRight = points[0].point.clone()
  let trackLeft = previousLeft.clone()
  let trackRight = previousRight.clone()
  let wasSharpCorner = false

  for (let index = 0; index < count; index++) {
    const { point, radius, input, isCap } = points[index]
    const current = vector
    const next = index < count - 1 ? backVector(points, index, index + 1) : current
    vector = next

    const previousDpr = current.dpr(previousVector)
    const nextDpr = index < count - 1 ? next.dpr(current) : 1
    const isSharpCorner = previousDpr < 0 && !wasSharpCorner
    const isNextSharpCorner = nextDpr < 0.2

    if (isSharpCorner || isNextSharpCorner) {
      if (nextDpr > HARD_CORNER_DPR && totalLength - points[index].runningLength > radius) {
        const offset = previousVector.clone().mul(radius)
        const turn = previousVector.x * next.y - previousVector.y * next.x
        trackLeft = turn < 0 ? point.clone().add(offset) : point.clone().sub(offset)
        trackRight = turn < 0 ? point.clone().sub(offset) : point.clone().add(offset)
        left.push(trackLeft)
        right.push(trackRight)
      } else {
        const armX = -previousVector.y * radius
        const armY = previousVector.x * radius
        for (let step = 1 / MAX_ROUNDED_CORNER_STEPS, along = 0; along < 1; along += step) {
          const forward = FIXED_PI * along
          trackLeft = new Vec(
            input.x + (armX * Math.cos(forward) - armY * Math.sin(forward)),
            input.y + (armX * Math.sin(forward) + armY * Math.cos(forward))
          )
          left.push(trackLeft)
          const backward = FIXED_PI + FIXED_PI * -along
          trackRight = new Vec(
            input.x + (armX * Math.cos(backward) - armY * Math.sin(backward)),
            input.y + (armX * Math.sin(backward) + armY * Math.cos(backward))
          )
          right.push(trackRight)
        }
      }

      previousLeft = trackLeft
      previousRight = trackRight
      if (isNextSharpCorner) wasSharpCorner = true
      continue
    }

    wasSharpCorner = false

    if (isCap) {
      const offset = new Vec(current.y * radius, -current.x * radius)
      left.push(point.clone().sub(offset))
      right.push(point.clone().add(offset))
      continue
    }

    const leaningX = next.x + (current.x - next.x) * nextDpr
    const leaningY = next.y + (current.y - next.y) * nextDpr
    const offset = new Vec(leaningY * radius, -leaningX * radius)

    trackLeft = point.clone().sub(offset)
    if (index <= 1 || Vec.Dist2(previousLeft, trackLeft) > minDistance) {
      left.push(trackLeft)
      previousLeft = trackLeft
    }

    trackRight = point.clone().add(offset)
    if (index <= 1 || Vec.Dist2(previousRight, trackRight) > minDistance) {
      right.push(trackRight)
      previousRight = trackRight
    }

    previousVector = current
  }

  const tolerance = size * TRACK_TOLERANCE_RATIO
  return { left: simplify(left, tolerance), right: simplify(right, tolerance) }
}

function arcSteps(radius: number, sweep: number, tolerance: number, min: number, max: number): number {
  if (radius <= tolerance) return min
  const widest = 2 * Math.acos(1 - tolerance / radius)
  const steps = Math.ceil(sweep / widest)
  return steps < min ? min : steps > max ? max : steps
}

export function strokeOutline(points: StrokePoint[], options: StrokeOptions = {}): Vec[] {
  const { size = 16, start = {}, end = {}, last: isComplete = false } = options
  const count = points.length
  if (count === 0 || size <= 0) return []

  const capStart = start.cap ?? true
  const capEnd = end.cap ?? true
  const totalLength = points[count - 1].runningLength
  const taperStart = resolveTaper(start.taper, size, totalLength)
  const taperEnd = resolveTaper(end.taper, size, totalLength)

  const { left, right } = strokeTracks(points, options)
  const capTolerance = Math.max(0.05, size * 0.02)
  const firstRadius = points[0].radius
  const firstPoint = points[0].point
  const lastPoint = count > 1 ? points[count - 1].point : Vec.AddXY(firstPoint, 1, 1)

  if (count === 1 && (!(taperStart || taperEnd) || isComplete)) {
    const origin = Vec.Add(firstPoint, Vec.Sub(firstPoint, lastPoint).uni().per().mul(-firstRadius))
    const steps = arcSteps(
      firstRadius,
      FIXED_PI * 2,
      capTolerance,
      MIN_ROUNDED_CORNER_STEPS,
      MAX_ROUNDED_CORNER_STEPS
    )
    const dot: Vec[] = []
    for (let step = 1 / steps, along = step; along <= 1; along += step)
      dot.push(Vec.RotWith(origin, firstPoint, FIXED_PI * 2 * along))
    return dot
  }

  const startCap: Vec[] = []
  if (taperStart || (taperEnd && count === 1)) {
    startCap.length = 0
  } else if (capStart) {
    const steps = arcSteps(firstRadius, FIXED_PI, capTolerance, 4, 8)
    for (let step = 1 / steps, along = step; along <= 1; along += step)
      startCap.push(Vec.RotWith(right[0], firstPoint, FIXED_PI * along))
  } else {
    const across = Vec.Sub(left[0], right[0])
    const half = Vec.Mul(across, 0.5)
    const past = Vec.Mul(across, 0.51)
    startCap.push(
      Vec.Sub(firstPoint, half),
      Vec.Sub(firstPoint, past),
      Vec.Add(firstPoint, past),
      Vec.Add(firstPoint, half)
    )
  }

  const endCap: Vec[] = []
  const lastRadius = points[count - 1].radius
  const lastVector = count > 1 ? backVector(points, count - 2, count - 1) : new Vec(1, 1)
  const direction = new Vec(-lastVector.y, lastVector.x)

  if (taperEnd || (taperStart && count === 1)) {
    endCap.push(lastPoint)
  } else if (capEnd) {
    const origin = Vec.Add(lastPoint, Vec.Mul(direction, lastRadius))
    const steps = arcSteps(lastRadius, FIXED_PI * 3, capTolerance, MIN_CAP_STEPS, MAX_CAP_STEPS)
    for (let step = 1 / steps, along = step; along < 1; along += step)
      endCap.push(Vec.RotWith(origin, lastPoint, FIXED_PI * 3 * along))
  } else {
    endCap.push(
      Vec.Add(lastPoint, Vec.Mul(direction, lastRadius)),
      Vec.Add(lastPoint, Vec.Mul(direction, lastRadius * 0.99)),
      Vec.Sub(lastPoint, Vec.Mul(direction, lastRadius * 0.99)),
      Vec.Sub(lastPoint, Vec.Mul(direction, lastRadius))
    )
  }

  return [...left, ...endCap, ...right.slice().reverse(), ...startCap]
}
