import { cloneElement, type CSSProperties, type ReactElement } from 'react'
import {
  atom,
  renderHtmlFromRichTextForMeasurement,
  TextShapeUtil,
  type Editor,
  type ShapeUtil,
  type TLTextShape
} from '../canvas'
import { fontStack, loadFonts, whenFontsLoad } from './fonts'
import { textInkStyle } from './nodeCss'
import { textShapeType, typeMeasure } from './textType'
import {
  compensateTextGrowth,
  measureTextLayout,
  richTextChanged,
  textGrowthMatters,
  type TextGrowthState
} from '../canvas/text'

const generation = atom('loaded fonts', 0)
whenFontsLoad(() => generation.set(generation.get() + 1))

const customDisplayValues = (editor: ShapeUtil['editor'], shape: TLTextShape, _geometry?: unknown, _mode?: string) => {
  const type = textShapeType(editor as Editor, shape)
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

function measure(editor: Editor, shape: TLTextShape): { width: number; height: number } {
  const type = textShapeType(editor, shape)
  editor.fonts.trackFontsForShape(shape as unknown as { props?: Record<string, unknown> })
  const fixed = shape.props.autoSize ? null : Math.max(16, Math.floor(shape.props.w))
  const html = renderHtmlFromRichTextForMeasurement(shape.props.richText)
  const size = editor.textMeasure.measureHtml(html, typeMeasure(type, fixed))
  return { width: fixed ?? Math.max(16, size.w + 1), height: Math.max(type.size, size.h) }
}

const measured = new WeakMap<TLTextShape, { at: number; size: { width: number; height: number } }>()

const Configured = TextShapeUtil.configure({
  showTextOutline: false,
  getCustomDisplayValues: customDisplayValues
})

export class DesignTextUtil extends Configured {
  override options = {
    showTextOutline: false,
    getCustomDisplayValues: customDisplayValues
  }

  override getMinDimensions(shape: TLTextShape) {
    const at = generation.get()
    const cached = measured.get(shape)
    if (cached && cached.at === at) return cached.size
    const size = measure(this.editor as Editor, shape)
    measured.set(shape, { at, size })
    return size
  }

  override onBeforeUpdate(previous: TLTextShape, next: TLTextShape): TLTextShape {
    const previousSize = measure(this.editor as Editor, previous)
    const nextSize = measure(this.editor as Editor, next)
    const growth = compensateTextGrowth(
      {
        x: previous.x,
        y: previous.y,
        rotation: previous.rotation,
        scale: previous.props.scale,
        autoSize: previous.props.autoSize,
        textAlign: previous.props.textAlign,
        width: previous.props.w
      },
      {
        x: next.x,
        y: next.y,
        rotation: next.rotation,
        scale: next.props.scale,
        autoSize: next.props.autoSize,
        textAlign: next.props.textAlign,
        width: next.props.w
      },
      previousSize,
      nextSize,
      JSON.stringify(previous.props.richText) !== JSON.stringify(next.props.richText)
    )
    return {
      ...next,
      x: growth.x,
      y: growth.y,
      props: { ...next.props, w: growth.width }
    }
  }

  override component(shape: TLTextShape) {
    const label = super.component(shape) as ReactElement<{ style?: CSSProperties }>
    const style = { ...label.props.style, ...textInkStyle(textShapeType(this.editor as Editor, shape)) }
    return cloneElement(label, { style })
  }
}
