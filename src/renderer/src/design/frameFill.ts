export const FRAME_BACKGROUND = '#ffffff'

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function frameBackground(meta: Record<string, unknown> | undefined): string {
  const value = meta?.background
  if (typeof value !== 'string' || !HEX.test(value.trim())) return FRAME_BACKGROUND
  return value.trim().toLowerCase()
}

function channels(hex: string): [number, number, number] {
  const body = hex.slice(1)
  const full = body.length === 3 ? body.replace(/./g, part => part + part) : body
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ]
}

export function isLightFill(hex: string): boolean {
  const [r, g, b] = channels(hex)
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255 > 0.6
}

export function frameStroke(hex: string): string {
  return isLightFill(hex) ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.16)'
}
