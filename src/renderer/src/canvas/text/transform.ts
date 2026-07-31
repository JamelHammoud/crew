export interface TextTransform {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface TextPoint {
  x: number
  y: number
}

export const IDENTITY_TEXT_TRANSFORM: TextTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }

export function textTransformCss(transform: TextTransform): string {
  return `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}rad) scale(${transform.scaleX}, ${transform.scaleY})`
}

export function textPointToScreen(point: TextPoint, transform: TextTransform): TextPoint {
  const x = point.x * transform.scaleX
  const y = point.y * transform.scaleY
  const cosine = Math.cos(transform.rotation)
  const sine = Math.sin(transform.rotation)
  return { x: transform.x + x * cosine - y * sine, y: transform.y + x * sine + y * cosine }
}

export function screenPointToText(point: TextPoint, transform: TextTransform): TextPoint {
  const x = point.x - transform.x
  const y = point.y - transform.y
  const cosine = Math.cos(transform.rotation)
  const sine = Math.sin(transform.rotation)
  return {
    x: (x * cosine + y * sine) / transform.scaleX,
    y: (-x * sine + y * cosine) / transform.scaleY
  }
}
