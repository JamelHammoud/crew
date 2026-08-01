import type { Editor, TLTextShape } from '../canvas'
import { BASE_TYPE, cleanType, type Paint, type TypeStyle } from '../../../shared/designNode'
import { fontStack } from './fonts'
import { textInkStyle } from './nodeCss'
import { alignOf, familyOf, labelAlign, paletteHex, sizeFont } from './palette'
import { trimOf, withTrim, type TrimmedType } from './verticalTrim'

export function autoLineHeight(editor: Editor): number {
  return editor.getCurrentTheme().lineHeight ?? BASE_TYPE.lineHeight
}

export function textShapeType(editor: Editor, shape: TLTextShape): TrimmedType {
  const { font, size, textAlign, color } = shape.props
  const drawn = familyOf(font)
  const base: TypeStyle = {
    ...BASE_TYPE,
    family: drawn === 'draw' ? 'sans' : drawn,
    size: sizeFont(size),
    lineHeight: autoLineHeight(editor),
    align: alignOf(textAlign),
    color: paletteHex(editor, color)
  }
  const stored = shape.meta?.type
  if (!stored || typeof stored !== 'object') return base
  const clean = cleanType({ ...base, ...(stored as object), align: base.align }) ?? base
  return withTrim(clean, trimOf(stored as Partial<TrimmedType>))
}

export function setTextShapeType(editor: Editor, shape: TLTextShape, patch: Partial<TrimmedType>): void {
  const live = (editor.getShape(shape.id) as TLTextShape | undefined) ?? shape
  const { align, trim, ...rest } = { ...textShapeType(editor, live), ...patch }
  editor.markHistoryStoppingPoint()
  editor.updateShape<TLTextShape>({
    id: live.id,
    type: 'text',
    props: { textAlign: labelAlign(align) as TLTextShape['props']['textAlign'] },
    meta: { ...live.meta, type: withTrim(rest, trimOf({ trim })) }
  })
}

export function typeMeasure(type: TypeStyle, maxWidth: number | null) {
  const ink = textInkStyle(type)
  return {
    fontFamily: fontStack(type.family),
    fontSize: type.size,
    fontStyle: type.italic ? 'italic' : 'normal',
    fontWeight: String(type.weight),
    lineHeight: type.lineHeight,
    maxWidth,
    padding: '0px',
    otherStyles: { 'letter-spacing': `${ink.letterSpacing}`, 'text-transform': `${ink.textTransform}` }
  }
}

export function typePaint(type: TypeStyle): Paint {
  const alpha = type.color.length === 9 ? parseInt(type.color.slice(7, 9), 16) / 255 : 1
  return { type: 'solid', color: type.color.slice(0, 7), opacity: alpha, visible: true }
}

export function paintColor(paint: Paint): string | null {
  if (paint.type !== 'solid') return null
  const alpha = Math.round(Math.min(1, Math.max(0, paint.opacity)) * 255)
  const hex = paint.color.slice(0, 7)
  return alpha >= 255 ? hex : hex + alpha.toString(16).padStart(2, '0')
}
