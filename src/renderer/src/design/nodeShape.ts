import type { NodeShape } from '../../../shared/designNode'

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
