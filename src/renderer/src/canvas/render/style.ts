import type { CSSProperties } from 'react'
import type { CanvasCamera } from './types'
import { toDomPrecision } from '../math'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const modulate = (value: number, from: [number, number], to: [number, number]) => {
  const progress = clamp((value - from[0]) / (from[1] - from[0]), 0, 1)
  return to[0] + (to[1] - to[0]) * progress
}

export function cameraOffset(zoom: number): number {
  return zoom >= 1 ? modulate(zoom, [1, 8], [0.125, 0.5]) : modulate(zoom, [0.1, 1], [-2, 0.125])
}

export function cameraCssTransform(camera: CanvasCamera): string {
  const offset = cameraOffset(camera.z)
  return `scale(${toDomPrecision(camera.z)}) translate(${toDomPrecision(camera.x + offset)}px,${toDomPrecision(camera.y + offset)}px)`
}

export function shapeCssTransform(matrix: {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}): string {
  return `matrix(${toDomPrecision(matrix.a)}, ${toDomPrecision(matrix.b)}, ${toDomPrecision(matrix.c)}, ${toDomPrecision(matrix.d)}, ${toDomPrecision(matrix.e)}, ${toDomPrecision(matrix.f)})`
}

export function setStyle(element: HTMLElement | null, property: string, value: string): void {
  if (element?.style.getPropertyValue(property) === value) return
  element?.style.setProperty(property, value)
}

export const CANVAS_ZOOM_VARIABLE = '--crew-zoom'
export const CANVAS_SCALE_VARIABLE = '--crew-scale'

export function cameraZoomVariables(zoom: number): { zoom: string; scale: string } {
  return { zoom: String(toDomPrecision(zoom)), scale: String(toDomPrecision(1 / zoom)) }
}

export const canvasStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  overflow: 'clip',
  touchAction: 'none',
  contain: 'strict',
  contentVisibility: 'auto'
}

export const pageLayerStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: 1,
  height: 1,
  contain: 'layout style size',
  transformOrigin: 'top left'
}

export const shapeStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  overflow: 'visible',
  transformOrigin: 'top left',
  contain: 'size layout'
}

export const viewportLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none'
}
