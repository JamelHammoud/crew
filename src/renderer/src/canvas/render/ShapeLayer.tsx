import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { computed, unsafe__withoutCapture, useStateTracking, useValue } from '../signals'
import { MountedShapeCullingProvider, useCanvasLayoutReactor, useMountedShapeCulling } from './Culling'
import { setStyle, shapeCssTransform, shapeStyle } from './style'
import type { CanvasRenderHost, CanvasRenderingShape, CanvasShapeRecord, CanvasShapeRenderer } from './types'

const SORT_CACHE_THRESHOLD = 32

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function sortRenderingShapes<Shape extends CanvasShapeRecord>(
  shapes: CanvasRenderingShape<Shape>[]
): CanvasRenderingShape<Shape>[] {
  return shapes.length < 2 ? shapes : [...shapes].sort(byId)
}

export class RenderingShapeOrder {
  private positions: Map<string, number> | null = null

  sort<Shape extends CanvasShapeRecord>(shapes: CanvasRenderingShape<Shape>[]): CanvasRenderingShape<Shape>[] {
    if (shapes.length < 2) return shapes
    if (shapes.length <= SORT_CACHE_THRESHOLD) {
      this.positions = null
      return shapes.sort(byId)
    }
    const positions = this.positions
    if (positions && positions.size === shapes.length) {
      const sorted = new Array<CanvasRenderingShape<Shape>>(shapes.length)
      let matched = true
      for (let at = 0; at < shapes.length; at++) {
        const position = positions.get(shapes[at].id)
        if (position === undefined) {
          matched = false
          break
        }
        sorted[position] = shapes[at]
      }
      if (matched) return sorted
    }
    shapes.sort(byId)
    const next = new Map<string, number>()
    for (let at = 0; at < shapes.length; at++) next.set(shapes[at].id, at)
    this.positions = next
    return shapes
  }
}

function sameRenderingShape<Shape extends CanvasShapeRecord>(
  previous: CanvasRenderingShape<Shape>,
  next: CanvasRenderingShape<Shape>
): boolean {
  return (
    previous.id === next.id &&
    previous.index === next.index &&
    previous.backgroundIndex === next.backgroundIndex &&
    previous.opacity === next.opacity &&
    previous.isEditing === next.isEditing &&
    previous.shape.type === next.shape.type &&
    previous.shape.props === next.shape.props &&
    previous.shape.meta === next.shape.meta
  )
}

export function sameRenderingShapes<Shape extends CanvasShapeRecord>(
  previous: CanvasRenderingShape<Shape>[],
  next: CanvasRenderingShape<Shape>[]
): boolean {
  if (previous === next) return true
  if (previous.length !== next.length) return false
  for (let at = 0; at < previous.length; at++) {
    if (!sameRenderingShape(previous[at], next[at])) return false
  }
  return true
}

export function ShapeLayer<Shape extends CanvasShapeRecord>({
  host,
  renderer
}: {
  host: CanvasRenderHost<Shape>
  renderer: CanvasShapeRenderer<Shape>
}) {
  const order = useRef<RenderingShapeOrder>()
  if (!order.current) order.current = new RenderingShapeOrder()
  const sorter = order.current
  const rendering = useMemo(
    () =>
      computed('canvas rendering shapes', () => sorter.sort(host.getRenderingShapes()), {
        isEqual: sameRenderingShapes
      }),
    [host, sorter]
  )
  const shapes = useValue(rendering)
  tally('layer:*')
  return (
    <MountedShapeCullingProvider>
      {shapes.map(shape => (
        <CanvasShape key={shape.id} host={host} renderer={renderer} result={shape} />
      ))}
      <CullingController host={host} />
    </MountedShapeCullingProvider>
  )
}

function CullingController<Shape extends CanvasShapeRecord>({ host }: { host: CanvasRenderHost<Shape> }) {
  const culling = useMountedShapeCulling()
  useCanvasLayoutReactor('canvas mounted shape culling', () => culling.update(host.getCulledShapes()), [host, culling])
  return null
}

interface ShapeContentProps<Shape extends CanvasShapeRecord> {
  host: CanvasRenderHost<Shape>
  renderer: CanvasShapeRenderer<Shape>
  shape: Shape
  behind: boolean
}

function ShapeContentView<Shape extends CanvasShapeRecord>({
  host,
  renderer,
  shape,
  behind
}: ShapeContentProps<Shape>): ReactNode {
  return useStateTracking(
    `canvas shape content ${shape.type}`,
    () => {
      const latest = unsafe__withoutCapture(() => host.getShape(shape.id)) ?? shape
      return behind ? renderer.renderBackground?.(latest) : renderer.render(latest)
    },
    [host, renderer, shape.id, behind]
  )
}

function sameShapeContentProps<Shape extends CanvasShapeRecord>(
  previous: ShapeContentProps<Shape>,
  next: ShapeContentProps<Shape>
): boolean {
  return (
    previous.host === next.host &&
    previous.renderer === next.renderer &&
    previous.behind === next.behind &&
    previous.shape.props === next.shape.props &&
    previous.shape.meta === next.shape.meta
  )
}

const ShapeContent = memo(ShapeContentView, sameShapeContentProps) as typeof ShapeContentView

interface CanvasShapeProps<Shape extends CanvasShapeRecord> {
  host: CanvasRenderHost<Shape>
  renderer: CanvasShapeRenderer<Shape>
  result: CanvasRenderingShape<Shape>
}

function CanvasShapeView<Shape extends CanvasShapeRecord>({ host, renderer, result }: CanvasShapeProps<Shape>) {
  tally(`shape:${result.shape.type}:${result.id}`)
  tally('shape:*')
  const foregroundRef = useRef<HTMLDivElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const memoized = useRef({ transform: '', clipPath: '', width: '', height: '' })
  const culling = useMountedShapeCulling()

  useCanvasLayoutReactor(
    `canvas shape ${result.id}`,
    () => {
      const shape = host.getShape(result.id)
      const transform = host.getShapePageTransform(result.id)
      if (!shape || !transform) return
      const bounds = host.getShapeGeometry(shape).bounds
      const clipPath = host.getShapeClipPath(result.id) ?? 'none'
      const next = {
        transform: shapeCssTransform(transform),
        clipPath,
        width: `${Math.max(bounds.w, 1)}px`,
        height: `${Math.max(bounds.h, 1)}px`
      }
      const previous = memoized.current
      for (const key of Object.keys(next) as Array<keyof typeof next>) {
        if (next[key] === previous[key]) continue
        const property = key === 'clipPath' ? 'clip-path' : key
        setStyle(foregroundRef.current, property, next[key])
        setStyle(backgroundRef.current, property, next[key])
        previous[key] = next[key]
      }
    },
    [host, result.id]
  )

  useLayoutEffect(() => {
    setStyle(foregroundRef.current, 'opacity', String(result.opacity))
    setStyle(backgroundRef.current, 'opacity', String(result.opacity))
    setStyle(foregroundRef.current, 'z-index', String(result.index))
    setStyle(backgroundRef.current, 'z-index', String(result.backgroundIndex))
  }, [result.opacity, result.index, result.backgroundIndex])

  useLayoutEffect(() => {
    const foreground = foregroundRef.current
    if (!foreground) return
    culling.register(result.id, foreground, backgroundRef.current, host.getCulledShapes().has(result.id))
    return () => culling.unregister(result.id)
  }, [culling, host, result.id])

  return (
    <>
      {renderer.renderBackground && (
        <div
          ref={backgroundRef}
          data-canvas-shape-background="true"
          data-shape-id={result.id}
          data-shape-type={result.shape.type}
          className="crew-shape crew-shape-background"
          draggable={false}
          style={shapeStyle}
        >
          <ShapeContent host={host} renderer={renderer} shape={result.shape} behind />
        </div>
      )}
      <div
        ref={foregroundRef}
        data-canvas-shape="true"
        data-shape-id={result.id}
        data-shape-type={result.shape.type}
        data-shape-is-filled={renderer.isFilled?.(result.shape)}
        className="crew-shape"
        draggable={false}
        style={shapeStyle}
      >
        <ShapeContent host={host} renderer={renderer} shape={result.shape} behind={false} />
      </div>
    </>
  )
}

function sameShapeContent<Shape extends CanvasShapeRecord>(
  previous: CanvasShapeProps<Shape>,
  next: CanvasShapeProps<Shape>
): boolean {
  return (
    previous.host === next.host &&
    previous.renderer === next.renderer &&
    sameRenderingShape(previous.result, next.result)
  )
}

const CanvasShape = memo(CanvasShapeView, sameShapeContent) as typeof CanvasShapeView
