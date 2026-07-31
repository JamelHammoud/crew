import { escapeXml } from './text'

export type ColorName =
  | 'black'
  | 'grey'
  | 'light-violet'
  | 'violet'
  | 'blue'
  | 'light-blue'
  | 'yellow'
  | 'orange'
  | 'green'
  | 'light-green'
  | 'light-red'
  | 'red'
  | 'white'

interface ColorSet {
  solid: string
  fill: string
  semi: string
  pattern: string
  note: string
}

const LIGHT: Record<ColorName, ColorSet> = {
  black: { solid: '#1d1d1d', fill: '#1d1d1d', semi: '#e8e8e8', pattern: '#494949', note: '#FCE19C' },
  grey: { solid: '#9fa8b2', fill: '#9fa8b2', semi: '#eceef0', pattern: '#bcc3c9', note: '#C0CAD3' },
  'light-violet': { solid: '#e085f4', fill: '#e085f4', semi: '#f5eafa', pattern: '#e9acf8', note: '#DFB0F9' },
  violet: { solid: '#ae3ec9', fill: '#ae3ec9', semi: '#ecdcf2', pattern: '#bd63d3', note: '#DB91FD' },
  blue: { solid: '#4465e9', fill: '#4465e9', semi: '#dce1f8', pattern: '#6681ee', note: '#8AA3FF' },
  'light-blue': { solid: '#4ba1f1', fill: '#4ba1f1', semi: '#ddedfa', pattern: '#6fbbf8', note: '#9BC4FD' },
  yellow: { solid: '#f1ac4b', fill: '#f1ac4b', semi: '#f9f0e6', pattern: '#fecb92', note: '#FED49A' },
  orange: { solid: '#e16919', fill: '#e16919', semi: '#f8e2d4', pattern: '#f78438', note: '#FAA475' },
  green: { solid: '#099268', fill: '#099268', semi: '#d3e9e3', pattern: '#39a785', note: '#6FC896' },
  'light-green': { solid: '#4cb05e', fill: '#4cb05e', semi: '#dbf0e0', pattern: '#65cb78', note: '#98D08A' },
  'light-red': { solid: '#f87777', fill: '#f87777', semi: '#f4dadb', pattern: '#fe9e9e', note: '#F7A5A1' },
  red: { solid: '#e03131', fill: '#e03131', semi: '#f4dadb', pattern: '#e55959', note: '#FC8282' },
  white: { solid: '#ffffff', fill: '#ffffff', semi: '#f5f5f5', pattern: '#f9f9f9', note: '#ffffff' }
}

const DARK_SOLID: Partial<Record<ColorName, string>> = {
  black: '#f2f2f2',
  grey: '#9398b0',
  'light-violet': '#e599f7',
  violet: '#be4bdb',
  blue: '#4f72fc',
  'light-blue': '#4dabf7',
  yellow: '#ffc078',
  orange: '#f76707',
  green: '#099268',
  'light-green': '#40c057',
  'light-red': '#ff8787',
  red: '#e03131',
  white: '#ffffff'
}

export function colorName(value: unknown): ColorName {
  return String(value ?? '') in LIGHT ? (value as ColorName) : 'black'
}

export function themeColor(value: unknown, kind: keyof ColorSet, darkMode: boolean): string {
  const name = colorName(value)
  if (darkMode && kind === 'solid') return DARK_SOLID[name] ?? LIGHT[name].solid
  return LIGHT[name][kind]
}

export function fillPaint(fill: unknown, color: unknown, darkMode: boolean, patternId: string): string {
  if (fill === 'none') return 'none'
  if (fill === 'semi') return themeColor(color, 'semi', darkMode)
  if (fill === 'pattern') return `url(#${escapeXml(patternId)})`
  return themeColor(color, 'fill', darkMode)
}

export function dashArray(dash: unknown, width: number): string | null {
  if (dash === 'dashed') return `${width * 3} ${width * 2}`
  if (dash === 'dotted') return `0 ${width * 2}`
  return null
}

export function patternDef(id: string, color: string): string {
  return `<pattern id="${escapeXml(id)}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#ffffff"/><path d="M0 0V8" stroke="${escapeXml(color)}" stroke-width="2"/></pattern>`
}
