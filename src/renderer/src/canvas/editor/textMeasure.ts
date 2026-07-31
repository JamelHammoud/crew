import type { TLTextMeasure, TLTextMeasureOptions } from './types'

export class TextMeasure implements TLTextMeasure {
  constructor(private readonly getContainer?: () => HTMLElement) {}

  measureHtml(html: string, options: TLTextMeasureOptions = {}): { w: number; h: number } {
    if (typeof document === 'undefined') return estimate(stripHtml(html), options)
    const node = document.createElement('div')
    node.innerHTML = html
    apply(node, options)
    const parent = this.getContainer?.() ?? document.body
    parent.appendChild(node)
    const rect = node.getBoundingClientRect()
    const result = { w: Math.ceil(rect.width), h: Math.ceil(rect.height) }
    node.remove()
    if (result.w === 0 && result.h === 0) return estimate(node.textContent ?? stripHtml(html), options)
    return result
  }

  measureText(text: string, options: TLTextMeasureOptions = {}): { w: number; h: number } {
    if (typeof document === 'undefined') return estimate(text, options)
    const node = document.createElement('div')
    node.textContent = text
    apply(node, options)
    const parent = this.getContainer?.() ?? document.body
    parent.appendChild(node)
    const rect = node.getBoundingClientRect()
    const result = { w: Math.ceil(rect.width), h: Math.ceil(rect.height) }
    node.remove()
    if (result.w === 0 && result.h === 0) return estimate(text, options)
    return result
  }

  dispose(): void {}
}

export class FontManager {
  private readonly tracked = new Set<string>()

  trackFontsForShape(shape: { props?: Record<string, unknown> }): void {
    const font = shape.props?.font
    if (typeof font === 'string') this.tracked.add(font)
    const family = (shape.props?.type as { family?: unknown } | undefined)?.family
    if (typeof family === 'string') this.tracked.add(family)
  }

  getTrackedFonts(): string[] {
    return [...this.tracked]
  }

  dispose(): void {
    this.tracked.clear()
  }
}

function apply(node: HTMLDivElement, options: TLTextMeasureOptions): void {
  const style = node.style
  style.position = 'absolute'
  style.left = '-100000px'
  style.top = '-100000px'
  style.visibility = 'hidden'
  style.pointerEvents = 'none'
  style.whiteSpace = options.width || options.maxWidth ? 'pre-wrap' : 'pre'
  style.boxSizing = 'border-box'
  if (options.fontFamily) style.fontFamily = options.fontFamily
  if (options.fontSize) style.fontSize = `${options.fontSize}px`
  if (options.fontWeight) style.fontWeight = String(options.fontWeight)
  if (options.fontStyle) style.fontStyle = options.fontStyle
  if (options.lineHeight) style.lineHeight = String(options.lineHeight)
  if (options.letterSpacing) style.letterSpacing = `${options.letterSpacing}px`
  if (options.padding) style.padding = options.padding
  if (options.width) style.width = `${options.width}px`
  else if (options.maxWidth) style.maxWidth = `${options.maxWidth}px`
}

function estimate(text: string, options: TLTextMeasureOptions): { w: number; h: number } {
  const fontSize = options.fontSize ?? 16
  const lineHeight = options.lineHeight ?? 1.35
  const maxWidth = options.width ?? options.maxWidth ?? Infinity
  const rawLines = text.split('\n')
  let lines = 0
  let width = 0
  for (const line of rawLines) {
    const lineWidth = Math.max(fontSize * 0.5, line.length * fontSize * 0.58)
    const wraps = Math.max(1, Math.ceil(lineWidth / maxWidth))
    lines += wraps
    width = Math.max(width, Math.min(lineWidth, maxWidth))
  }
  return { w: Math.ceil(width), h: Math.ceil(lines * fontSize * lineHeight) }
}

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
}
