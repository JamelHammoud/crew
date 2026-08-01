import { richTextForMeasurement, type RichTextDocument } from './richText'
import type { TextMeasureOptions } from './measurement'

export const MIN_TEXT_WIDTH = 16

export interface TextMeasurer {
  measureHtml(html: string, options: TextMeasureOptions): { w: number; h: number }
}

export interface TextLayoutRequest {
  richText: RichTextDocument
  autoSize: boolean
  width: number
  fontSize: number
  options: Omit<TextMeasureOptions, 'fontSize' | 'maxWidth'>
}

export interface TextLayoutSize {
  width: number
  height: number
}

export interface TextGrowthState {
  x: number
  y: number
  rotation: number
  scale: number
  autoSize: boolean
  textAlign: 'start' | 'middle' | 'end'
  width: number
  style: string
}

export interface TextGrowthResult extends TextGrowthState {
  width: number
}

export function measureTextLayout(measurer: TextMeasurer, request: TextLayoutRequest): TextLayoutSize {
  const fixedWidth = request.autoSize ? null : Math.max(MIN_TEXT_WIDTH, Math.floor(request.width))
  const measured = measurer.measureHtml(richTextForMeasurement(request.richText), {
    ...request.options,
    fontSize: request.fontSize,
    maxWidth: fixedWidth
  })
  return {
    width: fixedWidth ?? Math.max(MIN_TEXT_WIDTH, measured.w + 1),
    height: Math.max(request.fontSize, measured.h)
  }
}

export function textGrowthMatters(
  previous: TextGrowthState,
  next: TextGrowthState,
  contentChanged: boolean
): boolean {
  if (!next.autoSize) return false
  if (contentChanged || previous.style !== next.style) return true
  return previous.scale !== 1 && next.scale === 1
}

export function compensateTextGrowth(
  previous: TextGrowthState,
  next: TextGrowthState,
  previousSize: TextLayoutSize,
  nextSize: TextLayoutSize,
  contentChanged: boolean
): TextGrowthResult {
  if (!next.autoSize) return { ...next }
  const oldWidth = previousSize.width * previous.scale
  const oldHeight = previousSize.height * previous.scale
  const newWidth = nextSize.width * next.scale
  const newHeight = nextSize.height * next.scale
  const horizontal =
    next.textAlign === 'middle' ? (newWidth - oldWidth) / 2 : next.textAlign === 'end' ? newWidth - oldWidth : 0
  const vertical = contentChanged ? 0 : (newHeight - oldHeight) / 2
  const cosine = Math.cos(next.rotation)
  const sine = Math.sin(next.rotation)
  return {
    ...next,
    x: next.x - (horizontal * cosine - vertical * sine),
    y: next.y - (horizontal * sine + vertical * cosine),
    width: nextSize.width
  }
}
