import { atom, type Atom } from '../signals'
import { Box, Vec, clamp } from '../math'
import type { TLCameraMoveOptions, TLCameraPoint, VecLike, ViewportBounds } from './types'

export const DEFAULT_ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8]
export const ZOOM_TO_FIT_PADDING = 128
export const CAMERA_MOVING_TIMEOUT_MS = 64
export const CAMERA_SLIDE_FRICTION = 0.09

export interface CameraOptions {
  isLocked: boolean
  panSpeed: number
  zoomSpeed: number
  zoomSteps: number[]
}

interface ViewportAnimation {
  elapsed: number
  duration: number
  easing(value: number): number
  start: Box
  end: Box
}

interface CameraSlide {
  speed: number
  friction: number
  direction: VecLike
  speedThreshold: number
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export class CameraManager {
  private readonly camera: Atom<TLCameraPoint>
  private readonly screenBounds: Atom<ViewportBounds>
  private readonly state: Atom<'idle' | 'moving'>
  private readonly options: CameraOptions
  private animation: ViewportAnimation | null = null
  private slide: CameraSlide | null = null
  private movingTimeout = 0

  constructor(options?: {
    camera?: Partial<TLCameraPoint>
    screenBounds?: ViewportBounds
    zoomMin?: number
    zoomMax?: number
    zoomSteps?: number[] | null
    panSpeed?: number
    zoomSpeed?: number
    isLocked?: boolean
  }) {
    this.camera = atom('editor.camera', {
      x: finite(options?.camera?.x, 0),
      y: finite(options?.camera?.y, 0),
      z: finitePositive(options?.camera?.z, 1)
    })
    this.screenBounds = atom('editor.screenBounds', options?.screenBounds ?? { x: 0, y: 0, w: 1080, h: 720 })
    this.state = atom<'idle' | 'moving'>('editor.cameraState', 'idle')
    const steps = options?.zoomSteps === null ? [1] : (options?.zoomSteps ?? DEFAULT_ZOOM_STEPS)
    this.options = {
      isLocked: options?.isLocked ?? false,
      panSpeed: finitePositive(options?.panSpeed, 1),
      zoomSpeed: finitePositive(options?.zoomSpeed, 1),
      zoomSteps: withZoomRange([...steps].sort((a, b) => a - b), options?.zoomMin, options?.zoomMax)
    }
  }

  getOptions(): CameraOptions {
    return this.options
  }

  getCamera(): TLCameraPoint {
    return this.camera.get()
  }

  getZoomLevel(): number {
    return this.camera.get().z
  }

  getBaseZoom(): number {
    return 1
  }

  getState(): 'idle' | 'moving' {
    return this.state.get()
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

  getScreenCenter(): Vec {
    const bounds = this.screenBounds.get()
    return new Vec(bounds.w / 2, bounds.h / 2)
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

  pageToScreen(point: VecLike): Vec {
    const camera = this.camera.get()
    const bounds = this.screenBounds.get()
    return new Vec((point.x + camera.x) * camera.z + bounds.x, (point.y + camera.y) * camera.z + bounds.y, point.z)
  }

  pageToViewport(point: VecLike): Vec {
    const camera = this.camera.get()
    return new Vec((point.x + camera.x) * camera.z, (point.y + camera.y) * camera.z, point.z)
  }

  setCamera(point: VecLike, options?: TLCameraMoveOptions): void {
    if (this.options.isLocked && !options?.force) return
    this.stopAnimation()
    const next = {
      x: finite(point.x, 0),
      y: finite(point.y, 0),
      z: finitePositive(point.z, this.camera.get().z)
    }
    const camera = this.constrained(next, options)
    if (options?.animation) {
      const { w, h } = this.screenBounds.get()
      this.animateToViewport(new Box(-camera.x, -camera.y, w / camera.z, h / camera.z), options)
      return
    }
    this.place(camera)
  }

  centerOnPoint(point: VecLike, options?: TLCameraMoveOptions): void {
    if (this.options.isLocked && !options?.force) return
    const { w, h } = this.getViewportPageBounds()
    this.setCamera(new Vec(-(point.x - w / 2), -(point.y - h / 2), this.camera.get().z), options)
  }

  pan(offset: VecLike, options?: TLCameraMoveOptions): void {
    if (this.options.isLocked && !options?.force) return
    const { x, y, z } = this.camera.get()
    this.setCamera(new Vec(x + offset.x / z, y + offset.y / z, z), { ...options, immediate: true })
  }

  zoomIn(point: VecLike, options?: TLCameraMoveOptions): void {
    if (this.options.isLocked && !options?.force) return
    const { zoomSteps } = this.options
    if (zoomSteps.length < 2) return
    const current = this.camera.get().z
    const base = this.getBaseZoom()
    let zoom = zoomSteps[zoomSteps.length - 1] * base
    for (let at = 1; at < zoomSteps.length; at++) {
      const lower = zoomSteps[at - 1] * base
      const upper = zoomSteps[at] * base
      if (upper - current <= (upper - lower) / 2) continue
      zoom = upper
      break
    }
    this.zoomTo(zoom, point, options)
  }

  zoomOut(point: VecLike, options?: TLCameraMoveOptions): void {
    if (this.options.isLocked && !options?.force) return
    const { zoomSteps } = this.options
    if (zoomSteps.length < 2) return
    const current = this.camera.get().z
    const base = this.getBaseZoom()
    let zoom = zoomSteps[0] * base
    for (let at = zoomSteps.length - 1; at > 0; at--) {
      const lower = zoomSteps[at - 1] * base
      const upper = zoomSteps[at] * base
      if (upper - current >= (upper - lower) / 2) continue
      zoom = lower
      break
    }
    this.zoomTo(zoom, point, options)
  }

  resetZoom(point: VecLike, options?: TLCameraMoveOptions): void {
    if (this.options.isLocked && !options?.force) return
    this.zoomTo(1, point, options)
  }

  zoomToBounds(bounds: Box, options?: { targetZoom?: number; inset?: number } & TLCameraMoveOptions): void {
    if (this.options.isLocked && !options?.force) return
    if (bounds.w <= 0 || bounds.h <= 0) return
    const screen = this.getScreenBounds()
    const inset = options?.inset ?? Math.min(ZOOM_TO_FIT_PADDING, screen.w * 0.28)
    const base = this.getBaseZoom()
    const steps = this.options.zoomSteps
    let zoom = clamp(
      Math.min((screen.w - inset) / bounds.w, (screen.h - inset) / bounds.h),
      steps[0] * base,
      steps[steps.length - 1] * base
    )
    if (options?.targetZoom !== undefined) zoom = Math.min(options.targetZoom, zoom)
    this.setCamera(
      new Vec(
        -bounds.x + (screen.w - bounds.w * zoom) / 2 / zoom,
        -bounds.y + (screen.h - bounds.h * zoom) / 2 / zoom,
        zoom
      ),
      options
    )
  }

  slideCamera(options: { speed: number; direction: VecLike; friction?: number; speedThreshold?: number }): void {
    if (this.options.isLocked) return
    this.stopAnimation()
    this.slide = {
      speed: Math.min(options.speed, 1),
      friction: options.friction ?? CAMERA_SLIDE_FRICTION,
      direction: options.direction,
      speedThreshold: options.speedThreshold ?? 0.01
    }
  }

  stopAnimation(): void {
    this.animation = null
    this.slide = null
  }

  tick(elapsed: number): void {
    this.decayMoving(elapsed)
    this.tickSlide(elapsed)
    this.tickAnimation(elapsed)
  }

  private zoomTo(zoom: number, point: VecLike, options?: TLCameraMoveOptions): void {
    const { x, y, z } = this.camera.get()
    this.setCamera(new Vec(x + point.x / zoom - point.x / z, y + point.y / zoom - point.y / z, zoom), options)
  }

  private constrained(point: TLCameraPoint, options?: TLCameraMoveOptions): TLCameraPoint {
    if (options?.force) return point
    const current = this.camera.get()
    const steps = this.options.zoomSteps
    const zoomMin = steps[0]
    const zoomMax = steps[steps.length - 1]
    let { x, y, z } = point
    if (z > zoomMax || z < zoomMin) {
      const requested = z
      z = clamp(z, zoomMin, zoomMax)
      x = preserveFocalPoint(current.x, x, requested, z, current.z)
      y = preserveFocalPoint(current.y, y, requested, z, current.z)
    }
    return { x, y, z }
  }

  private place(next: TLCameraPoint): void {
    const current = this.camera.get()
    if (current.x === next.x && current.y === next.y && current.z === next.z) return
    this.camera.set(next)
    this.movingTimeout = CAMERA_MOVING_TIMEOUT_MS
    if (this.state.get() === 'idle') this.state.set('moving')
  }

  private decayMoving(elapsed: number): void {
    if (this.state.get() === 'idle') return
    this.movingTimeout -= elapsed
    if (this.movingTimeout > 0) return
    this.state.set('idle')
  }

  private tickSlide(elapsed: number): void {
    const slide = this.slide
    if (!slide) return
    const { x, y, z } = this.camera.get()
    this.place(
      this.constrained({
        x: x + (slide.direction.x * (slide.speed * elapsed)) / z,
        y: y + (slide.direction.y * (slide.speed * elapsed)) / z,
        z
      })
    )
    slide.speed *= 1 - slide.friction
    if (slide.speed < slide.speedThreshold) this.slide = null
  }

  private tickAnimation(elapsed: number): void {
    const animation = this.animation
    if (!animation) return
    animation.elapsed += elapsed
    const { w } = this.screenBounds.get()
    if (animation.elapsed > animation.duration) {
      this.animation = null
      this.place({ x: -animation.end.x, y: -animation.end.y, z: w / animation.end.w })
      return
    }
    const t = animation.easing(animation.elapsed / animation.duration)
    const left = animation.start.minX + (animation.end.minX - animation.start.minX) * t
    const top = animation.start.minY + (animation.end.minY - animation.start.minY) * t
    const right = animation.start.maxX + (animation.end.maxX - animation.start.maxX) * t
    this.place({ x: -left, y: -top, z: w / (right - left) })
  }

  private animateToViewport(target: Box, options: TLCameraMoveOptions): void {
    const { duration = 0, easing = easeInOutCubic } = options.animation ?? {}
    const { w } = this.screenBounds.get()
    if (duration <= 0) {
      this.place({ x: -target.x, y: -target.y, z: w / target.w })
      return
    }
    this.animation = {
      elapsed: 0,
      duration,
      easing,
      start: this.getViewportPageBounds().clone(),
      end: target.clone()
    }
  }
}

function preserveFocalPoint(
  current: number,
  requested: number,
  requestedZoom: number,
  zoom: number,
  currentZoom: number
): number {
  if (requestedZoom === currentZoom) return current
  return current + ((requested - current) * (1 / zoom - 1 / currentZoom)) / (1 / requestedZoom - 1 / currentZoom)
}

function withZoomRange(steps: number[], zoomMin?: number, zoomMax?: number): number[] {
  const min = finitePositive(zoomMin, steps[0])
  const max = finitePositive(zoomMax, steps[steps.length - 1])
  const inside = steps.filter(step => step > min && step < max)
  return [min, ...inside, max]
}

function finite(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : value
}

function finitePositive(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value <= 0 ? fallback : value
}
