export type Align = 'left' | 'center-horizontal' | 'right' | 'top' | 'center-vertical' | 'bottom'

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
  midX: number
  midY: number
}

export function alignOffset(shape: Box, within: Box, op: Align): { x: number; y: number } {
  if (op === 'left') return { x: within.minX - shape.minX, y: 0 }
  if (op === 'center-horizontal') return { x: within.midX - shape.midX, y: 0 }
  if (op === 'right') return { x: within.maxX - shape.maxX, y: 0 }
  if (op === 'top') return { x: 0, y: within.minY - shape.minY }
  if (op === 'center-vertical') return { x: 0, y: within.midY - shape.midY }
  return { x: 0, y: within.maxY - shape.maxY }
}
