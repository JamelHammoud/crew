import type { Corner, NodeShape } from '../../../shared/designNode'

export interface UnitPoint {
  x: number
  y: number
}

function fitBox(points: UnitPoint[]): UnitPoint[] {
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const width = Math.max(...xs) - left
  const height = Math.max(...ys) - top
  return points.map(point => ({ x: (point.x - left) / width, y: (point.y - top) / height }))
}

function ring(count: number, inner: number | null): UnitPoint[] {
  const total = inner === null ? count : count * 2
  const points: UnitPoint[] = []
  for (let at = 0; at < total; at++) {
    const angle = (at / total) * Math.PI * 2 - Math.PI / 2
    const radius = inner === null || at % 2 === 0 ? 1 : inner
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  }
  return fitBox(points)
}

const POLYGONS: Partial<Record<NodeShape, UnitPoint[]>> = {
  triangle: [
    { x: 0.5, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }
  ],
  diamond: [
    { x: 0.5, y: 0 },
    { x: 1, y: 0.5 },
    { x: 0.5, y: 1 },
    { x: 0, y: 0.5 }
  ],
  pentagon: ring(5, null),
  hexagon: ring(6, null),
  star: ring(5, 0.382)
}

export function nodePolygon(shape: NodeShape): UnitPoint[] | null {
  return POLYGONS[shape] ?? null
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function polygonClip(points: UnitPoint[]): string {
  return `polygon(${points.map(point => `${round(point.x * 100)}% ${round(point.y * 100)}%`).join(', ')})`
}

export function polygonPath(points: UnitPoint[], w: number, h: number): string {
  const steps = points.map((point, at) => `${at === 0 ? 'M' : 'L'}${round(point.x * w)} ${round(point.y * h)}`)
  return `${steps.join(' ')} Z`
}

const ARC_STEPS = 6
const ELLIPSE_STEPS = 48

function arc(cx: number, cy: number, rx: number, ry: number, from: number): UnitPoint[] {
  const points: UnitPoint[] = []
  for (let step = 0; step <= ARC_STEPS; step++) {
    const angle = from + (step / ARC_STEPS) * (Math.PI / 2)
    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry })
  }
  return points
}

function roundedBox(w: number, h: number, radius: Corner): UnitPoint[] {
  const limit = Math.min(w, h) / 2
  const [tl, tr, br, bl] = radius.map(part => Math.max(0, Math.min(part, limit)))
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ]
  }
  return [
    ...arc(w - tr, tr, tr, tr, -Math.PI / 2),
    ...arc(w - br, h - br, br, br, 0),
    ...arc(bl, h - bl, bl, bl, Math.PI / 2),
    ...arc(tl, tl, tl, tl, Math.PI)
  ]
}

function ellipseRing(w: number, h: number): UnitPoint[] {
  const points: UnitPoint[] = []
  for (let step = 0; step < ELLIPSE_STEPS; step++) {
    const angle = (step / ELLIPSE_STEPS) * Math.PI * 2
    points.push({ x: (w / 2) * (1 + Math.cos(angle)), y: (h / 2) * (1 + Math.sin(angle)) })
  }
  return points
}

// The outline a node clips its children to, in the node's own coordinates.
export function nodeOutline(shape: NodeShape, w: number, h: number, radius: Corner): UnitPoint[] {
  if (shape === 'ellipse') return ellipseRing(w, h)
  const points = nodePolygon(shape)
  if (points) return points.map(point => ({ x: point.x * w, y: point.y * h }))
  return roundedBox(w, h, radius)
}
