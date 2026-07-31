import type { Box } from '../../math/Box'
import type { SelectionHandle } from '../../math/Box'
import { Vec } from '../../math/Vec'
import type { TLShape } from '../../schema'

export type ResizeMode = 'resize_bounds' | 'scale_shape'

export interface ResizeInfo<Shape extends TLShape> {
  newPoint: Vec
  handle: SelectionHandle
  mode: ResizeMode
  scaleX: number
  scaleY: number
  initialBounds: Box
  initialShape: Shape
}

export type TLResizeMode = ResizeMode
export type TLResizeInfo<Shape extends TLShape> = ResizeInfo<Shape>

export interface ResizeBoxOptions {
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
}

export function resizeBox<Shape extends TLShape & { props: { w: number; h: number } }>(
  shape: Shape,
  info: ResizeInfo<Shape>,
  options: ResizeBoxOptions = {}
): Shape {
  const { newPoint, handle, scaleX, scaleY } = info
  const {
    minWidth = 1,
    maxWidth = Infinity,
    minHeight = 1,
    maxHeight = Infinity
  } = options

  let w = shape.props.w * scaleX
  let h = shape.props.h * scaleY
  const offset = new Vec()

  if (w > 0) {
    if (w < minWidth) {
      if (handle === 'top_left' || handle === 'left' || handle === 'bottom_left') {
        offset.x = w - minWidth
      } else if (handle === 'top' || handle === 'bottom') {
        offset.x = (w - minWidth) / 2
      }
      w = minWidth
    }
  } else {
    offset.x = w
    w = -w
    if (w < minWidth) {
      if (handle === 'top_left' || handle === 'left' || handle === 'bottom_left') {
        offset.x = -w
      } else {
        offset.x = -minWidth
      }
      w = minWidth
    }
  }

  if (h > 0) {
    if (h < minHeight) {
      if (handle === 'top_left' || handle === 'top' || handle === 'top_right') {
        offset.y = h - minHeight
      } else if (handle === 'right' || handle === 'left') {
        offset.y = (h - minHeight) / 2
      }
      h = minHeight
    }
  } else {
    offset.y = h
    h = -h
    if (h < minHeight) {
      if (handle === 'top_left' || handle === 'top' || handle === 'top_right') {
        offset.y = -h
      } else {
        offset.y = -minHeight
      }
      h = minHeight
    }
  }

  const point = offset.rot(shape.rotation).add(newPoint)

  return {
    ...shape,
    x: point.x,
    y: point.y,
    props: {
      ...shape.props,
      w: Math.min(maxWidth, w),
      h: Math.min(maxHeight, h)
    }
  }
}
