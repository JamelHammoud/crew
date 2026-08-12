import { BIRD, PIPE } from './flappy'
import type { Kind } from './tetris'

// A game is a picture rather than chrome, so its own colors are pinned the way
// the design canvas pins its palette: the field is the same deep blue in a light
// window as in a dark one, and nothing in here follows the theme.
export const FIELD = '#141a2b'
export const WELL = 'rgba(0, 0, 0, 0.28)'
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
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
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

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
export function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
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

export function outline(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  const pad = Math.max(0.5, size * 0.07)
  roundRect(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, Math.max(1.5, size * 0.22))
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, size * 0.08)
  ctx.stroke()
}

// A pipe is drawn past the top and the bottom of the world rather than up to
// them, so its rounded corners are only ever the two that face the gap. Its size
// is asked for rather than read off the world, because the same drawing paints
// the still on the game's own row at a size the world knows nothing about.
export function pipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  gap: number,
  floor: number,
  width = PIPE.width,
  opening = PIPE.gap
): void {
  const top = gap - opening / 2
  const bottom = gap + opening / 2
  const lip = { height: width * 0.3, out: width * 0.1 }
  const over = width * 0.3
  ctx.fillStyle = PIPE_COLOR
  roundRect(ctx, x, -over, width, top + over, width * 0.12)
  ctx.fill()
  roundRect(ctx, x, bottom, width, floor - bottom + over, width * 0.12)
  ctx.fill()
  ctx.fillStyle = PIPE_LIP
  roundRect(ctx, x - lip.out, top - lip.height, width + lip.out * 2, lip.height, width * 0.1)
  ctx.fill()
  roundRect(ctx, x - lip.out, bottom, width + lip.out * 2, lip.height, width * 0.1)
  ctx.fill()
}

// The bird tips with what it is doing rather than staying level, so a fall reads
// as a fall and a flap reads as one without anything else being drawn.
export function bird(ctx: CanvasRenderingContext2D, x: number, y: number, vy: number, r = BIRD.r): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.max(-0.5, Math.min(0.9, vy / 420)))
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = BIRD_COLOR
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(r * 0.6, -r * 0.1)
  ctx.lineTo(r * 1.55, r * 0.1)
  ctx.lineTo(r * 0.6, r * 0.36)
  ctx.closePath()
  ctx.fillStyle = BIRD_WING
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-r * 0.22, r * 0.17, r * 0.55, r * 0.4, -0.3, 0, Math.PI * 2)
  ctx.fillStyle = BIRD_WING
  ctx.fill()
  ctx.beginPath()
  ctx.arc(r * 0.35, -r * 0.35, r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = '#2b2f45'
  ctx.fill()
  ctx.restore()
}
