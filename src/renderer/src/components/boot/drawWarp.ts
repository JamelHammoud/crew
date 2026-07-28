import { MESH_COLORS } from '../CrewMark'
import { DEPTH, TRAIL, brightness, project, type Star, type View } from './warp'

// Most of the field is white, and a few of them carry the light the mark is
// made of, so the color in the picture comes from one table rather than from a
// palette the boot made up for itself.
const TINTED = 0.22

const CLOUDS = [
  { color: MESH_COLORS[0], x: 0.3, y: 0.36, r: 0.62, alpha: 0.2, drift: 0.055, lag: 0 },
  { color: MESH_COLORS[1], x: 0.66, y: 0.6, r: 0.7, alpha: 0.17, drift: -0.04, lag: 1.9 },
  { color: MESH_COLORS[3], x: 0.78, y: 0.3, r: 0.5, alpha: 0.13, drift: 0.07, lag: 3.4 }
]

function starColor(star: Star): string {
  if (star.tint > TINTED) return '#ffffff'
  return MESH_COLORS[Math.floor((star.tint / TINTED) * MESH_COLORS.length) % MESH_COLORS.length]
}

// The dust the field is travelling through. It is drawn behind everything and
// moves at a fraction of the stars, which is what gives the flight a far
// distance as well as a near one.
function paintClouds(ctx: CanvasRenderingContext2D, view: View, t: number, lit: number): void {
  ctx.globalCompositeOperation = 'lighter'
  for (const cloud of CLOUDS) {
    const swing = Math.sin(t * cloud.drift * Math.PI * 2 + cloud.lag)
    const cx = (cloud.x + swing * 0.05) * view.width
    const cy = (cloud.y + Math.cos(t * cloud.drift * Math.PI * 2 + cloud.lag) * 0.04) * view.height
    const r = cloud.r * Math.min(view.width, view.height)
    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    wash.addColorStop(0, cloud.color)
    wash.addColorStop(1, 'transparent')
    ctx.globalAlpha = cloud.alpha * lit
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, view.width, view.height)
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
  shade.addColorStop(1, 'rgba(0,0,0,0.72)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, view.width, view.height)
}

export function paintWarp(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  view: View,
  speed: number,
  dt: number,
  t: number
): void {
  ctx.clearRect(0, 0, view.width, view.height)
  paintClouds(ctx, view, t, Math.min(t / 1.2, 1))
  paintStars(ctx, stars, view, speed, dt)
  paintVignette(ctx, view)
}
