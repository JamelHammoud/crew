import { Box, type BoxLike, type SelectionCorner, type SelectionEdge } from '../../math/Box'
import { rangeIntersection, rangesOverlap } from '../../math/utils'
import { Vec, type VecLike } from '../../math/Vec'

export interface BoundsSnapPoint {
  id: string
  x: number
  y: number
  handle?: SelectionCorner
}

export interface BoundsSnapNode {
  id: string
  pageBounds: BoxLike
  points?: readonly VecLike[]
}

export interface PointsSnapIndicator {
  id: string
  type: 'points'
  points: Vec[]
}

export interface GapsSnapIndicator {
  id: string
  type: 'gaps'
  direction: 'horizontal' | 'vertical'
  gaps: Array<{
    startEdge: [Vec, Vec]
    endEdge: [Vec, Vec]
  }>
}

export type BoundsSnapIndicator = PointsSnapIndicator | GapsSnapIndicator

export interface BoundsSnapResult {
  nudge: Vec
  indicators: BoundsSnapIndicator[]
}

export interface TranslateBoundsSnapOptions {
  initialSelectionPageBounds: BoxLike
  initialSelectionSnapPoints?: readonly BoundsSnapPoint[]
  dragDelta: VecLike
  snappableShapes: readonly BoundsSnapNode[]
  lockedAxis?: 'x' | 'y' | null
  snapThreshold?: number
  zoom?: number
}

export interface ResizeBoundsSnapOptions {
  initialSelectionPageBounds: BoxLike
  dragDelta: VecLike
  handle: SelectionCorner | SelectionEdge
  isAspectRatioLocked?: boolean
  isResizingFromCenter?: boolean
  snappableShapes: readonly BoundsSnapNode[]
  snapThreshold?: number
  zoom?: number
}

export interface BoundsSnapGapNode {
  id: string
  pageBounds: Box
}

export interface BoundsSnapGap {
  startNode: BoundsSnapGapNode
  endNode: BoundsSnapGapNode
  startEdge: [Vec, Vec]
  endEdge: [Vec, Vec]
  length: number
  breadthIntersection: [number, number]
}

interface SnapPair {
  thisPoint: BoundsSnapPoint
  otherPoint: BoundsSnapPoint
}

interface NearestPointsSnap {
  type: 'points'
  points: SnapPair
  nudge: number
}

type NearestSnap =
  | NearestPointsSnap
  | { type: 'gap_center'; gap: BoundsSnapGap; nudge: number }
  | {
      type: 'gap_duplicate'
      gap: BoundsSnapGap
      protrusionDirection: 'left' | 'right' | 'top' | 'bottom'
      nudge: number
    }

const rounded = (value: number) => Math.round(value * 1e8) / 1e8

const thresholdAtZoom = (threshold = 8, zoom = 1) => {
  if (!Number.isFinite(zoom) || zoom <= 0) return threshold
  return threshold / zoom
}

const boxFrom = (box: BoxLike) => new Box(box.x, box.y, box.w, box.h)

const pointsForNodes = (nodes: readonly BoundsSnapNode[]) =>
  nodes.flatMap(node => {
    const bounds = boxFrom(node.pageBounds)
    return (node.points ?? bounds.cornersAndCenter).map((point, index) => ({
      id: `${node.id}:${index}`,
      x: point.x,
      y: point.y
    }))
  })

const gapNodes = (nodes: readonly BoundsSnapNode[]): BoundsSnapGapNode[] =>
  nodes.map(node => ({ id: node.id, pageBounds: boxFrom(node.pageBounds) }))

export function getVisibleGaps(nodes: readonly BoundsSnapNode[]): {
  horizontal: BoundsSnapGap[]
  vertical: BoundsSnapGap[]
} {
  const horizontal: BoundsSnapGap[] = []
  const vertical: BoundsSnapGap[] = []
  const byX = gapNodes(nodes).sort((a, b) => a.pageBounds.minX - b.pageBounds.minX)

  for (let i = 0; i < byX.length; i++) {
    const startNode = byX[i]
    for (let j = i + 1; j < byX.length; j++) {
      const endNode = byX[j]
      if (
        startNode.pageBounds.maxX < endNode.pageBounds.minX &&
        rangesOverlap(
          startNode.pageBounds.minY,
          startNode.pageBounds.maxY,
          endNode.pageBounds.minY,
          endNode.pageBounds.maxY
        )
      ) {
        horizontal.push({
          startNode,
          endNode,
          startEdge: [
            new Vec(startNode.pageBounds.maxX, startNode.pageBounds.minY),
            new Vec(startNode.pageBounds.maxX, startNode.pageBounds.maxY)
          ],
          endEdge: [
            new Vec(endNode.pageBounds.minX, endNode.pageBounds.minY),
            new Vec(endNode.pageBounds.minX, endNode.pageBounds.maxY)
          ],
          length: endNode.pageBounds.minX - startNode.pageBounds.maxX,
          breadthIntersection: rangeIntersection(
            startNode.pageBounds.minY,
            startNode.pageBounds.maxY,
            endNode.pageBounds.minY,
            endNode.pageBounds.maxY
          )!
        })
      }
    }
  }

  const byY = [...byX].sort((a, b) => a.pageBounds.minY - b.pageBounds.minY)
  for (let i = 0; i < byY.length; i++) {
    const startNode = byY[i]
    for (let j = i + 1; j < byY.length; j++) {
      const endNode = byY[j]
      if (
        startNode.pageBounds.maxY < endNode.pageBounds.minY &&
        rangesOverlap(
          startNode.pageBounds.minX,
          startNode.pageBounds.maxX,
          endNode.pageBounds.minX,
          endNode.pageBounds.maxX
        )
      ) {
        vertical.push({
          startNode,
          endNode,
          startEdge: [
            new Vec(startNode.pageBounds.minX, startNode.pageBounds.maxY),
            new Vec(startNode.pageBounds.maxX, startNode.pageBounds.maxY)
          ],
          endEdge: [
            new Vec(endNode.pageBounds.minX, endNode.pageBounds.minY),
            new Vec(endNode.pageBounds.maxX, endNode.pageBounds.minY)
          ],
          length: endNode.pageBounds.minY - startNode.pageBounds.maxY,
          breadthIntersection: rangeIntersection(
            startNode.pageBounds.minX,
            startNode.pageBounds.maxX,
            endNode.pageBounds.minX,
            endNode.pageBounds.maxX
          )!
        })
      }
    }
  }

  return { horizontal, vertical }
}

function collectPointSnaps(
  selectionSnapPoints: readonly BoundsSnapPoint[],
  otherNodeSnapPoints: readonly BoundsSnapPoint[],
  minOffset: Vec,
  nearestSnapsX: NearestSnap[],
  nearestSnapsY: NearestSnap[]
) {
  for (const thisPoint of selectionSnapPoints) {
    for (const otherPoint of otherNodeSnapPoints) {
      const offsetX = Math.abs(thisPoint.x - otherPoint.x)
      const offsetY = Math.abs(thisPoint.y - otherPoint.y)

      if (rounded(offsetX) <= rounded(minOffset.x)) {
        if (rounded(offsetX) < rounded(minOffset.x)) nearestSnapsX.length = 0
        nearestSnapsX.push({
          type: 'points',
          points: { thisPoint, otherPoint },
          nudge: otherPoint.x - thisPoint.x
        })
        minOffset.x = offsetX
      }

      if (rounded(offsetY) <= rounded(minOffset.y)) {
        if (rounded(offsetY) < rounded(minOffset.y)) nearestSnapsY.length = 0
        nearestSnapsY.push({
          type: 'points',
          points: { thisPoint, otherPoint },
          nudge: otherPoint.y - thisPoint.y
        })
        minOffset.y = offsetY
      }
    }
  }
}

const breadthsMeet = (a: [number, number], b: [number, number]) => rangesOverlap(a[0], a[1], b[0], b[1])

function addCenterSnap(nearest: NearestSnap[], snap: Extract<NearestSnap, { type: 'gap_center' }>) {
  const other = nearest.find(
    (candidate): candidate is Extract<NearestSnap, { type: 'gap_center' }> => candidate.type === 'gap_center'
  )
  const meet = other ? breadthsMeet(snap.gap.breadthIntersection, other.gap.breadthIntersection) : false
  if (other && other.gap.length > snap.gap.length && meet) {
    nearest[nearest.indexOf(other)] = snap
  } else if (!other || !meet) {
    nearest.push(snap)
  }
}

function collectGapSnaps(
  selectionPageBounds: Box,
  gaps: ReturnType<typeof getVisibleGaps>,
  minOffset: Vec,
  nearestSnapsX: NearestSnap[],
  nearestSnapsY: NearestSnap[]
) {
  for (const gap of gaps.horizontal) {
    if (
      !rangesOverlap(
        gap.breadthIntersection[0],
        gap.breadthIntersection[1],
        selectionPageBounds.minY,
        selectionPageBounds.maxY
      )
    ) {
      continue
    }

    const centerNudge = gap.startEdge[0].x + gap.length / 2 - selectionPageBounds.center.x
    if (gap.length > selectionPageBounds.width && rounded(Math.abs(centerNudge)) <= rounded(minOffset.x)) {
      if (rounded(Math.abs(centerNudge)) < rounded(minOffset.x)) nearestSnapsX.length = 0
      minOffset.x = Math.abs(centerNudge)
      addCenterSnap(nearestSnapsX, { type: 'gap_center', gap, nudge: centerNudge })
    }

    const leftNudge = gap.startNode.pageBounds.minX - gap.length - selectionPageBounds.maxX
    if (rounded(Math.abs(leftNudge)) <= rounded(minOffset.x)) {
      if (rounded(Math.abs(leftNudge)) < rounded(minOffset.x)) nearestSnapsX.length = 0
      minOffset.x = Math.abs(leftNudge)
      nearestSnapsX.push({
        type: 'gap_duplicate',
        gap,
        protrusionDirection: 'left',
        nudge: leftNudge
      })
    }

    const rightNudge = gap.endNode.pageBounds.maxX + gap.length - selectionPageBounds.minX
    if (rounded(Math.abs(rightNudge)) <= rounded(minOffset.x)) {
      if (rounded(Math.abs(rightNudge)) < rounded(minOffset.x)) nearestSnapsX.length = 0
      minOffset.x = Math.abs(rightNudge)
      nearestSnapsX.push({
        type: 'gap_duplicate',
        gap,
        protrusionDirection: 'right',
        nudge: rightNudge
      })
    }
  }

  for (const gap of gaps.vertical) {
    if (
      !rangesOverlap(
        gap.breadthIntersection[0],
        gap.breadthIntersection[1],
        selectionPageBounds.minX,
        selectionPageBounds.maxX
      )
    ) {
      continue
    }

    const centerNudge = gap.startEdge[0].y + gap.length / 2 - selectionPageBounds.center.y
    if (gap.length > selectionPageBounds.height && rounded(Math.abs(centerNudge)) <= rounded(minOffset.y)) {
      if (rounded(Math.abs(centerNudge)) < rounded(minOffset.y)) nearestSnapsY.length = 0
      minOffset.y = Math.abs(centerNudge)
      addCenterSnap(nearestSnapsY, { type: 'gap_center', gap, nudge: centerNudge })
    }

    const topNudge = gap.startNode.pageBounds.minY - gap.length - selectionPageBounds.maxY
    if (rounded(Math.abs(topNudge)) <= rounded(minOffset.y)) {
      if (rounded(Math.abs(topNudge)) < rounded(minOffset.y)) nearestSnapsY.length = 0
      minOffset.y = Math.abs(topNudge)
      nearestSnapsY.push({
        type: 'gap_duplicate',
        gap,
        protrusionDirection: 'top',
        nudge: topNudge
      })
    }

    const bottomNudge = gap.endNode.pageBounds.maxY + gap.length - selectionPageBounds.minY
    if (rounded(Math.abs(bottomNudge)) <= rounded(minOffset.y)) {
      if (rounded(Math.abs(bottomNudge)) < rounded(minOffset.y)) nearestSnapsY.length = 0
      minOffset.y = Math.abs(bottomNudge)
      nearestSnapsY.push({
        type: 'gap_duplicate',
        gap,
        protrusionDirection: 'bottom',
        nudge: bottomNudge
      })
    }
  }
}

function pointIndicators(nearestSnapsX: NearestSnap[], nearestSnapsY: NearestSnap[]) {
  const groups = new Map<string, SnapPair[]>()
  for (const [axis, snaps] of [
    ['x', nearestSnapsX],
    ['y', nearestSnapsY]
  ] as const) {
    for (const snap of snaps) {
      if (snap.type !== 'points') continue
      const coordinate = axis === 'x' ? snap.points.otherPoint.x : snap.points.otherPoint.y
      const key = `${axis}:${rounded(coordinate)}`
      const group = groups.get(key) ?? []
      group.push(snap.points)
      groups.set(key, group)
    }
  }

  return Array.from(groups, ([key, group]): PointsSnapIndicator => {
    const points: Vec[] = []
    for (const pair of [...group.map(pair => pair.otherPoint), ...group.map(pair => pair.thisPoint)]) {
      const point = new Vec(pair.x, pair.y)
      if (!points.some(existing => existing.equals(point))) points.push(point)
    }
    return { id: `point:${key}`, type: 'points', points }
  })
}

function findAdjacentGaps(
  gaps: BoundsSnapGap[],
  shapeId: string,
  gapLength: number,
  direction: 'forward' | 'backward',
  intersection: [number, number]
): BoundsSnapGap[] {
  const matches = gaps.filter(gap => {
    const id = direction === 'forward' ? gap.startNode.id : gap.endNode.id
    return (
      id === shapeId &&
      rounded(gap.length) === rounded(gapLength) &&
      rangeIntersection(gap.breadthIntersection[0], gap.breadthIntersection[1], intersection[0], intersection[1])
    )
  })
  if (matches.length === 0) return []

  const nextNodes = new Set<string>()
  const direct = matches.length
  for (let i = 0; i < direct; i++) {
    const match = matches[i]
    const nextId = direction === 'forward' ? match.endNode.id : match.startNode.id
    if (nextNodes.has(nextId)) continue
    nextNodes.add(nextId)
    const nextIntersection = rangeIntersection(
      match.breadthIntersection[0],
      match.breadthIntersection[1],
      intersection[0],
      intersection[1]
    )!
    matches.push(...findAdjacentGaps(gaps, nextId, gapLength, direction, nextIntersection))
  }
  return matches
}

const edgesEqual = (a: [Vec, Vec], b: [Vec, Vec]) =>
  rounded(a[0].x) === rounded(b[0].x) &&
  rounded(a[0].y) === rounded(b[0].y) &&
  rounded(a[1].x) === rounded(b[1].x) &&
  rounded(a[1].y) === rounded(b[1].y)

function dedupeGapIndicators(indicators: GapsSnapIndicator[]) {
  indicators.sort((a, b) => b.gaps.length - a.gaps.length)
  for (let i = indicators.length - 1; i > 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      if (
        indicators[i].direction === indicators[j].direction &&
        indicators[i].gaps.every(
          gap =>
            indicators[j].gaps.some(other => edgesEqual(gap.startEdge, other.startEdge)) &&
            indicators[j].gaps.some(other => edgesEqual(gap.endEdge, other.endEdge))
        )
      ) {
        indicators.splice(i, 1)
        break
      }
    }
  }
}

function gapIndicators(
  selectionPageBounds: Box,
  nearestSnapsX: NearestSnap[],
  nearestSnapsY: NearestSnap[],
  visibleGaps: ReturnType<typeof getVisibleGaps>
) {
  const selectionSides: Record<SelectionEdge, [Vec, Vec]> = {
    top: selectionPageBounds.sides[0],
    right: selectionPageBounds.sides[1],
    bottom: [selectionPageBounds.corners[3], selectionPageBounds.corners[2]],
    left: [selectionPageBounds.corners[0], selectionPageBounds.corners[3]]
  }
  const result: GapsSnapIndicator[] = []

  const append = (
    snap: Exclude<NearestSnap, NearestPointsSnap>,
    direction: 'horizontal' | 'vertical',
    index: number
  ) => {
    const axisIsX = direction === 'horizontal'
    const gaps = axisIsX ? visibleGaps.horizontal : visibleGaps.vertical
    const { breadthIntersection, startEdge, startNode, endNode, length, endEdge } = snap.gap
    const breadth = rangeIntersection(
      breadthIntersection[0],
      breadthIntersection[1],
      axisIsX ? selectionPageBounds.minY : selectionPageBounds.minX,
      axisIsX ? selectionPageBounds.maxY : selectionPageBounds.maxX
    )!
    let drawn: GapsSnapIndicator['gaps']

    if (snap.type === 'gap_center') {
      const newLength = (length - (axisIsX ? selectionPageBounds.width : selectionPageBounds.height)) / 2
      drawn = [
        ...findAdjacentGaps(gaps, startNode.id, newLength, 'backward', breadth),
        {
          startEdge,
          endEdge: axisIsX ? selectionSides.left : selectionSides.top
        },
        {
          startEdge: axisIsX ? selectionSides.right : selectionSides.bottom,
          endEdge
        },
        ...findAdjacentGaps(gaps, endNode.id, newLength, 'forward', breadth)
      ]
    } else {
      const before = snap.protrusionDirection === 'left' || snap.protrusionDirection === 'top'
      if (before) {
        drawn = [
          {
            startEdge: axisIsX ? selectionSides.right : selectionSides.bottom,
            endEdge: startEdge.map(point =>
              point.clone().addXY(axisIsX ? -startNode.pageBounds.width : 0, axisIsX ? 0 : -startNode.pageBounds.height)
            ) as [Vec, Vec]
          },
          { startEdge, endEdge },
          ...findAdjacentGaps(gaps, endNode.id, length, 'forward', breadth)
        ]
      } else {
        drawn = [
          ...findAdjacentGaps(gaps, startNode.id, length, 'backward', breadth),
          { startEdge, endEdge },
          {
            startEdge: endEdge.map(point =>
              point.clone().addXY(axisIsX ? endNode.pageBounds.width : 0, axisIsX ? 0 : endNode.pageBounds.height)
            ) as [Vec, Vec],
            endEdge: axisIsX ? selectionSides.left : selectionSides.top
          }
        ]
      }
    }

    result.push({ id: `gap:${direction}:${index}`, type: 'gaps', direction, gaps: drawn })
  }

  nearestSnapsX.forEach((snap, index) => {
    if (snap.type !== 'points') append(snap, 'horizontal', index)
  })
  nearestSnapsY.forEach((snap, index) => {
    if (snap.type !== 'points') append(snap, 'vertical', index)
  })
  dedupeGapIndicators(result)
  return result
}

export function snapTranslateBounds(options: TranslateBoundsSnapOptions): BoundsSnapResult {
  const { dragDelta, snappableShapes, lockedAxis = null, snapThreshold = 8, zoom = 1 } = options
  const initialBounds = boxFrom(options.initialSelectionPageBounds)
  const selectionBounds = initialBounds.clone().translate(dragDelta)
  const sourcePoints =
    options.initialSelectionSnapPoints ??
    initialBounds.cornersAndCenter.map((point, index) => ({
      id: `selection:${index}`,
      x: point.x,
      y: point.y
    }))
  const selectionPoints = sourcePoints.map((point, index) => ({
    id: `selection:${index}`,
    x: point.x + dragDelta.x,
    y: point.y + dragDelta.y
  }))
  const otherPoints = pointsForNodes(snappableShapes)
  const visibleGaps = getVisibleGaps(snappableShapes)
  const nearestX: NearestSnap[] = []
  const nearestY: NearestSnap[] = []
  const threshold = thresholdAtZoom(snapThreshold, zoom)
  const minOffset = new Vec(threshold, threshold)

  collectPointSnaps(selectionPoints, otherPoints, minOffset, nearestX, nearestY)
  collectGapSnaps(selectionBounds, visibleGaps, minOffset, nearestX, nearestY)

  const nudge = new Vec(
    lockedAxis === 'x' ? 0 : (nearestX[0]?.nudge ?? 0),
    lockedAxis === 'y' ? 0 : (nearestY[0]?.nudge ?? 0)
  )

  nearestX.length = 0
  nearestY.length = 0
  minOffset.set(0, 0)
  for (const point of selectionPoints) {
    point.x += nudge.x
    point.y += nudge.y
  }
  selectionBounds.translate(nudge)
  collectPointSnaps(selectionPoints, otherPoints, minOffset, nearestX, nearestY)
  collectGapSnaps(selectionBounds, visibleGaps, minOffset, nearestX, nearestY)

  return {
    nudge,
    indicators: [
      ...gapIndicators(selectionBounds, nearestX, nearestY, visibleGaps),
      ...pointIndicators(nearestX, nearestY)
    ]
  }
}

const corner = (handle: SelectionCorner | SelectionEdge) => handle.includes('_')

const flipX = (handle: SelectionCorner | SelectionEdge) => {
  const swaps: Partial<Record<SelectionCorner | SelectionEdge, SelectionCorner | SelectionEdge>> = {
    left: 'right',
    right: 'left',
    top_left: 'top_right',
    top_right: 'top_left',
    bottom_left: 'bottom_right',
    bottom_right: 'bottom_left'
  }
  return swaps[handle] ?? handle
}

const flipY = (handle: SelectionCorner | SelectionEdge) => {
  const swaps: Partial<Record<SelectionCorner | SelectionEdge, SelectionCorner | SelectionEdge>> = {
    top: 'bottom',
    bottom: 'top',
    top_left: 'bottom_left',
    bottom_left: 'top_left',
    top_right: 'bottom_right',
    bottom_right: 'top_right'
  }
  return swaps[handle] ?? handle
}

function resizePoints(handle: SelectionCorner | SelectionEdge | 'any', bounds: Box): BoundsSnapPoint[] {
  const choices: Array<[SelectionCorner, Array<SelectionCorner | SelectionEdge | 'any'>]> = [
    ['top_left', ['top', 'left', 'top_left', 'any']],
    ['top_right', ['top', 'right', 'top_right', 'any']],
    ['bottom_right', ['bottom', 'right', 'bottom_right', 'any']],
    ['bottom_left', ['bottom', 'left', 'bottom_left', 'any']]
  ]
  return choices
    .filter(([, handles]) => handles.includes(handle))
    .map(([point]) => ({
      id: point,
      handle: point,
      x: point.includes('left') ? bounds.minX : bounds.maxX,
      y: point.includes('top') ? bounds.minY : bounds.maxY
    }))
}

export function snapResizeBounds(options: ResizeBoundsSnapOptions): BoundsSnapResult {
  const {
    dragDelta,
    snappableShapes,
    snapThreshold = 8,
    zoom = 1,
    isAspectRatioLocked = false,
    isResizingFromCenter = false
  } = options
  const initialBounds = boxFrom(options.initialSelectionPageBounds)
  const {
    box: unsnapped,
    scaleX,
    scaleY
  } = Box.Resize(
    initialBounds,
    options.handle,
    isResizingFromCenter ? dragDelta.x * 2 : dragDelta.x,
    isResizingFromCenter ? dragDelta.y * 2 : dragDelta.y,
    isAspectRatioLocked
  )
  let handle = options.handle
  if (scaleX < 0) handle = flipX(handle)
  if (scaleY < 0) handle = flipY(handle)
  if (isResizingFromCenter) unsnapped.center = initialBounds.center

  const nearestX: NearestPointsSnap[] = []
  const nearestY: NearestPointsSnap[] = []
  const minOffset = new Vec(thresholdAtZoom(snapThreshold, zoom), thresholdAtZoom(snapThreshold, zoom))
  const otherPoints = pointsForNodes(snappableShapes)
  collectPointSnaps(resizePoints(handle, unsnapped), otherPoints, minOffset, nearestX, nearestY)
  const nudge = new Vec(
    handle === 'top' || handle === 'bottom' ? 0 : (nearestX[0]?.nudge ?? 0),
    handle === 'left' || handle === 'right' ? 0 : (nearestY[0]?.nudge ?? 0)
  )

  if (isAspectRatioLocked && corner(handle) && nudge.len() !== 0) {
    const primary =
      nearestX.length && nearestY.length
        ? Math.abs(nudge.x) < Math.abs(nudge.y)
          ? 'x'
          : 'y'
        : nearestX.length
          ? 'x'
          : 'y'
    if (primary === 'x') {
      nearestY.length = 0
      nudge.y = nudge.x / initialBounds.aspectRatio
      if (handle === 'bottom_left' || handle === 'top_right') nudge.y = -nudge.y
    } else {
      nearestX.length = 0
      nudge.x = nudge.y * initialBounds.aspectRatio
      if (handle === 'bottom_left' || handle === 'top_right') nudge.x = -nudge.x
    }
  }

  const snappedDelta = Vec.Add(dragDelta, nudge)
  const { box: snapped } = Box.Resize(
    initialBounds,
    options.handle,
    isResizingFromCenter ? snappedDelta.x * 2 : snappedDelta.x,
    isResizingFromCenter ? snappedDelta.y * 2 : snappedDelta.y,
    isAspectRatioLocked
  )
  if (isResizingFromCenter) snapped.center = initialBounds.center
  nearestX.length = 0
  nearestY.length = 0
  minOffset.set(0, 0)
  collectPointSnaps(resizePoints('any', snapped), otherPoints, minOffset, nearestX, nearestY)

  return { nudge, indicators: pointIndicators(nearestX, nearestY) }
}
