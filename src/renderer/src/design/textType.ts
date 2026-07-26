import type { Editor, TLTextShape } from 'tldraw'
import { BASE_TYPE, cleanType, type Paint, type TypeStyle } from '../../../shared/designNode'
import { alignOf, familyOf, labelAlign, paletteHex, sizeFont } from './palette'

export function autoLineHeight(editor: Editor): number {
  return editor.getCurrentTheme().lineHeight ?? BASE_TYPE.lineHeight
}

export function textShapeType(editor: Editor, shape: TLTextShape): TypeStyle {
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
  const stored = shape.meta.type
  if (!stored || typeof stored !== 'object') return base
  return cleanType({ ...base, ...(stored as object), align: base.align }) ?? base
}

export function setTextShapeType(editor: Editor, shape: TLTextShape, patch: Partial<TypeStyle>): void {
  const { align, ...type } = { ...textShapeType(editor, shape), ...patch }
  editor.markHistoryStoppingPoint()
  editor.updateShape<TLTextShape>({
    id: shape.id,
    type: 'text',
    props: { textAlign: labelAlign(align) as TLTextShape['props']['textAlign'] },
    meta: { ...shape.meta, type }
  })
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
