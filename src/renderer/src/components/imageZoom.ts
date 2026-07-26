export type Box = { width: number; height: number }
export type Point = { x: number; y: number }
export type View = { scale: number; x: number; y: number }

export const FIT: View = { scale: 1, x: 0, y: 0 }

const MIN_SCALE = 1
const MAX_SCALE = 32

const hold = (value: number, limit: number): number => {
  const held = Math.min(limit, Math.max(-limit, value))
  return held === 0 ? 0 : held
}

const room = (image: Box, frame: Box, scale: number): Point => ({
  x: Math.max(0, (image.width * scale - frame.width) / 2),
  y: Math.max(0, (image.height * scale - frame.height) / 2)
})

export function settle(view: View, image: Box, frame: Box): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale))
  const limit = room(image, frame, scale)
  return { scale, x: hold(view.x, limit.x), y: hold(view.y, limit.y) }
}

export function zoomBy(view: View, factor: number, at: Point, image: Box, frame: Box): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor))
  const ratio = scale / view.scale
  return settle(
    { scale, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio },
    image,
    frame
  )
}

export function panBy(view: View, dx: number, dy: number, image: Box, frame: Box): View {
  return settle({ scale: view.scale, x: view.x - dx, y: view.y - dy }, image, frame)
}

export const pinchFactor = (deltaY: number): number => Math.exp(-deltaY / 100)

export const zoomPercent = (scale: number, ratio: number): number => Math.round(scale * ratio * 100)
