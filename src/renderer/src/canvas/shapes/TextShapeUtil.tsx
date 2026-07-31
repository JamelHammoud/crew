import { createElement, type CSSProperties, type ReactNode } from 'react'
import { Rectangle2d } from '../geometry'
import { textShapeProps, type TLShape as CrewShape } from '../schema'
import { richTextToHtml, type RichTextDocument } from '../text/richText'
import { ShapeUtil, type ShapeEditor } from './ShapeUtil'
import { FONT_FAMILIES, TEXT_FONT_SIZES, plainText, richText } from './shared'
import { shapeColor } from './theme'

export type TextShape = CrewShape<'text'>

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
  getMinDimensions(shape: TextShape): { width: number; height: number } {
    const text = plainText(shape.props.richText)
    const fontSize = TEXT_FONT_SIZES[shape.props.size]
    const width = shape.props.autoSize
      ? Math.max(8, ...text.split('\n').map(line => line.length * fontSize * 0.58))
      : shape.props.w
    return { width, height: Math.max(fontSize * 1.35, text.split('\n').length * fontSize * 1.35) }
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
  component(shape: TextShape): ReactNode {
    const custom = this.options.getCustomDisplayValues(this.editor, shape)
    const size = this.getMinDimensions(shape)
    const editing = this.editor.getEditingShapeId?.() === shape.id
    return createElement('div', {
      className: 'crew-rich-text',
      style: {
        width: size.width,
        minHeight: size.height,
        transform: `scale(${shape.props.scale})`,
        transformOrigin: 'top left',
        color: shapeColor(this.editor, shape.props.color),
        fontFamily: FONT_FAMILIES[shape.props.font],
        fontSize: TEXT_FONT_SIZES[shape.props.size],
        lineHeight: 1.35,
        textAlign: shape.props.textAlign === 'middle' ? 'center' : shape.props.textAlign === 'end' ? 'right' : 'left',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        pointerEvents: 'all',
        visibility: editing ? 'hidden' : undefined,
        ...custom
      },
      dangerouslySetInnerHTML: { __html: richTextToHtml(shape.props.richText as RichTextDocument) }
    })
  }
}
