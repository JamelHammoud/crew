import { orbRadius, ORB_BLOBS, type OrbFace } from './orb'

// How many points the outline is read at. Fewer and the harmonics come out as a
// polygon; the highest one turns nine times around the circle, so it needs
// several points per lobe before it is a curve at all.
const STEPS = 180

const RING_WIDTH = 2

export interface OrbPaint {
  // What the orb is drawn in when the mesh is down, which is whatever the app
  // is set in. The mark is currentColor at rest and so is this.
  ink: string
  ring: string
}

const around = (face: OrbFace, base: number, at: number): { x: number; y: number } => {
  const angle = (at / STEPS) * Math.PI * 2
  const radius = orbRadius(face, angle, base)
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

// A closed curve through the points rather than a line to each one. Straight
// segments show up as facets the moment the orb is still, which is most of the
// time it is on screen.
function outline(ctx: CanvasRenderingContext2D, face: OrbFace, base: number): void {
  ctx.beginPath()
  const first = around(face, base, 0)
  const last = around(face, base, STEPS - 1)
  ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let at = 0; at < STEPS; at++) {
    const here = around(face, base, at)
    const next = around(face, base, at + 1)
    ctx.quadraticCurveTo(here.x, here.y, (here.x + next.x) / 2, (here.y + next.y) / 2)
  }
  ctx.closePath()
}

export function drawOrb(
  ctx: CanvasRenderingContext2D,
  face: OrbFace,
  size: number,
  base: number,
  paint: OrbPaint
): void {
  const half = size / 2
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(half, half)

  // The light the orb throws, drawn first and wide. It is the same field the
  // inside is, so what spills is the color of what is behind the glass.
  const glow = ctx.createRadialGradient(0, 0, base * 0.4, 0, 0, base * 2.1)
  const spill = 0.1 + face.level * 0.26
  glow.addColorStop(0, withAlpha(face.lit > 0.5 ? ORB_BLOBS[0].color : paint.ink, spill))
  glow.addColorStop(1, withAlpha(paint.ink, 0))
  ctx.fillStyle = glow
  ctx.fillRect(-half, -half, size, size)

  outline(ctx, face, base)
  ctx.save()
  ctx.clip()

  const body = ctx.createRadialGradient(-base * 0.3, -base * 0.34, base * 0.05, 0, 0, base * 1.25)
  body.addColorStop(0, withAlpha(paint.ink, 0.95))
  body.addColorStop(0.55, withAlpha(paint.ink, 0.82))
  body.addColorStop(1, withAlpha(paint.ink, 0.6))
  ctx.fillStyle = body
  ctx.fillRect(-half, -half, size, size)

  // The mesh, only as far up as the agent's own voice has brought it. Painted
  // over the body rather than instead of it, so the two ends of the fade are
  // the same drawing at two strengths.
  if (face.lit > 0.01) {
    ctx.globalAlpha = face.lit
    ctx.globalCompositeOperation = 'source-over'
    for (let index = 0; index < ORB_BLOBS.length; index++) {
      const blob = ORB_BLOBS[index]
      const turn = face.breath * blob.rate + blob.lag
      const push = blob.reach * (0.6 + face.bands[index % face.bands.length] * 1.6)
      const x = (blob.x + Math.cos(turn) * push) * base
      const y = (blob.y + Math.sin(turn * 0.86) * push) * base
      const r = blob.r * base * (1 + face.bands[index % face.bands.length] * 0.22)
      const wash = ctx.createRadialGradient(x, y, 0, x, y, r)
      wash.addColorStop(0, withAlpha(blob.color, 0.95))
      wash.addColorStop(0.45, withAlpha(blob.color, 0.6))
      wash.addColorStop(1, withAlpha(blob.color, 0))
      ctx.fillStyle = wash
      ctx.fillRect(-half, -half, size, size)
    }
    ctx.globalAlpha = 1
  }

  // Where the light lands, and the shade drawn in all round the edge. Between
  // them they are the difference between a disc and a bead, which is the same
  // pair of passes the app icon's discs are built from.
  const shine = ctx.createRadialGradient(-base * 0.36, -base * 0.42, 0, -base * 0.36, -base * 0.42, base * 0.95)
  shine.addColorStop(0, 'rgba(255,255,255,0.42)')
  shine.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = shine
  ctx.fillRect(-half, -half, size, size)

  const shade = ctx.createRadialGradient(0, 0, base * 0.62, 0, 0, base * 1.02)
  shade.addColorStop(0, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = shade
  ctx.fillRect(-half, -half, size, size)
  ctx.restore()

  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.stroke()

  if (face.ring > 0.001 && face.ring < 0.999) drawRing(ctx, base, face.ring, paint.ring)
  ctx.restore()
}

// While the two models are being fetched. It is the one thing on the orb that
// is not the voice, so it stands outside the shape rather than on it.
function drawRing(ctx: CanvasRenderingContext2D, base: number, at: number, color: string): void {
  const radius = base * 1.22
  ctx.lineWidth = RING_WIDTH
  ctx.lineCap = 'round'
  ctx.strokeStyle = withAlpha(color, 0.16)
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = withAlpha(color, 0.9)
  ctx.beginPath()
  ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * at)
  ctx.stroke()
}

// A color the app already holds, at an opacity. The app's own are given as
// hex or as rgb, and a canvas takes neither with an alpha on the end.
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const raw = hex[1]
    const full = raw.length === 3 ? [...raw].map(one => one + one).join('') : raw
    const value = parseInt(full, 16)
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
  }
  const parts = /^rgba?\(([^)]+)\)$/i.exec(color.trim())
  if (parts) {
    const [r, g, b] = parts[1].split(/[\s,/]+/).filter(Boolean)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}
