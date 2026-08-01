import type { VecLike } from '../math'
import type { BoundsSnapIndicator } from '../tools/snaps'

const LINE = 1
const CAP = 4
const LABEL_HEIGHT = 16
const LABEL_RADIUS = 3
const LABEL_PAD = 5
const LABEL_SIZE = 11
const LABEL_FACE =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
const LABEL_INK = '#ffffff'

export function drawSnapGuides(
  context: CanvasRenderingContext2D,
  indicators: readonly BoundsSnapIndicator[],
  zoom: number,
  color: string
): void {
  context.save()
  context.setLineDash([])
  context.strokeStyle = color
  context.fillStyle = color
  context.lineWidth = LINE / zoom
  for (const indicator of indicators) {
    if (indicator.type === 'points') drawAlignment(context, indicator.points)
    else drawGaps(context, indicator, zoom, color)
  }
  context.restore()
}

function drawAlignment(context: CanvasRenderingContext2D, points: readonly VecLike[]): void {
  if (points.length < 2) return
  const upright = points.every(point => Math.abs(point.x - points[0].x) < 1e-8)
  const sorted = [...points].sort((a, b) => (upright ? a.y - b.y : a.x - b.x))
  const head = sorted[0]
  const tail = sorted[sorted.length - 1]
  context.beginPath()
  context.moveTo(head.x, head.y)
  context.lineTo(tail.x, tail.y)
  context.stroke()
}

function drawGaps(
  context: CanvasRenderingContext2D,
  indicator: Extract<BoundsSnapIndicator, { type: 'gaps' }>,
  zoom: number,
  color: string
): void {
  const cap = CAP / zoom
  const across = indicator.direction === 'horizontal'
  for (const gap of indicator.gaps) {
    const along = across
      ? sharedRangeCenter(gap.startEdge[0].y, gap.startEdge[1].y, gap.endEdge[0].y, gap.endEdge[1].y)
      : sharedRangeCenter(gap.startEdge[0].x, gap.startEdge[1].x, gap.endEdge[0].x, gap.endEdge[1].x)
    const start = across ? gap.startEdge[0].x : gap.startEdge[0].y
    const end = across ? gap.endEdge[0].x : gap.endEdge[0].y
    const at = (value: number): VecLike => (across ? { x: value, y: along } : { x: along, y: value })
    const off = (value: number, shift: number): VecLike =>
      across ? { x: value, y: along + shift } : { x: along + shift, y: value }
    context.beginPath()
    context.moveTo(at(start).x, at(start).y)
    context.lineTo(at(end).x, at(end).y)
    for (const edge of [start, end]) {
      context.moveTo(off(edge, -cap).x, off(edge, -cap).y)
      context.lineTo(off(edge, cap).x, off(edge, cap).y)
    }
    context.stroke()
    drawLabel(context, String(Math.round(Math.abs(end - start))), at((start + end) / 2), zoom, color)
  }
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  at: VecLike,
  zoom: number,
  color: string
): void {
  context.save()
  context.font = `500 ${LABEL_SIZE / zoom}px ${LABEL_FACE}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const width = context.measureText('0').width * text.length + (LABEL_PAD / zoom) * 2
  const height = LABEL_HEIGHT / zoom
  context.fillStyle = color
  context.beginPath()
  context.roundRect(at.x - width / 2, at.y - height / 2, width, height, LABEL_RADIUS / zoom)
  context.fill()
  context.fillStyle = LABEL_INK
  context.fillText(text, at.x, at.y)
  context.restore()
}

function sharedRangeCenter(a0: number, a1: number, b0: number, b1: number): number {
  const start = Math.max(Math.min(a0, a1), Math.min(b0, b1))
  const end = Math.min(Math.max(a0, a1), Math.max(b0, b1))
  if (start <= end) return (start + end) / 2
  return (a0 + a1 + b0 + b1) / 4
}
