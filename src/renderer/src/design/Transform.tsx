import { useEditor, useValue, type Editor, type TLShape, type TLShapeId } from 'tldraw'
import {
  AlignBottomGlyph,
  AlignCenterGlyph,
  AlignLeftGlyph,
  AlignMiddleGlyph,
  AlignRightGlyph,
  AlignTopGlyph,
  FlipHorizontalGlyph,
  FlipVerticalGlyph,
  RotationGlyph,
  type Glyph
} from './glyphs'
import { Field, NumberInput, Section } from './InspectorFields'
import { PanelButton } from '../components/DesignControls'

type Align = 'left' | 'center-horizontal' | 'right' | 'top' | 'center-vertical' | 'bottom'

const ALIGNMENTS: Array<{ op: Align; label: string; Icon: Glyph }> = [
  { op: 'left', label: 'Align left', Icon: AlignLeftGlyph },
  { op: 'center-horizontal', label: 'Align center', Icon: AlignCenterGlyph },
  { op: 'right', label: 'Align right', Icon: AlignRightGlyph },
  { op: 'top', label: 'Align top', Icon: AlignTopGlyph },
  { op: 'center-vertical', label: 'Align middle', Icon: AlignMiddleGlyph },
  { op: 'bottom', label: 'Align bottom', Icon: AlignBottomGlyph }
]

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
  const bounds = useValue('design selection bounds', () => editor.getSelectionRotatedPageBounds(), [editor])
  const only = shapes.length === 1 ? shapes[0] : null
  const inParent = only ? editor.getShape(only.parentId as TLShapeId) !== undefined : false
  const canAlign = shapes.length > 1 || inParent

  const align = (op: Align) => {
    editor.markHistoryStoppingPoint()
    if (shapes.length > 1) editor.alignShapes(editor.getSelectedShapeIds(), op)
    else if (only) alignWithin(editor, only, op)
  }

  const move = (axis: 'x' | 'y', value: number) => {
    if (!bounds) return
    editor.markHistoryStoppingPoint()
    editor.nudgeShapes(editor.getSelectedShapeIds(), {
      x: axis === 'x' ? value - bounds.minX : 0,
      y: axis === 'y' ? value - bounds.minY : 0
    })
  }

  const resize = (axis: 'w' | 'h', value: number) => {
    if (!bounds || value <= 0) return
    editor.markHistoryStoppingPoint()
    const scale = axis === 'w' ? value / bounds.w : value / bounds.h
    editor.resizeShape(editor.getSelectedShapeIds()[0], { x: axis === 'w' ? scale : 1, y: axis === 'h' ? scale : 1 })
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
        <div className="flex items-center gap-1">
          {ALIGNMENTS.map(item => (
            <PanelButton key={item.op} label={item.label} disabled={!canAlign} onClick={() => align(item.op)}>
              <item.Icon className="w-4 h-4" />
            </PanelButton>
          ))}
        </div>
        {bounds && (
          <div className="flex gap-2">
            <Field label="X">
              <NumberInput value={bounds.minX} onChange={value => move('x', value)} />
            </Field>
            <Field label="Y">
              <NumberInput value={bounds.minY} onChange={value => move('y', value)} />
            </Field>
          </div>
        )}
        {only && (
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
        )}
      </Section>

      {bounds && (
        <Section label="Layout">
          <div className="flex gap-2">
            <Field label="W">
              <NumberInput value={bounds.w} min={1} onChange={value => resize('w', value)} />
            </Field>
            <Field label="H">
              <NumberInput value={bounds.h} min={1} onChange={value => resize('h', value)} />
            </Field>
          </div>
        </Section>
      )}
    </>
  )
}

export { RotationGlyph }
