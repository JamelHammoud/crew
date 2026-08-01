import { memo, useLayoutEffect, useRef } from 'react'
import { useQuickReactor, useValue } from '../signals'
import { MountedShapeCullingProvider, useCullingReactor, useMountedShapeCulling } from './Culling'
import { setStyle, shapeCssTransform, shapeStyle } from './style'
import type { CanvasRenderHost, CanvasRenderingShape, CanvasShapeRecord, CanvasShapeRenderer } from './types'

export function sortRenderingShapes<Shape extends CanvasShapeRecord>(
  shapes: CanvasRenderingShape<Shape>[]
): CanvasRenderingShape<Shape>[] {
  return shapes.length < 2 ? shapes : [...shapes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function ShapeLayer<Shape extends CanvasShapeRecord>({
  host,
  renderer
}: {
  host: CanvasRenderHost<Shape>
  renderer: CanvasShapeRenderer<Shape>
}) {
  const shapes = useValue('canvas rendering shapes', () => sortRenderingShapes(host.getRenderingShapes()), [host])
  const probe = (globalThis as never as { __render?: Record<string, number> }).__render
  if (probe) probe.layerRenders = (probe.layerRenders ?? 0) + 1
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
  useCullingReactor('canvas mounted shape culling', () => culling.update(host.getCulledShapes()), [host, culling])
  return null
}

interface CanvasShapeProps<Shape extends CanvasShapeRecord> {
  host: CanvasRenderHost<Shape>
  renderer: CanvasShapeRenderer<Shape>
  result: CanvasRenderingShape<Shape>
}

function CanvasShapeView<Shape extends CanvasShapeRecord>({ host, renderer, result }: CanvasShapeProps<Shape>) {
  const probe = (globalThis as never as { __render?: Record<string, number> }).__render
  if (probe) probe.shapeRenders = (probe.shapeRenders ?? 0) + 1
  const foregroundRef = useRef<HTMLDivElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const memoized = useRef({ transform: '', clipPath: '', width: '', height: '' })
  const culling = useMountedShapeCulling()
  const background = renderer.renderBackground?.(result.shape)

  useQuickReactor(`canvas shape ${result.id}`, () => {
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
  }, [host, result.id])

  useLayoutEffect(() => {
    setStyle(foregroundRef.current, 'opacity', String(result.opacity))
    setStyle(backgroundRef.current, 'opacity', String(result.opacity))
    setStyle(foregroundRef.current, 'z-index', String(result.index))
    setStyle(backgroundRef.current, 'z-index', String(result.backgroundIndex))
  }, [result.opacity, result.index, result.backgroundIndex])

  useLayoutEffect(() => {
    const foreground = foregroundRef.current
    if (!foreground) return
    culling.register(result.id, foreground, backgroundRef.current)
    return () => culling.unregister(result.id)
  }, [culling, result.id])

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
          {background}
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
        {renderer.render(result.shape)}
      </div>
    </>
  )
}

function sameShapeContent<Shape extends CanvasShapeRecord>(
  previous: CanvasShapeProps<Shape>,
  next: CanvasShapeProps<Shape>
): boolean {
  const probe = (globalThis as never as { __render?: Record<string, number> }).__render
  const checks: Array<[string, boolean]> = [
    ['host', previous.host === next.host],
    ['renderer', previous.renderer === next.renderer],
    ['id', previous.result.id === next.result.id],
    ['index', previous.result.index === next.result.index],
    ['backgroundIndex', previous.result.backgroundIndex === next.result.backgroundIndex],
    ['opacity', previous.result.opacity === next.result.opacity],
    ['isEditing', previous.result.isEditing === next.result.isEditing],
    ['type', previous.result.shape.type === next.result.shape.type],
    ['props', previous.result.shape.props === next.result.shape.props],
    ['meta', previous.result.shape.meta === next.result.shape.meta]
  ]
  if (probe) probe.compares = (probe.compares ?? 0) + 1
  for (const [name, ok] of checks) {
    if (ok) continue
    if (probe) probe[`miss.${name}`] = (probe[`miss.${name}`] ?? 0) + 1
    return false
  }
  return true
}

const CanvasShape = memo(CanvasShapeView, sameShapeContent) as typeof CanvasShapeView
