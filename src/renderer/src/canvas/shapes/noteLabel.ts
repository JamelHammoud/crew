import type { ShapeEditor } from './ShapeUtil'
import { LABEL_PADDING } from './shared'

export const NOTE_SIZE = 200
export const NOTE_LINE_HEIGHT = 1.35
export const NOTE_MIN_FONT_SIZE = 14
export const NOTE_MEASURE_FUZZ = 1
const SHRINK_LIMIT = 50

export interface NoteLabelSize {
  labelWidth: number
  labelHeight: number
  fontSizeAdjustment: number
}

export interface NoteLabelRequest {
  html: string
  isEmpty: boolean
  fontFamily: string
  fontSize: number
}

export function lineHeightPx(fontSize: number, lineHeight: number): number {
  return Math.round(fontSize * lineHeight)
}

function measure(
  editor: ShapeEditor,
  request: NoteLabelRequest,
  fontSize: number,
  breakWords: boolean
): { w: number; h: number; scrollWidth?: number } {
  const measured = editor.textMeasure?.measureHtml(request.html, {
    fontFamily: request.fontFamily,
    fontSize,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: 'normal',
    fontVariant: 'normal',
    fontStyle: 'normal',
    padding: '0px',
    maxWidth: NOTE_SIZE - LABEL_PADDING * 2 - NOTE_MEASURE_FUZZ,
    disableOverflowWrapBreaking: !breakWords,
    measureScrollWidth: !breakWords
  })
  return measured ?? { w: NOTE_SIZE - LABEL_PADDING * 2, h: lineHeightPx(fontSize, NOTE_LINE_HEIGHT) }
}

export function measureNoteLabel(editor: ShapeEditor, request: NoteLabelRequest): NoteLabelSize {
  if (request.isEmpty) {
    return {
      labelHeight: lineHeightPx(request.fontSize, NOTE_LINE_HEIGHT) + LABEL_PADDING * 2,
      labelWidth: 100,
      fontSizeAdjustment: 1
    }
  }

  const unadjusted = request.fontSize
  let fontSize = unadjusted
  let labelWidth = NOTE_SIZE
  let labelHeight = NOTE_SIZE
  let step = 0

  do {
    fontSize = Math.min(unadjusted, unadjusted - step)
    const size = measure(editor, request, fontSize, false)
    labelHeight = size.h + LABEL_PADDING * 2
    labelWidth = size.w + LABEL_PADDING * 2

    if (fontSize <= NOTE_MIN_FONT_SIZE) {
      const broken = measure(editor, request, fontSize, true)
      labelHeight = broken.h + LABEL_PADDING * 2
      labelWidth = broken.w + LABEL_PADDING * 2
      break
    }

    if (size.scrollWidth === undefined) break
    if (size.scrollWidth.toFixed(0) === size.w.toFixed(0)) break
  } while (step++ < SHRINK_LIMIT)

  return {
    labelWidth,
    labelHeight,
    fontSizeAdjustment: fontSize === unadjusted ? 1 : fontSize / unadjusted
  }
}
