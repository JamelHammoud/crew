import { BIRD, PIPE } from './flappy'
import type { Kind } from './tetris'

// A game is a picture rather than chrome, so its own colors are pinned the way
// the design canvas pins its palette: the field is the same deep blue in a light
// window as in a dark one, and nothing in here follows the theme.
export const FIELD = '#141a2b'
export const LINE = 'rgba(255, 255, 255, 0.05)'
export const GHOST = 'rgba(255, 255, 255, 0.16)'

// The seven pieces, in the same soft palette the covers are painted from:
// nothing dark, nothing near white, and no two of them the same at a glance.
export const BLOCKS: Record<Kind, string> = {
  I: '#6fe9ff',
  J: '#7ba6ff',
  L: '#ffb066',
  O: '#ffd76f',
  S: '#7fe6a4',
  T: '#c08cff',
  Z: '#ff8a9c'
}

export const SKY = '#1b2540'
export const PIPE_COLOR = '#7fe6a4'
export const PIPE_LIP = '#a5f0c1'
export const BIRD_COLOR = '#ffd76f'
export const BIRD_WING = '#ffb066'
export const GROUND_COLOR = '#2c3a5e'

// The canvas is drawn at the size it is really shown at, times whatever the
// screen packs into a point, or every edge in the game comes out soft on a
// retina display. The context comes back already scaled, so nothing that draws
// has to know any of it.
export function fitCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): CanvasRenderingContext2D | null {
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(width * dpr))
  const h = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(w / width, 0, 0, h / height, 0, 0)
  return ctx
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

// One block of a piece. The lighter face along the top is what tells a stack of
// them from a wall of one color.
export function block(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const pad = Math.max(0.5, size * 0.07)
  const side = size - pad * 2
  roundRect(ctx, x + pad, y + pad, side, side, Math.max(1.5, size * 0.22))
  ctx.fillStyle = color
  ctx.fill()
  const inset = pad * 2.4
  roundRect(ctx, x + inset, y + inset, size - inset * 2, (size - inset * 2) * 0.32, Math.max(1, size * 0.12))
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)'
  ctx.fill()
}

export function outline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const pad = Math.max(0.5, size * 0.07)
  roundRect(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, Math.max(1.5, size * 0.22))
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, size * 0.08)
  ctx.stroke()
}
