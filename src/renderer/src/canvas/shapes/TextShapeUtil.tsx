import { createElement, type CSSProperties, type ReactNode } from 'react'
import { Rectangle2d } from '../geometry'
import { textShapeProps, type TLShape } from '../schema'
import { ShapeUtil } from './ShapeUtil'
import { COLORS, FONT_FAMILIES, FONT_SIZES, plainText, richText } from './shared'

export type TLTextShape = TLShape<'text'>

export class TextShapeUtil extends ShapeUtil<TLTextShape> {
  static override type = 'text' as const
  static override props = textShapeProps

  override options = { showTextOutline: true, getCustomDisplayValues: () => ({}) }

  getDefaultProps(): TLTextShape['props'] { return { color: 'black', size: 'm', w: 8, font: 'draw', textAlign: 'start', autoSize: true, scale: 1, richText: richText() } }
  override canEdit(): boolean { return true }
  getMinDimensions(shape: TLTextShape): { width: number; height: number } {
    const text = plainText(shape.props.richText)
    const fontSize = FONT_SIZES[shape.props.size]
    const width = shape.props.autoSize ? Math.max(8, ...text.split('\n').map(line => line.length * fontSize * 0.58)) : shape.props.w
    return { width, height: Math.max(fontSize * 1.35, text.split('\n').length * fontSize * 1.35) }
  }
  getGeometry(shape: TLTextShape) {
    const size = this.getMinDimensions(shape)
    return new Rectangle2d({ width: size.width * shape.props.scale, height: size.height * shape.props.scale, isFilled: true, isLabel: true })
  }
  override getText(shape: TLTextShape): string { return plainText(shape.props.richText) }
  component(shape: TLTextShape): ReactNode {
    const custom = (this.options.getCustomDisplayValues as (editor: unknown, shape: TLTextShape) => Partial<CSSProperties>)(this.editor, shape)
    const size = this.getMinDimensions(shape)
    return createElement('div', { style: { width: size.width, minHeight: size.height, transform: `scale(${shape.props.scale})`, transformOrigin: 'top left', color: COLORS[shape.props.color], fontFamily: FONT_FAMILIES[shape.props.font], fontSize: FONT_SIZES[shape.props.size], lineHeight: 1.35, textAlign: shape.props.textAlign === 'middle' ? 'center' : shape.props.textAlign === 'end' ? 'right' : 'left', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', pointerEvents: 'all', ...custom } }, plainText(shape.props.richText))
  }
}
