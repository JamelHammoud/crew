import { memo, useLayoutEffect, useRef } from 'react'
import { computed, EffectScheduler } from '../signals'
import type { CanvasRenderHost, CanvasShapeRecord } from './types'

interface OverlayRenderInputs {
  dpr: number
  width: number
  height: number
  cameraX: number
  cameraY: number
  zoom: number
}

export const OverlayCanvas = memo(function OverlayCanvas<Shape extends CanvasShapeRecord>({
  host
}: {
  host: CanvasRenderHost<Shape>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    let frame: number | null = null
    const inputs = computed<OverlayRenderInputs>(
      'canvas overlay render inputs',
      () => {
        const instance = host.getInstanceState()
        const camera = host.getCamera()
        return {
          dpr: instance.devicePixelRatio,
          width: instance.screenBounds.w,
          height: instance.screenBounds.h,
          cameraX: camera.x,
          cameraY: camera.y,
          zoom: camera.z
        }
      },
      {
        isEqual: (a, b) =>
          a.dpr === b.dpr &&
          a.width === b.width &&
          a.height === b.height &&
          a.cameraX === b.cameraX &&
          a.cameraY === b.cameraY &&
          a.zoom === b.zoom
      }
    )

    const scheduler = new EffectScheduler(
      'canvas overlay render',
      () => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context) return
        const { dpr, width, height, cameraX, cameraY, zoom } = inputs.get()
        const canvasWidth = Math.ceil(width * dpr)
        const canvasHeight = Math.ceil(height * dpr)
        if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
          canvas.width = canvasWidth
          canvas.height = canvasHeight
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`
        }
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        const scale = dpr * zoom
        context.setTransform(scale, 0, 0, scale, scale * cameraX, scale * cameraY)
        for (const { util, overlays } of host.overlays.getActiveOverlayEntries()) {
          context.save()
          util.render(context, overlays)
          context.restore()
        }
      },
      {
        scheduleEffect: execute => {
          if (frame !== null) return
          frame = requestAnimationFrame(() => {
            frame = null
            execute()
          })
        }
      }
    )

    scheduler.attach()
    scheduler.execute()
    return () => {
      scheduler.detach()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [host])

  return <canvas ref={canvasRef} data-canvas-overlays="true" className="crew-canvas-overlays" />
})
