import { useRef } from 'react'
import { useQuickReactor, useValue } from '../signals'
import { OverlayCanvas } from './OverlayCanvas'
import { ShapeLayer } from './ShapeLayer'
import {
  CANVAS_SCALE_VARIABLE,
  CANVAS_ZOOM_VARIABLE,
  cameraCssTransform,
  cameraZoomVariables,
  canvasStyle,
  pageLayerStyle,
  setStyle,
  viewportLayerStyle
} from './style'
import type { CanvasProps, CanvasShapeRecord } from './types'

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ')

export function Canvas<Shape extends CanvasShapeRecord>({
  host,
  shapeRenderer,
  svgDefs,
  background,
  onTheCanvas,
  viewportOverlay,
  inFrontOfCanvas,
  canvasRef,
  shapeLayerStyle,
  className,
  style,
  ...events
}: CanvasProps<Shape>) {
  const pageLayerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useQuickReactor(
    'canvas camera transform',
    () => setStyle(pageLayerRef.current, 'transform', cameraCssTransform(host.getCamera())),
    [host]
  )

  useQuickReactor('canvas state attributes', () => {
    rootRef.current?.setAttribute(
      'data-iseditinganything',
      (host.getEditingShapeId?.() ?? null) === null ? 'false' : 'true'
    )
    rootRef.current?.setAttribute(
      'data-isselectinganything',
      (host.getSelectedShapeIds?.().length ?? 0) === 0 ? 'false' : 'true'
    )
  }, [host])

  const cameraMoving = useValue('canvas camera state', () => host.getCameraState() === 'moving', [host])

  const assignRoot = (element: HTMLDivElement | null) => {
    rootRef.current = element
    if (typeof canvasRef === 'function') canvasRef(element)
    else if (canvasRef) {
      canvasRef.current = element
    }
  }

  return (
    <>
      <div
        {...events}
        ref={assignRoot}
        data-canvas="true"
        className={join('crew-canvas', className)}
        draggable={false}
        style={{ ...canvasStyle, ...style }}
      >
        {svgDefs && (
          <svg className="crew-svg-context" aria-hidden="true" style={viewportLayerStyle}>
            <defs>{svgDefs}</defs>
          </svg>
        )}
        {background && (
          <div className="crew-background-wrapper" style={{ ...viewportLayerStyle, pointerEvents: undefined }}>
            {background}
          </div>
        )}
        <div
          ref={pageLayerRef}
          data-canvas-page-layer="true"
          className="crew-html-layer crew-shapes"
          draggable={false}
          style={{ ...pageLayerStyle, ...shapeLayerStyle }}
        >
          {onTheCanvas}
          <ShapeLayer host={host} renderer={shapeRenderer} />
        </div>
        <OverlayCanvas host={host} />
        {viewportOverlay && <div style={viewportLayerStyle}>{viewportOverlay}</div>}
        {cameraMoving && (
          <div
            data-canvas-hit-test-blocker="true"
            className="crew-hit-test-blocker"
            style={{ ...viewportLayerStyle, pointerEvents: 'all' }}
          />
        )}
      </div>
      {inFrontOfCanvas && (
        <div className="crew-canvas-in-front" style={viewportLayerStyle}>
          {inFrontOfCanvas}
        </div>
      )}
    </>
  )
}
