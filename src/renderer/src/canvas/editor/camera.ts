import { atom, type Atom } from '../signals'
import { Box, Vec } from '../math'
import type { TLCameraMoveOptions, TLCameraPoint, VecLike, ViewportBounds } from './types'

export class CameraManager {
  private readonly camera: Atom<TLCameraPoint>
  private readonly screenBounds: Atom<ViewportBounds>
  private readonly zoomMin: number
  private readonly zoomMax: number
  private readonly zoomSteps: number[] | null

  constructor(options?: {
    camera?: Partial<TLCameraPoint>
    screenBounds?: ViewportBounds
    zoomMin?: number
    zoomMax?: number
    zoomSteps?: number[] | null
  }) {
    this.camera = atom('editor.camera', {
      x: finite(options?.camera?.x, 0),
      y: finite(options?.camera?.y, 0),
      z: finitePositive(options?.camera?.z, 1)
    })
    this.screenBounds = atom('editor.screenBounds', options?.screenBounds ?? { x: 0, y: 0, w: 1080, h: 720 })
    this.zoomMin = finitePositive(options?.zoomMin, 0.05)
    this.zoomMax = finitePositive(options?.zoomMax, 8)
    this.zoomSteps = options?.zoomSteps ?? [0.05, 0.1, 0.2, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]
  }

  getCamera(): TLCameraPoint {
    return this.camera.get()
  }

  setCamera(point: VecLike): void {
    const previous = this.camera.get()
    this.camera.set({
      x: finite(point.x, 0),
      y: finite(point.y, 0),
      z: clamp(finitePositive(point.z, previous.z), this.zoomMin, this.zoomMax)
    })
  }

  getScreenBounds(): Box {
    return Box.From(this.screenBounds.get())
  }

  setScreenBounds(bounds: ViewportBounds): void {
    this.screenBounds.set({
      x: finite(bounds.x, 0),
      y: finite(bounds.y, 0),
      w: Math.max(0, finite(bounds.w, 0)),
      h: Math.max(0, finite(bounds.h, 0))
    })
  }

  getViewportPageBounds(): Box {
    const { x, y, z } = this.camera.get()
    const { w, h } = this.screenBounds.get()
    return new Box(-x, -y, w / z, h / z)
  }

  screenToPage(point: VecLike): Vec {
    const camera = this.camera.get()
    const bounds = this.screenBounds.get()
    return new Vec((point.x - bounds.x) / camera.z - camera.x, (point.y - bounds.y) / camera.z - camera.y, point.z)
  }

  pageToViewport(point: VecLike): Vec {
    const camera = this.camera.get()
    return new Vec((point.x + camera.x) * camera.z, (point.y + camera.y) * camera.z, point.z)
  }

  zoomBy(direction: 1 | -1, focalPoint?: VecLike, _options?: TLCameraMoveOptions): void {
    const previous = this.camera.get()
    const center = focalPoint ?? { x: this.screenBounds.get().w / 2, y: this.screenBounds.get().h / 2 }
    const nextZoom = this.nextZoom(previous.z, direction)
    this.setZoomAt(nextZoom, center)
  }

  resetZoom(focalPoint?: VecLike): void {
    const bounds = this.screenBounds.get()
    this.setZoomAt(1, focalPoint ?? { x: bounds.w / 2, y: bounds.h / 2 })
  }

  zoomToBounds(bounds: Box, padding = 64): void {
    if (!bounds.isValid()) return
    const viewport = this.screenBounds.get()
    const availableWidth = Math.max(1, viewport.w - padding * 2)
    const availableHeight = Math.max(1, viewport.h - padding * 2)
    const z = clamp(
      Math.min(availableWidth / Math.max(1, bounds.w), availableHeight / Math.max(1, bounds.h)),
      this.zoomMin,
      this.zoomMax
    )
    this.setCamera({
      x: viewport.w / (2 * z) - bounds.midX,
      y: viewport.h / (2 * z) - bounds.midY,
      z
    })
  }

  private setZoomAt(z: number, focalPoint: VecLike): void {
    const previous = this.camera.get()
    const next = clamp(z, this.zoomMin, this.zoomMax)
    this.setCamera({
      x: previous.x + focalPoint.x / next - focalPoint.x / previous.z,
      y: previous.y + focalPoint.y / next - focalPoint.y / previous.z,
      z: next
    })
  }

  private nextZoom(current: number, direction: 1 | -1): number {
    if (!this.zoomSteps || this.zoomSteps.length === 0) return current * (direction > 0 ? 1.25 : 0.8)
    const sorted = [...this.zoomSteps].sort((a, b) => a - b)
    if (direction > 0) return sorted.find(value => value > current + 0.001) ?? this.zoomMax
    return [...sorted].reverse().find(value => value < current - 0.001) ?? this.zoomMin
  }
}

function finite(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : value
}

function finitePositive(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value <= 0 ? fallback : value
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
