import { createElement, type ReactNode } from 'react'
import { Group2d, Rectangle2d } from '../geometry'
import { noteShapeProps, type TLShape as CrewShape } from '../schema'
import { richTextToHtml, type RichTextDocument } from '../text/richText'
import { ShapeUtil } from './ShapeUtil'
import { FONT_FAMILIES, LABEL_FONT_SIZES, boxPath, plainText, richText, shapeElement } from './shared'
import { shapeColor } from './theme'

export type NoteShape = CrewShape<'note'>

export class NoteShapeUtil extends ShapeUtil<NoteShape> {
  static override type = 'note' as const
  static override props = noteShapeProps

  getDefaultProps(): NoteShape['props'] {
    return {
      color: 'black',
      richText: richText(),
      size: 'm',
      font: 'draw',
      align: 'middle',
      verticalAlign: 'middle',
      labelColor: 'black',
      growY: 0,
      fontSizeAdjustment: 1,
      url: '',
      scale: 1,
      textLastEditedBy: null
    }
  }

  override canEdit(): boolean {
    return true
  }
  override isAspectRatioLocked(): boolean {
    return true
  }
  override getText(shape: NoteShape): string {
    return plainText(shape.props.richText)
  }

  getGeometry(shape: NoteShape) {
    const width = 200 * shape.props.scale
    const height = (200 + shape.props.growY) * shape.props.scale
    return new Group2d({
      children: [
        new Rectangle2d({ width, height, isFilled: true }),
        new Rectangle2d({
          x: 8,
          y: 8,
          width: Math.max(1, width - 16),
          height: Math.max(1, height - 16),
          isFilled: true,
          isLabel: true,
          excludeFromShapeBounds: true
        })
      ]
    })
  }

  component(shape: NoteShape): ReactNode {
    const { props } = shape
    const width = 200 * props.scale
    const height = (200 + props.growY) * props.scale
    const background = shapeColor(this.editor, props.color, 'noteFill')
    const labelColor =
      props.labelColor === 'black'
        ? shapeColor(this.editor, props.color, 'noteText')
        : shapeColor(this.editor, props.labelColor, 'fill')
    const editing = this.editor.getEditingShapeId?.() === shape.id
    return createElement(
      'div',
      { style: { position: 'relative', width, height } },
      shapeElement(boxPath(width, height), { editor: this.editor, color: props.color, fill: background, width: 2 }),
      createElement('div', {
        className: 'crew-rich-text',
        style: {
          position: 'absolute',
          inset: 12 * props.scale,
          display: 'flex',
          flexDirection: 'column',
          alignItems: props.align.startsWith('start')
            ? 'flex-start'
            : props.align.startsWith('end')
              ? 'flex-end'
              : 'center',
          justifyContent:
            props.verticalAlign === 'start' ? 'flex-start' : props.verticalAlign === 'end' ? 'flex-end' : 'center',
          color: labelColor,
          fontFamily: FONT_FAMILIES[props.font],
          fontSize: LABEL_FONT_SIZES[props.size] * (props.fontSizeAdjustment ?? 1) * props.scale,
          lineHeight: 1.35,
          textAlign: props.align.startsWith('end') ? 'right' : props.align.startsWith('middle') ? 'center' : 'left',
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          pointerEvents: 'all',
          visibility: editing ? 'hidden' : undefined
        },
        dangerouslySetInnerHTML: { __html: richTextToHtml(props.richText as RichTextDocument) }
      })
    )
  }
}
