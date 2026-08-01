import { createElement, type CSSProperties, type ReactNode } from 'react'
import { Rectangle2d } from '../geometry'
import { Vec } from '../math/Vec'
import { textShapeProps, type TLShape as CrewShape } from '../schema'
import {
  compensateTextGrowth,
  measureTextLayout,
  richTextChanged,
  textGrowthMatters,
  type TextGrowthState,
  type TextLayoutSize,
  type TextMeasurer
} from '../text/autosize'
import { richTextToHtml, type RichTextDocument } from '../text/richText'
import { TEXT_LINE_HEIGHT, withResolvedLineHeight } from '../text/typeStyle'
import { ShapeUtil, type ShapeEditor, type ShapeResizeInfo } from './ShapeUtil'
import { FONT_FAMILIES, TEXT_FONT_SIZES, plainText, richText } from './shared'
import { shapeColor } from './theme'

export type TextShape = CrewShape<'text'>

const ESTIMATE: TextMeasurer = {
  measureHtml: (html, options) => {
    const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    const lines = text.split('\n')
    const width = Math.max(0, ...lines.map(line => line.length * options.fontSize * 0.58))
    return { w: width, h: lines.length * options.fontSize * options.lineHeight }
  }
}

function scaleDelta(info: ShapeResizeInfo<TextShape>): number {
  if (info.handle === 'left' || info.handle === 'right') return Math.max(0.01, Math.abs(info.scaleX))
  if (info.handle === 'top' || info.handle === 'bottom') return Math.max(0.01, Math.abs(info.scaleY))
  return Math.max(0.01, Math.max(Math.abs(info.scaleX), Math.abs(info.scaleY)))
}

function resizeScaled(shape: TextShape, info: ShapeResizeInfo<TextShape>): TextShape {
  const delta = scaleDelta(info)
  const offset = new Vec(
    info.scaleX < 0 ? -(info.initialBounds.width * delta) : 0,
    info.scaleY < 0 ? -(info.initialBounds.height * delta) : 0
  )
  const point = Vec.Add(info.newPoint, offset.rot(shape.rotation))
  return { ...shape, x: point.x, y: point.y, props: { ...shape.props, scale: delta * shape.props.scale } }
}

export interface TextShapeUtilOptions {
  [key: string]: unknown
  showTextOutline: boolean
  getCustomDisplayValues(
    editor: ShapeEditor,
    shape: TextShape,
    geometry?: unknown,
    mode?: string
  ): Partial<CSSProperties>
}

export class TextShapeUtil extends ShapeUtil<TextShape> {
  static override type = 'text' as const
  static override props = textShapeProps

  override options: TextShapeUtilOptions = {
    showTextOutline: true,
    getCustomDisplayValues: () => ({})
  }

  getDefaultProps(): TextShape['props'] {
    return {
      color: 'black',
      size: 'm',
      w: 8,
      font: 'draw',
      textAlign: 'start',
      autoSize: true,
      scale: 1,
      richText: richText()
    }
  }
  override canEdit(): boolean {
    return true
  }
  measurer(): TextMeasurer {
    return (this.editor.textMeasure as TextMeasurer | undefined) ?? ESTIMATE
  }
  getMinDimensions(shape: TextShape): TextLayoutSize {
    return measureTextLayout(this.measurer(), {
      richText: shape.props.richText as RichTextDocument,
      autoSize: shape.props.autoSize,
      width: shape.props.w,
      fontSize: TEXT_FONT_SIZES[shape.props.size],
      options: {
        fontFamily: FONT_FAMILIES[shape.props.font],
        fontStyle: 'normal',
        fontWeight: 'normal',
        lineHeight: TEXT_LINE_HEIGHT,
        padding: '0px'
      }
    })
  }
  growthState(shape: TextShape): TextGrowthState {
    return {
      x: shape.x,
      y: shape.y,
      rotation: shape.rotation,
      scale: shape.props.scale,
      autoSize: shape.props.autoSize,
      textAlign: shape.props.textAlign,
      width: shape.props.w,
      style: `${shape.props.size}|${shape.props.font}|${shape.props.textAlign}`
    }
  }
  override onBeforeUpdate(previous: TextShape, next: TextShape): TextShape | undefined {
    const before = this.growthState(previous)
    const after = this.growthState(next)
    const contentChanged = richTextChanged(
      previous.props.richText as RichTextDocument,
      next.props.richText as RichTextDocument
    )
    if (!textGrowthMatters(before, after, contentChanged)) return undefined
    const grown = compensateTextGrowth(
      before,
      after,
      this.getMinDimensions(previous),
      this.getMinDimensions(next),
      contentChanged
    )
    return { ...next, x: grown.x, y: grown.y, props: { ...next.props, w: grown.width } }
  }
  getGeometry(shape: TextShape) {
    const size = this.getMinDimensions(shape)
    return new Rectangle2d({
      width: size.width * shape.props.scale,
      height: size.height * shape.props.scale,
      isFilled: true,
      isLabel: true
    })
  }
  override getText(shape: TextShape): string {
    return plainText(shape.props.richText)
  }
  override onResize(shape: TextShape, info: ShapeResizeInfo<TextShape>): TextShape {
    if (info.mode === 'scale_shape' || (info.handle !== 'right' && info.handle !== 'left')) {
      return resizeScaled(shape, info)
    }
    const width = Math.max(1, Math.abs(info.initialBounds.width * info.scaleX))
    const point =
      info.scaleX < 0 ? Vec.Sub(info.newPoint, Vec.FromAngle(shape.rotation).mul(width)) : info.newPoint
    return {
      ...shape,
      x: point.x,
      y: point.y,
      props: { ...shape.props, w: width / info.initialShape.props.scale, autoSize: false }
    }
  }
  component(shape: TextShape): ReactNode {
    const custom = this.options.getCustomDisplayValues(this.editor, shape)
    const size = this.getMinDimensions(shape)
    const editing = this.editor.getEditingShapeId?.() === shape.id
    return createElement('div', {
      className: 'crew-rich-text',
      style: withResolvedLineHeight({
        width: size.width,
        minHeight: size.height,
        transform: `scale(${shape.props.scale})`,
        transformOrigin: 'top left',
        color: shapeColor(this.editor, shape.props.color),
        fontFamily: FONT_FAMILIES[shape.props.font],
        fontSize: TEXT_FONT_SIZES[shape.props.size],
        lineHeight: TEXT_LINE_HEIGHT,
        textAlign: shape.props.textAlign === 'middle' ? 'center' : shape.props.textAlign === 'end' ? 'right' : 'left',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        pointerEvents: 'all',
        visibility: editing ? 'hidden' : undefined,
        ...custom
      }),
      dangerouslySetInnerHTML: { __html: richTextToHtml(shape.props.richText as RichTextDocument) }
    })
  }
}
