import type { TLRichText, TLRichTextNode } from '../schema/richText'
import { finite, round, type Point } from './geometry'

const XML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
}

export function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => XML[character])
}

function nodeText(node: TLRichTextNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(nodeText).join('')
}

export function richLines(value: unknown): string[] {
  const rich = value as TLRichText | null | undefined
  if (!rich?.content || !Array.isArray(rich.content)) return []
  return rich.content.flatMap(node => nodeText(node).split('\n'))
}

export function plainLines(value: unknown): string[] {
  return String(value ?? '').split('\n')
}

export interface SvgTextOptions {
  x: number
  y: number
  w: number
  h: number
  lines: string[]
  size: number
  lineHeight: number
  family: string
  weight?: number | string
  color: string
  align?: string
  vertical?: string
  italic?: boolean
  spacing?: number
  decoration?: string
  transform?: string
  padding?: number
}

const FONTS: Record<string, string> = {
  draw: 'cursive',
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, Menlo, monospace'
}

export function fontFamily(value: unknown): string {
  const name = String(value ?? 'sans')
  return FONTS[name] ?? `&quot;${escapeXml(name)}&quot;, ui-sans-serif, system-ui, sans-serif`
}

export function svgText(options: SvgTextOptions): string {
  const lines = options.lines.length > 0 ? options.lines : ['']
  if (lines.every(line => line === '')) return ''
  const padding = finite(options.padding)
  const size = Math.max(1, finite(options.size, 16))
  const line = size * Math.max(0.5, finite(options.lineHeight, 1.2))
  const total = lines.length * line
  const align =
    options.align === 'middle' || options.align === 'center'
      ? 'middle'
      : options.align === 'end' || options.align === 'right'
        ? 'end'
        : 'start'
  const x =
    align === 'middle'
      ? options.x + options.w / 2
      : align === 'end'
        ? options.x + options.w - padding
        : options.x + padding
  const vertical = options.vertical
  const y =
    vertical === 'middle' || vertical === 'center'
      ? options.y + (options.h - total) / 2 + size
      : vertical === 'end' || vertical === 'bottom'
        ? options.y + options.h - total + size - padding
        : options.y + size + padding
  const attrs = [
    `x="${round(x)}"`,
    `y="${round(y)}"`,
    `fill="${escapeXml(options.color)}"`,
    `font-family="${fontFamily(options.family)}"`,
    `font-size="${round(size)}"`,
    `font-weight="${escapeXml(options.weight ?? 400)}"`,
    `text-anchor="${align}"`,
    options.italic ? 'font-style="italic"' : '',
    finite(options.spacing) !== 0 ? `letter-spacing="${round(finite(options.spacing))}"` : '',
    options.decoration === 'underline' ? 'text-decoration="underline"' : '',
    options.decoration === 'strike' ? 'text-decoration="line-through"' : ''
  ].filter(Boolean)
  const transformed = lines.map(lineText => {
    if (options.transform === 'upper') return lineText.toUpperCase()
    if (options.transform === 'lower') return lineText.toLowerCase()
    return lineText
  })
  return `<text ${attrs.join(' ')}>${transformed.map((text, index) => `<tspan x="${round(x)}" dy="${index === 0 ? 0 : round(line)}">${escapeXml(text)}</tspan>`).join('')}</text>`
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function bytesFromBase64(value: string): Uint8Array {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  const length = Math.floor((value.length * 3) / 4) - padding
  const bytes = new Uint8Array(Math.max(0, length))
  let at = 0
  for (let index = 0; index < value.length; index += 4) {
    const a = Math.max(0, BASE64.indexOf(value[index] ?? 'A'))
    const b = Math.max(0, BASE64.indexOf(value[index + 1] ?? 'A'))
    const c = Math.max(0, BASE64.indexOf(value[index + 2] ?? 'A'))
    const d = Math.max(0, BASE64.indexOf(value[index + 3] ?? 'A'))
    const bits = (a << 18) | (b << 12) | (c << 6) | d
    if (at < bytes.length) bytes[at++] = (bits >> 16) & 255
    if (at < bytes.length) bytes[at++] = (bits >> 8) & 255
    if (at < bytes.length) bytes[at++] = bits & 255
  }
  return bytes
}

function float16(bits: number): number {
  const sign = bits >> 15
  const exponent = (bits >> 10) & 31
  const fraction = bits & 1023
  if (exponent === 0) return (sign ? -1 : 1) * fraction * 2 ** -24
  if (exponent === 31) return fraction ? Number.NaN : sign ? -Infinity : Infinity
  return (sign ? -1 : 1) * 2 ** (exponent - 15) * (1 + fraction / 1024)
}

export function decodeDrawPoints(path: string, dimensions: unknown): Point[] {
  if (!path) return []
  try {
    const bytes = bytesFromBase64(path)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const is2d = dimensions === 2
    const first = is2d ? 8 : 12
    const stride = is2d ? 4 : 6
    if (bytes.byteLength < first) return []
    let x = view.getFloat32(0, true)
    let y = view.getFloat32(4, true)
    const points: Point[] = [{ x, y }]
    for (let offset = first; offset + stride <= bytes.byteLength; offset += stride) {
      x += float16(view.getUint16(offset, true))
      y += float16(view.getUint16(offset + 2, true))
      points.push({ x, y })
    }
    return points
  } catch {
    return []
  }
}
