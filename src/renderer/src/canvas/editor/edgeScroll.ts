import { Box, Vec } from '../math'
import type { TLCameraPoint, VecLike } from './types'

const SMALL_SCREEN_THRESHOLD_PX = 1000
const SMALL_SCREEN_SPEED_FACTOR = 0.612
const SCROLL_DELAY_MS = 200
const EASE_DURATION_MS = 200
const SCROLL_SPEED = 25
const SCROLL_DISTANCE = 8

interface EdgeScrollEditor {
  getViewportScreenBounds(): Box
  getZoomLevel(): number
  getCamera(): TLCameraPoint
  setCamera(point: VecLike): unknown
  inputs: { getCurrentScreenPoint(): Vec }
  user: { getEdgeScrollSpeed(): number }
}

export class EdgeScrollManager {
  private scrolling = false
  private duration = -1

  constructor(private readonly editor: EdgeScrollEditor) {}

  getIsEdgeScrolling(): boolean {
    return this.scrolling
  }

  start(): void {
    this.scrolling = false
    this.duration = 0
  }

  stop(): void {
    this.scrolling = false
    this.duration = 0
  }

  update(elapsed = 16): void {
    this.updateEdgeScrolling(elapsed)
  }

  updateEdgeScrolling(elapsed: number): void {
    const proximity = this.proximity()
    if (proximity.x === 0 && proximity.y === 0) {
      if (!this.scrolling) return
      this.scrolling = false
      this.duration = 0
      return
    }
    if (!this.scrolling) {
      this.scrolling = true
      this.duration = 0
    }
    this.duration += elapsed
    if (this.duration <= SCROLL_DELAY_MS) return
    const eased = easeInCubic(Math.min(1, this.duration / (SCROLL_DELAY_MS + EASE_DURATION_MS)))
    this.move({ x: proximity.x * eased, y: proximity.y * eased })
  }

  private proximity(): { x: number; y: number } {
    const point = this.editor.inputs.getCurrentScreenPoint()
    const screen = this.editor.getViewportScreenBounds()
    return { x: factor(point.x, screen.w), y: factor(point.y, screen.h) }
  }

  private move(proximity: { x: number; y: number }): void {
    const screen = this.editor.getViewportScreenBounds()
    const factorX = screen.w < SMALL_SCREEN_THRESHOLD_PX ? SMALL_SCREEN_SPEED_FACTOR : 1
    const factorY = screen.h < SMALL_SCREEN_THRESHOLD_PX ? SMALL_SCREEN_SPEED_FACTOR : 1
    const zoom = this.editor.getZoomLevel()
    const speed = this.editor.user.getEdgeScrollSpeed() * SCROLL_SPEED
    const { x, y, z } = this.editor.getCamera()
    this.editor.setCamera({
      x: x + (speed * proximity.x * factorX) / zoom,
      y: y + (speed * proximity.y * factorY) / zoom,
      z
    })
  }
}

function factor(position: number, dimension: number): number {
  if (position < SCROLL_DISTANCE) return Math.min(1, (SCROLL_DISTANCE - position) / SCROLL_DISTANCE)
  const max = dimension - SCROLL_DISTANCE
  if (position > max) return -Math.min(1, (position - max) / SCROLL_DISTANCE)
  return 0
}

function easeInCubic(t: number): number {
  return t * t * t
}
