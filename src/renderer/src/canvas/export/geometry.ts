import type { ExportBounds, ExportShape } from './types'

export interface Point {
  x: number
  y: number
}

export type Matrix = [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

export function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function positive(value: unknown, fallback = 1): number {
  const number = finite(value, fallback)
  return number > 0 ? number : fallback
}

export function matrixFor(shape: ExportShape): Matrix {
  const angle = finite(shape.rotation)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [cos, sin, -sin, cos, finite(shape.x), finite(shape.y)]
}

export function multiply(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ]
}

export function applyMatrix(matrix: Matrix, point: Point): Point {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5]
  }
}

export function matrixText(matrix: Matrix): string {
  return `matrix(${matrix.map(round).join(' ')})`
}

export function boxFromPoints(points: Point[]): ExportBounds | null {
  if (points.length === 0) return null
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function transformBounds(bounds: ExportBounds, matrix: Matrix): ExportBounds {
  return boxFromPoints([
    applyMatrix(matrix, { x: bounds.x, y: bounds.y }),
    applyMatrix(matrix, { x: bounds.x + bounds.w, y: bounds.y }),
    applyMatrix(matrix, { x: bounds.x + bounds.w, y: bounds.y + bounds.h }),
    applyMatrix(matrix, { x: bounds.x, y: bounds.y + bounds.h })
  ])!
}

export function unionBounds(left: ExportBounds | null, right: ExportBounds | null): ExportBounds | null {
  if (!left) return right ? { ...right } : null
  if (!right) return { ...left }
  const x = Math.min(left.x, right.x)
  const y = Math.min(left.y, right.y)
  const maxX = Math.max(left.x + left.w, right.x + right.w)
  const maxY = Math.max(left.y + left.h, right.y + right.h)
  return { x, y, w: maxX - x, h: maxY - y }
}

export function expandBounds(bounds: ExportBounds, amount: number): ExportBounds {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    w: bounds.w + amount * 2,
    h: bounds.h + amount * 2
  }
}

export function pointsBounds(points: Point[], padding = 0): ExportBounds | null {
  const box = boxFromPoints(points)
  return box ? expandBounds(box, padding) : null
}

export function round(value: number): string {
  const clean = Math.abs(value) < 0.000001 ? 0 : Math.round(value * 1000) / 1000
  return String(clean)
}

export function polygonPoints(count: number, w: number, h: number, inner?: number): Point[] {
  const total = inner === undefined ? count : count * 2
  const raw: Point[] = []
  for (let index = 0; index < total; index++) {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2
    const radius = inner === undefined || index % 2 === 0 ? 1 : inner
    raw.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  }
  const bounds = boxFromPoints(raw)!
  return raw.map(point => ({
    x: ((point.x - bounds.x) / bounds.w) * w,
    y: ((point.y - bounds.y) / bounds.h) * h
  }))
}

export function pointsPath(points: Point[], close = true): string {
  if (points.length === 0) return ''
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join(' ')}${close ? ' Z' : ''}`
}
