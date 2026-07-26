import { useState } from 'react'
import { useEditor, useValue, type Editor, type TLShape, type TLShapeId } from 'tldraw'
import { PanelButton } from '../components/DesignControls'
import {
  AlignBottomGlyph,
  AlignCenterGlyph,
  AlignLeftGlyph,
  AlignMiddleGlyph,
  AlignRightGlyph,
  AlignTopGlyph,
  AngleGlyph,
  ConstrainGlyph,
  FlipHorizontalGlyph,
  FlipVerticalGlyph,
  type Glyph
} from './glyphs'
import { alignOffset, type Align } from './align'
import { NumberInput, Row, Section, SubLabel } from './InspectorFields'

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
  editor.nudgeShapes([shape.id], alignOffset(bounds, frame, op))
}

export default function Transform() {
  const editor = useEditor()
  const [locked, setLocked] = useState(false)
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
    const scale = next.w !== undefined ? next.w / size.w : (next.h ?? size.h) / size.h
    const x = next.w !== undefined ? scale : locked ? scale : 1
    const y = next.h !== undefined ? scale : locked ? scale : 1
    editor.resizeShape(only.id, { x, y })
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
      <Section title="Position">
        <SubLabel>Alignment</SubLabel>
        <div className="flex items-center gap-2">
          {[ALIGNMENTS.slice(0, 3), ALIGNMENTS.slice(3)].map((group, at) => (
            <div key={at} className="flex-1 flex items-center gap-0.5 rounded-full bg-fg/[0.06] p-0.5">
              {group.map(item => (
                <span key={item.op} className="flex-1 flex justify-center">
                  <PanelButton
                    label={item.label}
                    disabled={shapes.length < 2 && !nested}
                    onClick={() => align(item.op)}
                  >
                    <item.Icon className="w-4 h-4" />
                  </PanelButton>
                </span>
              ))}
            </div>
          ))}
        </div>
        {only && (
          <>
            <SubLabel>Position</SubLabel>
            <Row>
              <NumberInput label="X" value={only.x} onChange={value => move({ x: value })} />
              <NumberInput label="Y" value={only.y} onChange={value => move({ y: value })} />
            </Row>
            <SubLabel>Rotation</SubLabel>
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 flex">
                <NumberInput
                  icon={<AngleGlyph className="w-4 h-4" />}
                  value={Math.round((only.rotation * 180) / Math.PI)}
                  min={-360}
                  max={360}
                  suffix="°"
                  onChange={spin}
                />
              </span>
              <span className="flex-1 flex items-center gap-0.5 rounded-full bg-fg/[0.06] p-0.5">
                <span className="flex-1 flex justify-center">
                  <PanelButton label="Flip horizontal" onClick={() => flip('horizontal')}>
                    <FlipHorizontalGlyph className="w-4 h-4" />
                  </PanelButton>
                </span>
                <span className="flex-1 flex justify-center">
                  <PanelButton label="Flip vertical" onClick={() => flip('vertical')}>
                    <FlipVerticalGlyph className="w-4 h-4" />
                  </PanelButton>
                </span>
              </span>
            </div>
          </>
        )}
      </Section>

      {size && (
        <Section title="Layout">
          <SubLabel>Dimensions</SubLabel>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <NumberInput label="W" value={size.w} min={1} onChange={value => resize({ w: value })} />
            <NumberInput label="H" value={size.h} min={1} onChange={value => resize({ h: value })} />
            <PanelButton
              label={locked ? 'Free size' : 'Keep proportions'}
              active={locked}
              onClick={() => setLocked(value => !value)}
            >
              <ConstrainGlyph className="w-4 h-4" />
            </PanelButton>
          </div>
        </Section>
      )}
    </>
  )
}
