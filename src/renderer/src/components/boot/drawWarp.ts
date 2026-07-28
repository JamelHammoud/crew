import { MESH_COLORS } from '../CrewMark'
import { DEPTH, TRAIL, brightness, project, type Star, type View } from './warp'

// Most of the field is white, and a few of them carry the light the mark is
// made of, so the color in the picture comes from one table rather than from a
// palette the boot made up for itself.
const TINTED = 0.22

// The cloud is drawn in layers, near and far, each one turning, breathing and
// drifting its own way. Two of them moving against each other is what makes the
// picture churn rather than slide: one layer over a window is wallpaper however
// good it is, because nothing in it moves against anything else.
const LAYERS = [
  { cloud: 0, scale: 1.5, spin: 0.09, sway: 0.19, breathe: 0.1, beat: 0.62, drift: 0.9, lag: 0, alpha: 0.34 },
  { cloud: 1, scale: 2.4, spin: -0.13, sway: 0.14, breathe: 0.14, beat: 0.44, drift: -1.4, lag: 2.2, alpha: 0.2 },
  { cloud: 0, scale: 3.4, spin: 0.06, sway: 0.26, breathe: 0.09, beat: 0.31, drift: 0.5, lag: 4.1, alpha: 0.12 }
]

// How hard the flight drags the cloud past the window. It is the travel the
// stars have already made rather than a clock, so the cloud rushes while the
// field is at lightspeed and settles as it comes off it: the two are one
// movement, and a cloud on a clock of its own reads as a backdrop behind the
// flight instead of the thing being flown through.
const RUSH = 0.5

function starColor(star: Star): string {
  if (star.tint > TINTED) return '#ffffff'
  return MESH_COLORS[Math.floor((star.tint / TINTED) * MESH_COLORS.length) % MESH_COLORS.length]
}

// The cloud the field is travelling through, laid over the whole window and
// drawn larger than it so there is always more of it to come as it drifts.
function paintNebula(
  ctx: CanvasRenderingContext2D,
  clouds: CanvasImageSource[],
  view: View,
  t: number,
  travel: number,
  lit: number
): void {
  ctx.globalCompositeOperation = 'lighter'
  const middle = { x: view.width / 2, y: view.height / 2 }
  for (const layer of LAYERS) {
    const cloud = clouds[layer.cloud % clouds.length]
    if (!cloud) continue
    const grown = layer.scale * (1 + travel * RUSH) * (1 + Math.sin(t * layer.beat + layer.lag) * layer.breathe)
    const width = view.width * grown
    const height = view.height * grown
    const along = (Math.sin(t * 0.19 * layer.drift + layer.lag) + 1) / 2
    const down = (Math.cos(t * 0.14 * layer.drift + layer.lag * 2) + 1) / 2
    ctx.save()
    ctx.globalAlpha = layer.alpha * lit
    ctx.translate(middle.x, middle.y)
    ctx.rotate(Math.sin(t * layer.spin + layer.lag) * layer.sway)
    ctx.translate(-middle.x, -middle.y)
    ctx.drawImage(cloud, -(width - view.width) * along, -(height - view.height) * down, width, height)
    ctx.restore()
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
  travel: number,
  clouds: CanvasImageSource[]
): void {
  ctx.clearRect(0, 0, view.width, view.height)
  if (clouds.length > 0) paintNebula(ctx, clouds, view, t, travel, Math.min(t / 1.1, 1))
  paintStars(ctx, stars, view, speed, dt)
  paintVignette(ctx, view)
}
