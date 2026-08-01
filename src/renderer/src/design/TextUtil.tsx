import { cloneElement, type CSSProperties, type ReactElement } from 'react'
import { atom, TextShapeUtil, type Editor, type ShapeUtil, type TLTextShape } from '../canvas'
import { fontStack, loadFonts, whenFontsLoad } from './fonts'
import { textInkStyle } from './nodeCss'
import { textShapeType, typeMeasure } from './textType'
import { trimOf, type TrimmedType } from './verticalTrim'
import {
  compensateTextGrowth,
  measureTextLayout,
  richTextChanged,
  textGrowthMatters,
  type TextGrowthState
} from '../canvas/text'
import { forgetFaceMetrics, trimEdges, trimHeight, trimStyle, type TrimEdges } from '../canvas/text/trim'

const generation = atom('loaded fonts', 0)
whenFontsLoad(() => {
  forgetFaceMetrics()
  generation.set(generation.get() + 1)
})

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

function textTrim(type: TrimmedType): TrimEdges {
  return trimEdges(typeMeasure(type, null), trimOf(type))
}

function measure(editor: Editor, shape: TLTextShape): { width: number; height: number } {
  const type = textShapeType(editor, shape)
  editor.fonts.trackFontsForShape({ props: { font: shape.props.font } })
  editor.fonts.trackFontsForShape({ props: { font: type.family } })
  const { maxWidth: _width, fontSize: _size, ...options } = typeMeasure(type, null)
  const size = measureTextLayout(editor.textMeasure, {
    richText: shape.props.richText,
    autoSize: shape.props.autoSize,
    width: shape.props.w,
    fontSize: type.size,
    options
  })
  return { width: size.width, height: trimHeight(size.height, textTrim(type)) }
}

function growthState(editor: Editor, shape: TLTextShape): TextGrowthState {
  const type = textShapeType(editor, shape)
  return {
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    scale: shape.props.scale,
    autoSize: shape.props.autoSize,
    textAlign: shape.props.textAlign,
    width: shape.props.w,
    style: JSON.stringify(type)
  }
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

  override onBeforeUpdate(previous: TLTextShape, next: TLTextShape): TLTextShape | undefined {
    const editor = this.editor as Editor
    const before = growthState(editor, previous)
    const after = growthState(editor, next)
    const contentChanged = richTextChanged(previous.props.richText, next.props.richText)
    if (!textGrowthMatters(before, after, contentChanged)) return undefined
    const growth = compensateTextGrowth(
      before,
      after,
      measure(editor, previous),
      measure(editor, next),
      contentChanged
    )
    return { ...next, x: growth.x, y: growth.y, props: { ...next.props, w: growth.width } }
  }

  override component(shape: TLTextShape) {
    const label = super.component(shape) as ReactElement<{ style?: CSSProperties }>
    const type = textShapeType(this.editor as Editor, shape)
    const style = {
      ...label.props.style,
      ...textInkStyle(type),
      ...trimStyle(textTrim(type), shape.props.scale)
    }
    return cloneElement(label, { style })
  }
}
