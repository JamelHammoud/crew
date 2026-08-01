import { TextMeasurement, type TextMeasureOptions } from '../text/measurement'
import type { TLTextMeasure, TLTextMeasureOptions } from './types'

export class TextMeasure implements TLTextMeasure {
  private measurement: TextMeasurement | null = null

  constructor(private readonly getContainer?: () => HTMLElement) {}

  measureHtml(html: string, options: TLTextMeasureOptions = {}): { w: number; h: number } {
    const measurement = this.measurer()
    if (!measurement) return estimate(stripHtml(html), options)
    const { w, h } = measurement.measureHtml(html, resolve(options))
    return { w: Math.ceil(w), h: Math.ceil(h) }
  }

  measureText(text: string, options: TLTextMeasureOptions = {}): { w: number; h: number } {
    const measurement = this.measurer()
    if (!measurement) return estimate(text, options)
    const { w, h } = measurement.measureText(text, resolve(options))
    return { w: Math.ceil(w), h: Math.ceil(h) }
  }

  dispose(): void {
    this.measurement?.dispose()
    this.measurement = null
  }

  private measurer(): TextMeasurement | null {
    if (this.measurement) return this.measurement
    if (typeof document === 'undefined') return null
    const container = this.getContainer?.() ?? document.body
    if (!container?.appendChild) return null
    this.measurement = new TextMeasurement(document, container)
    return this.measurement
  }
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

function resolve(options: TLTextMeasureOptions): TextMeasureOptions {
  const width = options.width ?? null
  return {
    fontStyle: options.fontStyle ?? 'normal',
    fontWeight: String(options.fontWeight ?? 'normal'),
    fontFamily: options.fontFamily ?? 'inherit',
    fontSize: options.fontSize ?? 16,
    lineHeight: options.lineHeight ?? 1.35,
    maxWidth: width ?? options.maxWidth ?? null,
    minWidth: width,
    padding: options.padding ?? '0px',
    otherStyles: options.letterSpacing ? { 'letter-spacing': `${options.letterSpacing}px` } : undefined
  }
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
