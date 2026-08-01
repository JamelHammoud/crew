import type { TLDefaultDashStyle as CrewDashStyle } from '../schema'

export type PerfectDashTerminal = 'skip' | 'outset' | 'none'

export interface PerfectDashOptions {
  style?: CrewDashStyle
  snap?: number
  end?: PerfectDashTerminal
  start?: PerfectDashTerminal
  lengthRatio?: number
  closed?: boolean
  forceSolid?: boolean
}

export interface PerfectDashProps {
  strokeDasharray: string
  strokeDashoffset: string
}

const NONE: PerfectDashProps = { strokeDasharray: 'none', strokeDashoffset: 'none' }

export function getPerfectDashProps(
  totalLength: number,
  strokeWidth: number,
  opts: PerfectDashOptions = {}
): PerfectDashProps {
  const {
    closed = false,
    snap = 1,
    start = 'outset',
    end = 'outset',
    lengthRatio = 2,
    style = 'dashed',
    forceSolid = false
  } = opts

  if (forceSolid || style === 'none') return NONE

  let dashLength = 0
  let dashCount = 0
  let ratio = 1
  let gapLength = 0
  let strokeDashoffset = 0
  let length = totalLength

  switch (style) {
    case 'dashed':
      ratio = 1
      dashLength = Math.min(strokeWidth * lengthRatio, length / 4)
      break
    case 'dotted':
      ratio = 100
      dashLength = strokeWidth / ratio
      break
    default:
      return NONE
  }

  if (!closed) {
    if (start === 'outset') {
      length += dashLength / 2
      strokeDashoffset += dashLength / 2
    } else if (start === 'skip') {
      length -= dashLength
      strokeDashoffset -= dashLength
    }

    if (end === 'outset') {
      length += dashLength / 2
    } else if (end === 'skip') {
      length -= dashLength
    }
  }

  dashCount = Math.floor(length / dashLength / (2 * ratio))
  dashCount -= dashCount % snap

  if (dashCount < 3 && style === 'dashed') {
    if (length / strokeWidth < 4) {
      dashLength = length
      dashCount = 1
      gapLength = 0
    } else {
      dashLength = length * (1 / 3)
      gapLength = length * (1 / 3)
    }
  } else {
    dashLength = length / dashCount / (2 * ratio)
    if (closed) {
      strokeDashoffset = dashLength / 2
      gapLength = (length - dashCount * dashLength) / dashCount
    } else {
      gapLength = (length - dashCount * dashLength) / Math.max(1, dashCount - 1)
    }
  }

  return {
    strokeDasharray: [dashLength, gapLength].join(' '),
    strokeDashoffset: strokeDashoffset.toString()
  }
}

export function dashedBoxPath(sides: Array<[{ x: number; y: number }, { x: number; y: number }]>, strokeWidth: number): Path2D | undefined {
  if (typeof Path2D === 'undefined') return undefined
  const path = new Path2D()
  for (const [start, end] of sides) {
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length <= 0) continue
    const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(length, strokeWidth, {
      style: 'dashed',
      lengthRatio: 4
    })
    if (strokeDasharray === 'none') {
      path.moveTo(start.x, start.y)
      path.lineTo(end.x, end.y)
      continue
    }
    const [dashLength, gapLength] = strokeDasharray.split(' ').map(Number)
    const period = dashLength + gapLength
    if (!Number.isFinite(period) || period <= 0) continue
    const offset = Number(strokeDashoffset)
    const dx = (end.x - start.x) / length
    const dy = (end.y - start.y) / length
    for (let at = -offset; at < length; at += period) {
      const to = Math.min(length, at + dashLength)
      const from = Math.max(0, at)
      if (to <= from) continue
      path.moveTo(start.x + dx * from, start.y + dy * from)
      path.lineTo(start.x + dx * to, start.y + dy * to)
    }
  }
  return path
}
