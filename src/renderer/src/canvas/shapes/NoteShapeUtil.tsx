import { createElement, type ReactNode } from 'react'
import { Group2d, Rectangle2d } from '../geometry'
import { Vec } from '../math/Vec'
import { lerp } from '../math/utils'
import { noteShapeProps, type TLShape as CrewShape } from '../schema'
import { richTextToHtml, type RichTextDocument } from '../text/richText'
import { ShapeUtil, type ShapeHandle, type ShapeResizeInfo } from './ShapeUtil'
import { NOTE_LINE_HEIGHT, NOTE_SIZE, measureNoteLabel, type NoteLabelSize } from './noteLabel'
import { FONT_FAMILIES, LABEL_FONT_SIZES, LABEL_PADDING, boxPath, plainText, richText, shapeElement } from './shared'
import { shapeColor } from './theme'

export type NoteShape = CrewShape<'note'>

const HORIZONTAL_ALIGNS = {
  start: 'start',
  middle: 'center',
  end: 'end',
  'start-legacy': 'start',
  'end-legacy': 'end',
  'middle-legacy': 'center'
} as const

const VERTICAL_ALIGNS = { start: 'start', middle: 'middle', end: 'end' } as const

const CLONE_HANDLE_MARGIN = 0
const HANDLES_HIDDEN_BELOW = 0.25
const ONE_HANDLE_BELOW = 0.5

export function noteHeight(shape: NoteShape): number {
  return (NOTE_SIZE + shape.props.growY) * shape.props.scale
}

function isEmptyRichText(value: unknown): boolean {
  return plainText(value).length === 0
}

function resizeScaled(shape: NoteShape, info: ShapeResizeInfo<NoteShape>): NoteShape {
  const { handle, scaleX, scaleY, initialBounds, newPoint } = info
  const delta =
    handle === 'left' || handle === 'right'
      ? Math.max(0.01, Math.abs(scaleX))
      : handle === 'top' || handle === 'bottom'
        ? Math.max(0.01, Math.abs(scaleY))
        : Math.max(0.01, Math.max(Math.abs(scaleX), Math.abs(scaleY)))

  const offset = new Vec(
    scaleX < 0 ? -(initialBounds.width * delta) : 0,
    scaleY < 0 ? -(initialBounds.height * delta) : 0
  )
  const { x, y } = offset.rot(shape.rotation).add(newPoint)
  return { ...shape, x, y, props: { ...shape.props, scale: delta * shape.props.scale } }
}

export class NoteShapeUtil extends ShapeUtil<NoteShape> {
  static override type = 'note' as const
  static override props = noteShapeProps

  override options = { resizeMode: 'none' as 'none' | 'scale', getCustomDisplayValues: () => ({}) }

  private readonly measured = new WeakMap<NoteShape, NoteLabelSize>()

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
  override hideResizeHandles(): boolean {
    return this.options.resizeMode === 'none'
  }
  override isAspectRatioLocked(): boolean {
    return this.options.resizeMode === 'scale'
  }
  override hideSelectionBoundsFg(): boolean {
    return false
  }
  override getText(shape: NoteShape): string {
    return plainText(shape.props.richText)
  }
  override getReferencedUserIds(shape: NoteShape): string[] {
    return shape.props.textLastEditedBy ? [shape.props.textLastEditedBy] : []
  }

  getGeometry(shape: NoteShape): Group2d {
    const { scale, align, verticalAlign } = shape.props
    const { labelWidth, labelHeight } = this.labelSize(shape)
    const width = NOTE_SIZE * scale
    const height = noteHeight(shape)
    const labelW = labelWidth * scale
    const labelH = labelHeight * scale
    const horizontal = HORIZONTAL_ALIGNS[align]
    const vertical = VERTICAL_ALIGNS[verticalAlign]

    return new Group2d({
      children: [
        new Rectangle2d({ width, height, isFilled: true }),
        new Rectangle2d({
          x: horizontal === 'start' ? 0 : horizontal === 'end' ? width - labelW : (width - labelW) / 2,
          y: vertical === 'start' ? 0 : vertical === 'end' ? height - labelH : (height - labelH) / 2,
          width: labelW,
          height: labelH,
          isFilled: true,
          isLabel: true,
          excludeFromShapeBounds: true
        })
      ]
    })
  }

  override getHandles(shape: NoteShape): ShapeHandle[] {
    const { scale } = shape.props
    if (this.editor.getInstanceState?.().isCoarsePointer) return []

    const zoom = this.editor.getZoomLevel?.() ?? 1
    if (zoom * scale < HANDLES_HIDDEN_BELOW) return []

    const width = NOTE_SIZE * scale
    const height = noteHeight(shape)
    const offset = (CLONE_HANDLE_MARGIN / zoom) * scale
    const bottom: ShapeHandle = { id: 'bottom', index: 'a3', type: 'clone', x: width / 2, y: height + offset }
    if (zoom * scale < ONE_HANDLE_BELOW) return [bottom]

    return [
      { id: 'top', index: 'a1', type: 'clone', x: width / 2, y: -offset },
      { id: 'right', index: 'a2', type: 'clone', x: width + offset, y: height / 2 },
      bottom,
      { id: 'left', index: 'a4', type: 'clone', x: -offset, y: height / 2 }
    ]
  }

  override onResize(shape: NoteShape, info: ShapeResizeInfo<NoteShape>): NoteShape {
    return this.options.resizeMode === 'none' ? shape : resizeScaled(shape, info)
  }

  override onBeforeCreate(next: NoteShape): NoteShape | undefined {
    return this.sizeAdjustments(next)
  }

  override onBeforeUpdate(previous: NoteShape, next: NoteShape): NoteShape | undefined {
    const textChanged = previous.props.richText !== next.props.richText
    if (!textChanged && previous.props.font === next.props.font && previous.props.size === next.props.size) return
    return this.sizeAdjustments(next) ?? (textChanged ? next : undefined)
  }

  getInterpolatedProps(start: NoteShape, end: NoteShape, t: number): NoteShape['props'] {
    return { ...(t > 0.5 ? end.props : start.props), scale: lerp(start.props.scale, end.props.scale, t) }
  }

  private sizeAdjustments(shape: NoteShape): NoteShape | undefined {
    const { labelHeight, fontSizeAdjustment } = this.labelSize(shape)
    const growY = Math.max(0, labelHeight - NOTE_SIZE)
    if (growY === shape.props.growY && fontSizeAdjustment === shape.props.fontSizeAdjustment) return undefined
    return { ...shape, props: { ...shape.props, growY, fontSizeAdjustment } }
  }

  private labelSize(shape: NoteShape): NoteLabelSize {
    const cached = this.measured.get(shape)
    if (cached) return cached
    const size = measureNoteLabel(this.editor, {
      html: richTextToHtml(shape.props.richText as RichTextDocument),
      isEmpty: isEmptyRichText(shape.props.richText),
      fontFamily: FONT_FAMILIES[shape.props.font],
      fontSize: LABEL_FONT_SIZES[shape.props.size]
    })
    this.measured.set(shape, size)
    return size
  }

  component(shape: NoteShape): ReactNode {
    const { props } = shape
    const width = NOTE_SIZE * props.scale
    const height = noteHeight(shape)
    const background = shapeColor(this.editor, props.color, 'noteFill')
    const labelColor =
      props.labelColor === 'black'
        ? shapeColor(this.editor, props.color, 'noteText')
        : shapeColor(this.editor, props.labelColor, 'fill')
    const horizontal = HORIZONTAL_ALIGNS[props.align]
    const vertical = VERTICAL_ALIGNS[props.verticalAlign]
    const editing = this.editor.getEditingShapeId?.() === shape.id

    return createElement(
      'div',
      { style: { position: 'relative', width, height } },
      shapeElement(boxPath(width, height), { editor: this.editor, color: props.color, fill: background, width: 2 }),
      createElement('div', {
        className: 'crew-rich-text',
        style: {
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: horizontal === 'start' ? 'flex-start' : horizontal === 'end' ? 'flex-end' : 'center',
          justifyContent: vertical === 'start' ? 'flex-start' : vertical === 'end' ? 'flex-end' : 'center',
          padding: LABEL_PADDING * props.scale,
          color: labelColor,
          fontFamily: FONT_FAMILIES[props.font],
          fontSize: LABEL_FONT_SIZES[props.size] * (props.fontSizeAdjustment ?? 1) * props.scale,
          lineHeight: NOTE_LINE_HEIGHT,
          textAlign: horizontal,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          overflow: 'hidden',
          pointerEvents: 'all',
          visibility: editing ? 'hidden' : undefined
        },
        dangerouslySetInnerHTML: { __html: richTextToHtml(props.richText as RichTextDocument) }
      })
    )
  }
}
