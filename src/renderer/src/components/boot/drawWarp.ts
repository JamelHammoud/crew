import { MESH_COLORS } from '../CrewMark'
import { DEPTH, TRAIL, brightness, project, type Star, type View } from './warp'

// Most of the field is white, and a few of them carry the light the mark is
// made of, so the color in the picture comes from one table rather than from a
// palette the boot made up for itself.
const TINTED = 0.22

// The cloud is drawn twice from the one picture, near and far, each drifting
// its own way. Two of them at different sizes is what gives the flight a depth
// the stars alone cannot: one layer over a window is wallpaper however good it
// is, because nothing in it moves against anything else.
const LAYERS = [
  { scale: 1.5, drift: 0.9, turn: 1, alpha: 0.34 },
  { scale: 2.45, drift: -1.5, turn: -1, alpha: 0.2 }
]

function starColor(star: Star): string {
  if (star.tint > TINTED) return '#ffffff'
  return MESH_COLORS[Math.floor((star.tint / TINTED) * MESH_COLORS.length) % MESH_COLORS.length]
}

// The cloud the field is travelling through, laid over the whole window and
// drawn larger than it so there is always more of it to come as it drifts.
function paintNebula(
  ctx: CanvasRenderingContext2D,
  cloud: CanvasImageSource,
  view: View,
  t: number,
  lit: number
): void {
  ctx.globalCompositeOperation = 'lighter'
  for (const layer of LAYERS) {
    const width = view.width * layer.scale
    const height = view.height * layer.scale
    const room = { x: width - view.width, y: height - view.height }
    const along = (Math.sin(t * 0.055 * layer.drift + layer.turn) + 1) / 2
    const down = (Math.cos(t * 0.041 * layer.drift + layer.turn * 2) + 1) / 2
    ctx.globalAlpha = layer.alpha * lit
    ctx.drawImage(cloud, -room.x * along, -room.y * down, width, height)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

// A star is a line from where it was to where it is. At speed that line crosses
// the window, and as the field slows the two ends close up until what is left
// is a point, which is the whole of dropping out of lightspeed.
function paintStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  view: View,
  speed: number,
  dt: number
): void {
  ctx.lineCap = 'round'
  ctx.globalCompositeOperation = 'lighter'
  const smear = speed * dt * TRAIL
  for (const star of stars) {
    const now = project(star.x, star.y, star.z, view)
    if (now.x < -80 || now.x > view.width + 80 || now.y < -80 || now.y > view.height + 80) continue
    const was = project(star.x, star.y, Math.min(star.z + smear, DEPTH), view)
    const lit = brightness(star.z)
    ctx.globalAlpha = Math.min(lit, 1)
    ctx.strokeStyle = starColor(star)
    ctx.lineWidth = Math.max(0.7, 2.4 * (1 - star.z / DEPTH))
    ctx.beginPath()
    ctx.moveTo(was.x, was.y)
    ctx.lineTo(now.x, now.y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

// The edges go down so the middle is the only place to look, which is where the
// mark lands.
function paintVignette(ctx: CanvasRenderingContext2D, view: View): void {
  const half = Math.max(view.width, view.height) * 0.72
  const shade = ctx.createRadialGradient(
    view.width / 2,
    view.height / 2,
    half * 0.3,
    view.width / 2,
    view.height / 2,
    half
  )
  shade.addColorStop(0, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.86)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, view.width, view.height)
}

export function paintWarp(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  view: View,
  speed: number,
  dt: number,
  t: number,
  cloud: CanvasImageSource | null
): void {
  ctx.clearRect(0, 0, view.width, view.height)
  if (cloud) paintNebula(ctx, cloud, view, t, Math.min(t / 1.1, 1))
  paintStars(ctx, stars, view, speed, dt)
  paintVignette(ctx, view)
}
