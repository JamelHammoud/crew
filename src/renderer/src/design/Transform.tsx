import { useEditor, useValue, type Editor, type TLShape, type TLShapeId } from 'tldraw'
import { PanelButton } from '../components/DesignControls'
import {
  AlignBottomGlyph,
  AlignCenterGlyph,
  AlignLeftGlyph,
  AlignMiddleGlyph,
  AlignRightGlyph,
  AlignTopGlyph,
  FlipHorizontalGlyph,
  FlipVerticalGlyph,
  type Glyph
} from './glyphs'
import { Field, NumberInput, Section } from './InspectorFields'

type Align = 'left' | 'center-horizontal' | 'right' | 'top' | 'center-vertical' | 'bottom'

const ALIGNMENTS: Array<{ op: Align; label: string; Icon: Glyph }> = [
  { op: 'left', label: 'Align left', Icon: AlignLeftGlyph },
  { op: 'center-horizontal', label: 'Align center', Icon: AlignCenterGlyph },
  { op: 'right', label: 'Align right', Icon: AlignRightGlyph },
  { op: 'top', label: 'Align top', Icon: AlignTopGlyph },
  { op: 'center-vertical', label: 'Align middle', Icon: AlignMiddleGlyph },
  { op: 'bottom', label: 'Align bottom', Icon: AlignBottomGlyph }
]

function sizeOf(shape: TLShape): { w: number; h: number } | null {
  const props = shape.props as { w?: unknown; h?: unknown }
  if (typeof props.w !== 'number' || typeof props.h !== 'number') return null
  return { w: props.w, h: props.h }
}

function alignWithin(editor: Editor, shape: TLShape, op: Align): void {
  const bounds = editor.getShapePageBounds(shape.id)
  const frame = editor.getShapePageBounds(shape.parentId as TLShapeId)
  if (!bounds || !frame) return
  const offset = { x: 0, y: 0 }
  if (op === 'left') offset.x = frame.minX - bounds.minX
  if (op === 'center-horizontal') offset.x = frame.midX - bounds.midX
  if (op === 'right') offset.x = frame.maxX - bounds.maxX
  if (op === 'top') offset.y = frame.minY - bounds.minY
  if (op === 'center-vertical') offset.y = frame.midY - bounds.midY
  if (op === 'bottom') offset.y = frame.maxY - bounds.maxY
  editor.nudgeShapes([shape.id], offset)
}

export default function Transform() {
  const editor = useEditor()
  const shapes = useValue('design selected shapes', () => editor.getSelectedShapes(), [editor])
  const only = shapes.length === 1 ? shapes[0] : null
  const size = only ? sizeOf(only) : null
  const nested = only ? editor.getShape(only.parentId as TLShapeId) !== undefined : false

  const align = (op: Align) => {
    editor.markHistoryStoppingPoint()
    if (shapes.length > 1) editor.alignShapes(editor.getSelectedShapeIds(), op)
    else if (only) alignWithin(editor, only, op)
  }

  const move = (next: { x?: number; y?: number }) => {
    if (!only) return
    editor.markHistoryStoppingPoint()
    editor.updateShape({ id: only.id, type: only.type, x: next.x ?? only.x, y: next.y ?? only.y })
  }

  const resize = (next: { w?: number; h?: number }) => {
    if (!only || !size) return
    editor.markHistoryStoppingPoint()
    editor.resizeShape(only.id, { x: (next.w ?? size.w) / size.w, y: (next.h ?? size.h) / size.h })
  }

  const spin = (degrees: number) => {
    if (!only) return
    editor.markHistoryStoppingPoint()
    editor.rotateShapesBy([only.id], (degrees * Math.PI) / 180 - only.rotation)
  }

  const flip = (operation: 'horizontal' | 'vertical') => {
    editor.markHistoryStoppingPoint()
    editor.flipShapes(editor.getSelectedShapeIds(), operation)
  }

  return (
    <>
      <Section label="Position">
        <div className="flex items-center justify-between">
          {ALIGNMENTS.map(item => (
            <PanelButton
              key={item.op}
              label={item.label}
              disabled={shapes.length < 2 && !nested}
              onClick={() => align(item.op)}
            >
              <item.Icon className="w-4 h-4" />
            </PanelButton>
          ))}
        </div>
        {only && (
          <>
            <div className="flex gap-2">
              <Field label="X">
                <NumberInput value={only.x} onChange={value => move({ x: value })} />
              </Field>
              <Field label="Y">
                <NumberInput value={only.y} onChange={value => move({ y: value })} />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Field label="Angle">
                <NumberInput
                  value={Math.round((only.rotation * 180) / Math.PI)}
                  min={-360}
                  max={360}
                  suffix="°"
                  onChange={spin}
                />
              </Field>
              <span className="flex items-center gap-1 shrink-0">
                <PanelButton label="Flip horizontal" onClick={() => flip('horizontal')}>
                  <FlipHorizontalGlyph className="w-4 h-4" />
                </PanelButton>
                <PanelButton label="Flip vertical" onClick={() => flip('vertical')}>
                  <FlipVerticalGlyph className="w-4 h-4" />
                </PanelButton>
              </span>
            </div>
          </>
        )}
      </Section>

      {size && (
        <Section label="Layout">
          <div className="flex gap-2">
            <Field label="W">
              <NumberInput value={size.w} min={1} onChange={value => resize({ w: value })} />
            </Field>
            <Field label="H">
              <NumberInput value={size.h} min={1} onChange={value => resize({ h: value })} />
            </Field>
          </div>
        </Section>
      )}
    </>
  )
}
