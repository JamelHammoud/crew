import { seeded } from '../../../../shared/art'
import { CIRCLE, DIAGONAL, GRID, SQUARE } from '../../icons/keylines'

// The silhouette a helper's mark is seen through, worked out from its id the way
// a cover's scene is. It is kept apart from the drawing for the same reason: a
// generator like this is held to its rules by a test, and a test cannot read a
// canvas.

export type ShapeKind = 'rosette' | 'disc' | 'square' | 'hexagon'

export interface SubagentShape {
  kind: ShapeKind
  // How many lobes stand out around a rosette. Nothing else has any.
  lobes: number
  // How far they stand out, as a share of the mean radius.
  depth: number
  // The whole shape turned, so two roles with the same count are still two
  // marks.
  twist: number
  // Half of what the shape spans on its own keyline. Equal on the ruler is not
  // equal to the eye, which is the whole reason a circle is not 17, and this
  // obeys the same numbers: a lobed mark is a pointy form and takes the live
  // area the way the star does, a disc and a hexagon sit on the circle keyline,
  // and a square sits on the square.
  radius: number
}

export const MIN_LOBES = 3
export const MAX_LOBES = 8

const OUTER: Record<ShapeKind, number> = {
  rosette: DIAGONAL,
  disc: CIRCLE,
  hexagon: CIRCLE,
  square: SQUARE
}

// The narrowest a waist between two lobes may get, said as a share of the tip.
// Under about half of it the mark stops being one shape and reads as scattered
// dots at 18 across, which is the size most of them are worn at.
export const MIN_WAIST = 0.52

// More lobes at the same depth is a tighter waist between each pair, so how far
// they may stand out comes down as they multiply.
const deepest = (lobes: number): number =>
  ((1 - MIN_WAIST) / (1 + MIN_WAIST)) * (1 - (lobes - MIN_LOBES) * 0.07)

// A page of flowers is a page of flowers. The covers hold the same rule with
// their six casts, and it is what stops every mark being the same picture in a
// different color.
function kindOf(id: string): ShapeKind {
  const roll = seeded(id, 'kind')
  if (roll < 0.72) return 'rosette'
  if (roll < 0.82) return 'disc'
  if (roll < 0.91) return 'square'
  return 'hexagon'
}

export function subagentShape(id: string): SubagentShape {
  const kind = kindOf(id)
  const lobes = kind === 'rosette' ? MIN_LOBES + Math.floor(seeded(id, 'lobes') * (MAX_LOBES - MIN_LOBES + 1)) : 0
  const depth = kind === 'rosette' ? 0.12 + seeded(id, 'depth') * (deepest(lobes) - 0.12) : 0
  return {
    kind,
    lobes: Math.min(lobes, MAX_LOBES),
    depth,
    twist: seeded(id, 'twist') * Math.PI * 2,
    radius: OUTER[kind] / 2
  }
}

// The lobes stand out and in around a mean, and the furthest of them lands on
// the keyline rather than past it. Grown outward from the mean instead, a deep
// rosette paints past the box and is cut off flat at the four sides.
export function radiusAt(shape: SubagentShape, angle: number): number {
  if (shape.kind !== 'rosette') return shape.radius
  const wave = 1 + shape.depth * Math.cos(shape.lobes * (angle + shape.twist))
  return (shape.radius * wave) / (1 + shape.depth)
}

const SAMPLES_PER_LOBE = 10

const at = (shape: SubagentShape, angle: number, box: number): [number, number] => {
  const r = (radiusAt(shape, angle) / GRID) * box
  return [box / 2 + Math.cos(angle) * r, box / 2 + Math.sin(angle) * r]
}

const round = (n: number): number => Math.round(n * 1000) / 1000

// Closed with quadratics through the midpoints, the way the pet's body is, so
// nothing anywhere in the set has a corner in it that was not asked for.
function smooth(points: Array<[number, number]>): string {
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const count = points.length
  let path = `M ${mid(points[count - 1], points[0]).map(round).join(' ')}`
  for (let i = 0; i < count; i++) {
    const next = points[(i + 1) % count]
    path += ` Q ${points[i].map(round).join(' ')} ${mid(points[i], next).map(round).join(' ')}`
  }
  return `${path} Z`
}

// The outline as a path on a box of the size it is asked for, so the one shape
// answers the mark, the clip and the sheet without any of them knowing how it
// was worked out.
export function shapePath(shape: SubagentShape, box: number = GRID): string {
  const half = box / 2
  const unit = (r: number): number => (r / GRID) * box
  if (shape.kind === 'disc') {
    const r = round(unit(shape.radius))
    return `M ${round(half - r)} ${round(half)} a ${r} ${r} 0 1 0 ${round(r * 2)} 0 a ${r} ${r} 0 1 0 ${round(-r * 2)} 0 Z`
  }
  if (shape.kind === 'square') {
    const side = unit(shape.radius * 2)
    const edge = half - side / 2
    // A squarer corner than the app's cards wear. This is a mark rather than a
    // surface, and a heavily rounded square at 18 across is a disc.
    const r = round(side * 0.28)
    const run = round(side - r * 2)
    return [
      `M ${round(edge + r)} ${round(edge)}`,
      `h ${run}`,
      `a ${r} ${r} 0 0 1 ${r} ${r}`,
      `v ${run}`,
      `a ${r} ${r} 0 0 1 ${round(-r)} ${r}`,
      `h ${round(-run)}`,
      `a ${r} ${r} 0 0 1 ${round(-r)} ${round(-r)}`,
      `v ${round(-run)}`,
      `a ${r} ${r} 0 0 1 ${r} ${round(-r)}`,
      `Z`
    ].join(' ')
  }
  if (shape.kind === 'hexagon') {
    const points = Array.from({ length: 6 }, (_, i) => at(shape, shape.twist + (i / 6) * Math.PI * 2, box))
    return `M ${points.map(point => point.map(round).join(' ')).join(' L ')} Z`
  }
  const count = shape.lobes * SAMPLES_PER_LOBE
  return smooth(Array.from({ length: count }, (_, i) => at(shape, (i / count) * Math.PI * 2, box)))
}
