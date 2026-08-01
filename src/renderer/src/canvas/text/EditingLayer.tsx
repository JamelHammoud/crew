import type { Editor as TipTapEditor } from '@tiptap/core'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Editor } from '../editor'
import { shapeCssTransform } from '../render'
import type { TLShape } from '../schema'
import { ARROW_FONT_SIZES, FONT_FAMILIES, LABEL_FONT_SIZES, TEXT_FONT_SIZES } from '../shapes/shared'
import { canvasSurface, shapeColor } from '../shapes/theme'
import { useValue } from '../signals'
import { RichTextEditor } from './editor'
import type { RichTextDocument } from './richText'
import { RichTextToolbar } from './toolbar'
import { paintedTypeStyle, TEXT_LINE_HEIGHT, withResolvedLineHeight } from './typeStyle'

type EditableTextShape = TLShape<'text' | 'geo' | 'note' | 'arrow'>

function isEditableTextShape(shape: TLShape): shape is EditableTextShape {
  return shape.type === 'text' || shape.type === 'geo' || shape.type === 'note' || shape.type === 'arrow'
}

function editingBounds(editor: Editor, id: TLShape['id']): { w: number; h: number } {
  const shape = editor.getShape(id)
  return shape ? editor.getShapeGeometry(shape).bounds : { w: 1, h: 1 }
}

function boundsStroke(editor: Editor): string {
  const value = editor.getCurrentTheme().colors[editor.getColorMode()].selectionStroke
  return typeof value === 'string' ? value : 'hsl(214, 84%, 56%)'
}

export function EditingLayer({ editor }: { editor: Editor }) {
  const shape = useValue('canvas editing shape', () => editor.getEditingShape(), [editor])
  if (!shape || !isEditableTextShape(shape)) return null
  return <EditingRichText key={shape.id} editor={editor} shape={shape} />
}

function EditingRichText({ editor, shape }: { editor: Editor; shape: EditableTextShape }) {
  const [textEditor, setTextEditor] = useState<TipTapEditor | null>(null)
  const mark = useRef<string | null>(null)
  const transform = useValue(
    'canvas editing transform',
    () => {
      const matrix = editor.getShapePageTransform(shape.id)
      return matrix ? shapeCssTransform(matrix) : ''
    },
    [editor, shape.id]
  )
  const width = useValue('canvas editing width', () => Math.max(1, editingBounds(editor, shape.id).w), [
    editor,
    shape.id
  ])
  const height = useValue('canvas editing height', () => Math.max(1, editingBounds(editor, shape.id).h), [
    editor,
    shape.id
  ])
  const richText = shape.props.richText as RichTextDocument
  const stroke = useValue('canvas editing stroke', () => boundsStroke(editor), [editor])

  useEffect(() => {
    mark.current = editor.markHistoryStoppingPoint('edit text')
    return () => {
      editor.setRichTextEditor(null)
      if (mark.current) editor.squashToMark(mark.current)
    }
  }, [editor])

  const ready = (next: TipTapEditor | null) => {
    setTextEditor(next)
    editor.setRichTextEditor(next as never)
  }
  const change = (next: RichTextDocument) => {
    editor.updateShape({ id: shape.id, type: shape.type, props: { richText: next } })
  }
  const complete = () => {
    editor.setEditingShape(null)
    editor.setCurrentTool('select.idle')
    editor.getContainer().focus({ preventScroll: true })
  }

  return (
    <div
      data-canvas-text-editor={shape.id}
      style={{
        position: 'absolute',
        width,
        height,
        transform,
        transformOrigin: 'top left',
        pointerEvents: 'all',
        zIndex: 1_000_000,
        outline: `calc(1.5px * var(--crew-scale, 1)) solid var(--design-selected, ${stroke})`,
        outlineOffset: 'calc(-0.75px * var(--crew-scale, 1))'
      }}
    >
      <ShapeTextEditor
        editor={editor}
        shape={shape}
        richText={richText}
        onChange={change}
        onReady={ready}
        onComplete={complete}
      />
      <RichTextToolbar editor={textEditor} />
    </div>
  )
}

function ShapeTextEditor({
  editor,
  shape,
  richText,
  onChange,
  onReady,
  onComplete
}: {
  editor: Editor
  shape: EditableTextShape
  richText: RichTextDocument
  onChange(value: RichTextDocument): void
  onReady(value: TipTapEditor | null): void
  onComplete(): void
}) {
  const common = { richText, editing: true, onChange, onReady, onComplete, selectAll: false }
  if (shape.type === 'text') {
    const util = editor.getShapeUtil(shape) as {
      component(shape: EditableTextShape): ReactNode
      options?: { getCustomDisplayValues?: (...args: unknown[]) => CSSProperties }
    }
    const custom = { ...util.options?.getCustomDisplayValues?.(editor, shape), ...paintedTypeStyle(util, shape) }
    const bounds = editor.getShapeGeometry(shape).bounds
    return (
      <RichTextEditor
        {...common}
        className="crew-text-shape-editor"
        editorClassName="crew-rich-text"
        transform={{ x: 0, y: 0, rotation: 0, scaleX: shape.props.scale, scaleY: shape.props.scale }}
        style={withResolvedLineHeight({
          width: bounds.w / shape.props.scale,
          minHeight: bounds.h / shape.props.scale,
          color: shapeColor(editor, shape.props.color),
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize: TEXT_FONT_SIZES[shape.props.size],
          lineHeight: TEXT_LINE_HEIGHT,
          textAlign: textAlign(shape.props.textAlign),
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          ...custom
        })}
      />
    )
  }
  if (shape.type === 'geo') {
    return (
      <CenteredEditor
        {...common}
        inset={8}
        align={shape.props.align}
        verticalAlign={shape.props.verticalAlign}
        style={{
          color: shapeColor(editor, shape.props.labelColor),
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize: LABEL_FONT_SIZES[shape.props.size] * shape.props.scale,
          lineHeight: 1.35
        }}
      />
    )
  }
  if (shape.type === 'note') {
    const color =
      shape.props.labelColor === 'black'
        ? shapeColor(editor, shape.props.color, 'noteText')
        : shapeColor(editor, shape.props.labelColor, 'fill')
    return (
      <CenteredEditor
        {...common}
        className="crew-note-text-editor"
        inset={12 * shape.props.scale}
        align={shape.props.align}
        verticalAlign={shape.props.verticalAlign}
        style={{
          color,
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize: LABEL_FONT_SIZES[shape.props.size] * (shape.props.fontSizeAdjustment ?? 1) * shape.props.scale,
          lineHeight: 1.35
        }}
      />
    )
  }
  if (shape.type === 'arrow') {
    const middle = editor
      .getShapeUtil(shape)
      .getHandles?.(shape as never)
      ?.find(handle => handle.id === 'middle')
    return (
      <RichTextEditor
        {...common}
        className="crew-arrow-text-editor"
        editorClassName="crew-rich-text"
        style={{
          left: middle?.x ?? 0,
          top: middle?.y ?? 0,
          transform: 'translate(-50%, -50%)',
          minWidth: 24,
          padding: '2px 5px',
          background: canvasSurface(editor),
          color: shapeColor(editor, shape.props.labelColor),
          fontFamily: FONT_FAMILIES[shape.props.font],
          fontSize: ARROW_FONT_SIZES[shape.props.size],
          lineHeight: 1.35,
          whiteSpace: 'pre-wrap'
        }}
      />
    )
  }
  return null
}

function CenteredEditor({
  inset,
  align,
  verticalAlign,
  style,
  ...editorProps
}: Parameters<typeof RichTextEditor>[0] & {
  inset: number
  align: 'start' | 'middle' | 'end' | 'start-legacy' | 'middle-legacy' | 'end-legacy'
  verticalAlign: 'start' | 'middle' | 'end'
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align.startsWith('start') ? 'flex-start' : align.startsWith('end') ? 'flex-end' : 'center',
        justifyContent: verticalAlign === 'start' ? 'flex-start' : verticalAlign === 'end' ? 'flex-end' : 'center',
        pointerEvents: 'all'
      }}
    >
      <RichTextEditor
        {...editorProps}
        editorClassName="crew-rich-text"
        editorStyle={{ width: '100%' }}
        style={{
          ...style,
          position: 'relative',
          width: '100%',
          textAlign: align.startsWith('end') ? 'right' : align.startsWith('middle') ? 'center' : 'left'
        }}
      />
    </div>
  )
}

function textAlign(value: 'start' | 'middle' | 'end'): CSSProperties['textAlign'] {
  return value === 'middle' ? 'center' : value === 'end' ? 'right' : 'left'
}
