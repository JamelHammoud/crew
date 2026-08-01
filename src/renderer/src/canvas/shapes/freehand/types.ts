import type { Vec } from '../../math/Vec'

export interface StrokeCapOptions {
  cap?: boolean
  taper?: number | boolean
  easing?(distance: number): number
}

export interface StrokeOptions {
  size?: number
  thinning?: number
  smoothing?: number
  streamline?: number
  easing?(pressure: number): number
  simulatePressure?: boolean
  start?: StrokeCapOptions
  end?: StrokeCapOptions
  last?: boolean
}

export interface StrokePoint {
  point: Vec
  input: Vec
  pressure: number
  distance: number
  runningLength: number
  radius: number
  isCap: boolean
}

export const MIN_PRESSURE = 0.025
export const RATE_OF_PRESSURE_CHANGE = 0.275

export const linear = (value: number) => value
export const easeOutSine = (value: number) => Math.sin((value * Math.PI) / 2)
export const easeOutQuad = (value: number) => value * (2 - value)
export const easeOutCubic = (value: number) => --value * value * value + 1

export function resolveTaper(taper: number | boolean | undefined, size: number, totalLength: number): number {
  if (!taper) return 0
  return taper === true ? Math.max(size, totalLength) : taper
}
