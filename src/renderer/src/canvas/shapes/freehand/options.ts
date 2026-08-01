import { modulate } from '../rng'
import { easeOutSine, linear, type StrokeOptions } from './types'

const penEasing = (value: number) => value * 0.65 + Math.sin((value * Math.PI) / 2) * 0.35

function simulatedPressure(strokeWidth: number): StrokeOptions {
  return {
    size: strokeWidth,
    thinning: 0.5,
    streamline: modulate(strokeWidth, [9, 16], [0.64, 0.74], true),
    smoothing: 0.62,
    easing: easeOutSine,
    simulatePressure: true
  }
}

function realPressure(strokeWidth: number): StrokeOptions {
  return {
    size: 1 + strokeWidth * 1.2,
    thinning: 0.62,
    streamline: 0.62,
    smoothing: 0.62,
    simulatePressure: false,
    easing: penEasing
  }
}

function solid(strokeWidth: number): StrokeOptions {
  return {
    size: strokeWidth,
    thinning: 0,
    streamline: modulate(strokeWidth, [9, 16], [0.64, 0.74], true),
    smoothing: 0.62,
    simulatePressure: false,
    easing: linear
  }
}

function solidRealPressure(strokeWidth: number): StrokeOptions {
  return {
    size: strokeWidth,
    thinning: 0,
    streamline: 0.62,
    smoothing: 0.62,
    simulatePressure: false,
    easing: linear
  }
}

export function freehandOptions(
  props: { dash: string; isPen: boolean; isComplete: boolean },
  strokeWidth: number,
  forceComplete: boolean,
  forceSolid: boolean
): StrokeOptions {
  const last = props.isComplete || forceComplete
  if (forceSolid) return { ...(props.isPen ? solidRealPressure(strokeWidth) : solid(strokeWidth)), last }
  if (props.dash === 'draw')
    return { ...(props.isPen ? realPressure(strokeWidth) : simulatedPressure(strokeWidth)), last }
  return { ...solid(strokeWidth), last }
}

export function highlightOptions(strokeWidth: number, showAsComplete: boolean): StrokeOptions {
  return {
    size: 1 + strokeWidth,
    thinning: 0,
    streamline: 0.5,
    smoothing: 0.5,
    simulatePressure: false,
    easing: easeOutSine,
    last: showAsComplete
  }
}
