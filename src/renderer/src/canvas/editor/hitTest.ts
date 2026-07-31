import type { Box, Vec } from '../math'
import type { Geometry2d } from '../geometry'
import { Group2d } from '../geometry'
import { pointInPolygon } from '../math'
import type { TLShape, TLShapeId } from '../schema'

export interface HitTestOptions {
  margin?: number | [number, number]
  hitInside?: boolean
  hitLabels?: boolean
  hitLocked?: boolean
  hitFrameInside?: boolean
  renderingOnly?: boolean
  filter?: (shape: TLShape) => boolean
}

export interface HitTestHost {
  hitTestMargin: number
  getZoomLevel(): number
  getViewportPageBounds(): Box
  getCurrentPageShapesSorted(): TLShape[]
  getCurrentPageRenderingShapesSorted(): TLShape[]
  getShapeGeometry(shape: TLShape): Geometry2d
  getPointInShapeSpace(shape: TLShape, point: Vec): Vec
  getShapeMask(shape: TLShape): Vec[] | undefined
  getShapePageBounds(shape: TLShape): Box | undefined
  getShapeText(shape: TLShape): string | undefined
  isShapeFrameLike(shape: TLShape): boolean
  isShapeHidden(shape: TLShape): boolean
  isShapeOfType(shape: TLShape, type: string): boolean
  candidatesAtPoint(point: Vec, margin: number): Set<TLShapeId> | null
}

function wantsLabelFirst(host: HitTestHost, shape: TLShape): boolean {
  if (host.isShapeFrameLike(shape)) return true
  const labelled =
    host.isShapeOfType(shape, 'note') ||
    host.isShapeOfType(shape, 'arrow') ||
    (host.isShapeOfType(shape, 'geo') && (shape.props as { fill?: string }).fill === 'none')
  return labelled && Boolean(host.getShapeText(shape)?.trim())
}

function groupDistance(geometry: Group2d, point: Vec, hitInside: boolean, hitLabels: boolean): number {
  let nearest = Infinity
  for (const child of geometry.children) {
    if (child.isLabel && !hitLabels) continue
    const distance = child.distanceToPoint(point, hitInside)
    if (distance < nearest) nearest = distance
  }
  return nearest
}

function plainDistance(geometry: Geometry2d, point: Vec, hitInside: boolean, outerMargin: number): number {
  if (outerMargin === 0 && (geometry.bounds.w < 1 || geometry.bounds.h < 1)) {
    return geometry.distanceToPoint(point, hitInside)
  }
  if (geometry.bounds.containsPoint(point, outerMargin)) {
    return geometry.distanceToPoint(point, hitInside)
  }
  return Infinity
}

export function getShapeAtPoint(host: HitTestHost, point: Vec, opts: HitTestOptions = {}): TLShape | undefined {
  const zoom = host.getZoomLevel()
  const viewport = host.getViewportPageBounds()
  const { filter, margin = 0, hitLocked = false, hitLabels = false, hitInside = false, hitFrameInside = false } = opts
  const [innerMargin, outerMargin] = Array.isArray(margin) ? margin : [margin, margin]

  let smallestHollowArea = Infinity
  let smallestHollowHit: TLShape | undefined
  let closestEdgeDistance = Infinity
  let closestEdgeHit: TLShape | undefined

  const searchMargin = Math.max(innerMargin, outerMargin, host.hitTestMargin / zoom)
  const candidates = host.candidatesAtPoint(point, searchMargin)
  const sorted = opts.renderingOnly ? host.getCurrentPageRenderingShapesSorted() : host.getCurrentPageShapesSorted()

  const checking = sorted.filter(shape => {
    if (candidates && !candidates.has(shape.id) && !host.isShapeFrameLike(shape)) return false
    if ((shape.isLocked && !hitLocked) || host.isShapeHidden(shape) || host.isShapeOfType(shape, 'group')) {
      return false
    }
    const mask = host.getShapeMask(shape)
    if (mask && !pointInPolygon(point, mask)) return false
    if (filter && !filter(shape)) return false
    return true
  })

  for (let at = checking.length - 1; at >= 0; at--) {
    const shape = checking[at]
    const geometry = host.getShapeGeometry(shape)
    const isGroup = geometry instanceof Group2d
    const inShape = host.getPointInShapeSpace(shape, point)
    const frameLike = host.isShapeFrameLike(shape)

    if (wantsLabelFirst(host, shape) && geometry instanceof Group2d) {
      for (const child of geometry.children) {
        if (child.isLabel && child.isPointInBounds(inShape)) return shape
      }
    }

    if (frameLike) {
      const distance = geometry.distanceToPoint(inShape, hitFrameInside)
      const onEdge = hitFrameInside
        ? (distance > 0 && distance <= outerMargin) || (distance <= 0 && distance > -innerMargin)
        : distance > 0 && distance <= outerMargin
      if (onEdge) return closestEdgeHit ?? shape
      if (geometry.hitTestPoint(inShape, 0, true)) {
        return closestEdgeHit ?? smallestHollowHit ?? (hitFrameInside ? shape : undefined)
      }
      continue
    }

    const distance =
      isGroup && geometry instanceof Group2d
        ? groupDistance(geometry, inShape, hitInside, hitLabels)
        : plainDistance(geometry, inShape, hitInside, outerMargin)

    if (!geometry.isClosed) {
      if (distance < host.hitTestMargin / zoom) return shape
      continue
    }

    const within = distance <= outerMargin || (hitInside && distance <= 0 && distance > -innerMargin)
    if (!within) continue

    const filled = geometry.isFilled || (isGroup && (geometry as Group2d).children[0]?.isFilled)
    if (filled) {
      if (geometry.ignoreHit(inShape)) continue
      return closestEdgeHit ?? shape
    }

    if (host.getShapePageBounds(shape)?.contains(viewport)) continue

    const inMargin = hitInside
      ? (distance > 0 && distance <= outerMargin) || (distance <= 0 && distance > -innerMargin)
      : Math.abs(distance) <= Math.max(innerMargin, outerMargin)

    if (inMargin) {
      if (Math.abs(distance) < closestEdgeDistance) {
        closestEdgeDistance = Math.abs(distance)
        closestEdgeHit = shape
      }
    } else if (!closestEdgeHit) {
      const { area } = geometry
      if (area < smallestHollowArea) {
        smallestHollowArea = area
        smallestHollowHit = shape
      }
    }
  }

  return closestEdgeHit ?? smallestHollowHit ?? undefined
}

export function getShapesAtPoint(host: HitTestHost, point: Vec, opts: HitTestOptions = {}): TLShape[] {
  const margin = Array.isArray(opts.margin) ? Math.max(...opts.margin) : (opts.margin ?? 0)
  const candidates = host.candidatesAtPoint(point, margin)
  return host
    .getCurrentPageShapesSorted()
    .filter(shape => {
      if (host.isShapeHidden(shape)) return false
      if (candidates && !candidates.has(shape.id) && !host.isShapeFrameLike(shape)) return false
      const geometry = host.getShapeGeometry(shape)
      return geometry.hitTestPoint(host.getPointInShapeSpace(shape, point), margin, opts.hitInside ?? false)
    })
    .reverse()
}
