import { cloneElement, type CSSProperties, type ReactElement } from 'react'
import {
  atom,
  renderHtmlFromRichTextForMeasurement,
  TextShapeUtil,
  type Editor,
  type TLTextShape
} from 'tldraw'
import { fontStack, loadFonts, whenFontsLoad } from './fonts'
import { textInkStyle } from './nodeCss'
import { textShapeType } from './textType'

const generation = atom('loaded fonts', 0)
whenFontsLoad(() => generation.set(generation.get() + 1))

function measure(editor: Editor, shape: TLTextShape): { width: number; height: number } {
  const type = textShapeType(editor, shape)
  const ink = textInkStyle(type)
  editor.fonts.trackFontsForShape(shape)
  const fixed = shape.props.autoSize ? null : Math.max(16, Math.floor(shape.props.w))
  const size = editor.textMeasure.measureHtml(renderHtmlFromRichTextForMeasurement(editor, shape.props.richText), {
    fontFamily: fontStack(type.family),
    fontSize: type.size,
    fontStyle: type.italic ? 'italic' : 'normal',
    fontWeight: String(type.weight),
    lineHeight: type.lineHeight,
    maxWidth: fixed,
    padding: '0px',
    otherStyles: { 'letter-spacing': `${ink.letterSpacing}`, 'text-transform': `${ink.textTransform}` }
  })
  return { width: fixed ?? Math.max(16, size.w + 1), height: Math.max(type.size, size.h) }
}

const measured = new WeakMap<TLTextShape, { at: number; size: { width: number; height: number } }>()

const Configured = TextShapeUtil.configure({
  showTextOutline: false,
  getCustomDisplayValues: (editor: Editor, shape: TLTextShape) => {
    const type = textShapeType(editor, shape)
    loadFonts([type.family])
    return {
      color: type.color,
      fontFamily: fontStack(type.family),
      fontSize: type.size,
      lineHeight: type.lineHeight,
      fontWeight: String(type.weight),
      fontStyle: type.italic ? 'italic' : 'normal'
    }
  }
})

export class DesignTextUtil extends Configured {
  override getMinDimensions(shape: TLTextShape) {
    const at = generation.get()
    const cached = measured.get(shape)
    if (cached && cached.at === at) return cached.size
    const size = measure(this.editor, shape)
    measured.set(shape, { at, size })
    return size
  }

  override component(shape: TLTextShape) {
    const label = super.component(shape) as ReactElement<{ style?: CSSProperties }>
    const style = { ...label.props.style, ...inkStyle(textShapeType(this.editor, shape)) }
    return cloneElement(label, { style })
  }
}
