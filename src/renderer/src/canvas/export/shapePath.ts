import { finite, pointsPath, polygonPoints, round } from './geometry'

export function boxPath(w: number, h: number, radius: unknown): string {
  const source = Array.isArray(radius) ? radius : [radius, radius, radius, radius]
  const limit = Math.min(w, h) / 2
  const [tl, tr, br, bl] = source.map(value => Math.max(0, Math.min(limit, finite(value))))
  return [
    `M${round(tl)} 0`,
    `H${round(w - tr)}`,
    tr ? `A${round(tr)} ${round(tr)} 0 0 1 ${round(w)} ${round(tr)}` : '',
    `V${round(h - br)}`,
    br ? `A${round(br)} ${round(br)} 0 0 1 ${round(w - br)} ${round(h)}` : '',
    `H${round(bl)}`,
    bl ? `A${round(bl)} ${round(bl)} 0 0 1 0 ${round(h - bl)}` : '',
    `V${round(tl)}`,
    tl ? `A${round(tl)} ${round(tl)} 0 0 1 ${round(tl)} 0` : '',
    'Z'
  ]
    .filter(Boolean)
    .join(' ')
}

export function nodePath(kind: unknown, w: number, h: number, radius: unknown): string {
  if (kind === 'ellipse')
    return `M0 ${round(h / 2)} A${round(w / 2)} ${round(h / 2)} 0 1 0 ${round(w)} ${round(h / 2)} A${round(w / 2)} ${round(h / 2)} 0 1 0 0 ${round(h / 2)} Z`
  if (kind === 'triangle') return `M${round(w / 2)} 0 L${round(w)} ${round(h)} L0 ${round(h)} Z`
  if (kind === 'diamond')
    return `M${round(w / 2)} 0 L${round(w)} ${round(h / 2)} L${round(w / 2)} ${round(h)} L0 ${round(h / 2)} Z`
  if (kind === 'pentagon') return pointsPath(polygonPoints(5, w, h))
  if (kind === 'hexagon') return pointsPath(polygonPoints(6, w, h))
  if (kind === 'star') return pointsPath(polygonPoints(5, w, h, 0.382))
  return boxPath(w, h, radius)
}

export function geoPath(kind: unknown, w: number, h: number, strokeWidth = 1): string {
  if (kind === 'ellipse') return nodePath('ellipse', w, h, 0)
  if (kind === 'triangle') return nodePath('triangle', w, h, 0)
  if (kind === 'diamond') return nodePath('diamond', w, h, 0)
  if (kind === 'pentagon') return pointsPath(polygonPoints(5, w, h))
  if (kind === 'hexagon') return pointsPath(polygonPoints(6, w, h))
  if (kind === 'octagon') return pointsPath(polygonPoints(8, w, h))
  if (kind === 'star') return pointsPath(polygonPoints(5, w, h, 0.5))
  if (kind === 'oval') {
    const radius = Math.min(w, h) / 2
    return boxPath(w, h, radius)
  }
  if (kind === 'rhombus') {
    const offset = Math.min(w, h) * 0.38
    return `M${round(offset)} 0 H${round(w)} L${round(w - offset)} ${round(h)} H0 Z`
  }
  if (kind === 'rhombus-2') {
    const offset = Math.min(w, h) * 0.38
    return `M0 0 H${round(w - offset)} L${round(w)} ${round(h)} H${round(offset)} Z`
  }
  if (kind === 'trapezoid') {
    const offset = Math.min(w, h) * 0.38
    return `M${round(offset)} 0 H${round(w - offset)} L${round(w)} ${round(h)} H0 Z`
  }
  if (kind === 'arrow-right' || kind === 'arrow-left') {
    const offset = Math.min(w, h) * 0.38
    const inset = h * 0.16
    const right = `M0 ${round(inset)} H${round(w - offset)} V0 L${round(w)} ${round(h / 2)} L${round(w - offset)} ${round(h)} V${round(h - inset)} H0 Z`
    return kind === 'arrow-right'
      ? right
      : `M${round(w)} ${round(inset)} H${round(offset)} V0 L0 ${round(h / 2)} L${round(offset)} ${round(h)} V${round(h - inset)} H${round(w)} Z`
  }
  if (kind === 'arrow-up' || kind === 'arrow-down') {
    const offset = Math.min(w, h) * 0.38
    const inset = w * 0.16
    const up = `M${round(w / 2)} 0 L${round(w)} ${round(offset)} H${round(w - inset)} V${round(h)} H${round(inset)} V${round(offset)} H0 Z`
    return kind === 'arrow-up'
      ? up
      : `M${round(inset)} 0 H${round(w - inset)} V${round(h - offset)} H${round(w)} L${round(w / 2)} ${round(h)} L0 ${round(h - offset)} H${round(inset)} Z`
  }
  if (kind === 'heart')
    return `M${round(w / 2)} ${round(h)} C0 ${round(h * 0.55)} 0 ${round(h * 0.2)} ${round(w * 0.25)} ${round(h * 0.15)} C${round(w * 0.42)} ${round(h * 0.1)} ${round(w * 0.5)} ${round(h * 0.25)} ${round(w / 2)} ${round(h * 0.32)} C${round(w * 0.5)} ${round(h * 0.25)} ${round(w * 0.58)} ${round(h * 0.1)} ${round(w * 0.75)} ${round(h * 0.15)} C${round(w)} ${round(h * 0.2)} ${round(w)} ${round(h * 0.55)} ${round(w / 2)} ${round(h)} Z`
  if (kind === 'cloud')
    return `M${round(w * 0.2)} ${round(h * 0.75)} C${round(w * 0.03)} ${round(h * 0.75)} 0 ${round(h * 0.5)} ${round(w * 0.14)} ${round(h * 0.4)} C${round(w * 0.13)} ${round(h * 0.16)} ${round(w * 0.38)} ${round(h * 0.05)} ${round(w * 0.52)} ${round(h * 0.24)} C${round(w * 0.68)} ${round(h * 0.08)} ${round(w * 0.9)} ${round(h * 0.2)} ${round(w * 0.87)} ${round(h * 0.43)} C${round(w * 1.03)} ${round(h * 0.5)} ${round(w * 0.97)} ${round(h * 0.75)} ${round(w * 0.8)} ${round(h * 0.75)} Z`
  if (kind === 'x-box') {
    const inset = Math.min(w, h, strokeWidth) * 0.62
    return `M0 0 H${round(w)} V${round(h)} H0 Z M${round(inset)} ${round(inset)} L${round(w - inset)} ${round(h - inset)} M${round(w - inset)} ${round(inset)} L${round(inset)} ${round(h - inset)}`
  }
  if (kind === 'check-box') {
    return `M0 0 H${round(w)} V${round(h)} H0 Z M${round(w * 0.3)} ${round(h * 0.52)} L${round(w * 0.45)} ${round(h * 0.75)} L${round(w * 0.78)} ${round(h * 0.25)}`
  }
  return boxPath(w, h, 0)
}
