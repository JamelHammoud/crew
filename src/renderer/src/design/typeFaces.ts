import type { TypeStyle } from '../../../shared/designNode'

export interface TypeFace {
  value: string
  label: string
  weight: number
  italic: boolean
}

const NAMES: Array<{ weight: number; label: string }> = [
  { weight: 100, label: 'Thin' },
  { weight: 200, label: 'Extra Light' },
  { weight: 300, label: 'Light' },
  { weight: 400, label: 'Regular' },
  { weight: 500, label: 'Medium' },
  { weight: 600, label: 'Semi Bold' },
  { weight: 700, label: 'Bold' },
  { weight: 800, label: 'Extra Bold' },
  { weight: 900, label: 'Black' }
]

export const FACES: TypeFace[] = [
  ...NAMES.map(name => ({ value: `${name.weight}`, label: name.label, weight: name.weight, italic: false })),
  ...NAMES.map(name => ({
    value: `${name.weight}i`,
    label: name.label === 'Regular' ? 'Italic' : `${name.label} Italic`,
    weight: name.weight,
    italic: true
  }))
]

export const SIZES = [8, 10, 11, 12, 14, 16, 18, 20, 24, 32, 36, 40, 48, 64, 96, 128]

export function faceValue(type: TypeStyle): string {
  const weight = NAMES.reduce((best, name) =>
    Math.abs(name.weight - type.weight) < Math.abs(best.weight - type.weight) ? name : best
  ).weight
  return `${weight}${type.italic ? 'i' : ''}`
}

export function faceStyle(value: string): { weight: number; italic: boolean } {
  const face = FACES.find(item => item.value === value)
  return face ? { weight: face.weight, italic: face.italic } : { weight: 400, italic: false }
}
