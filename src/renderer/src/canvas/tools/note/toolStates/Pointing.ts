import { Vec } from '../../../math'
import { createShapeId, type TLShape, type TLShapeId } from '../../../schema'
import { BoxStateNode, maybeSnapToGrid, type BoxPointerInfo, type BoxToolEditor } from '../../box'
import { startEditingShapeWithRichText } from '../../text'

type NoteShape = TLShape<'note'>

export const NOTE_ADJACENT_POSITION_SNAP_RADIUS = 10

export class Pointing extends BoxStateNode {
  readonly id = 'pointing'
  info: BoxPointerInfo = {}
  markId = ''
  shape?: NoteShape
  private shapeId!: TLShapeId
  private shapeCenter = new Vec()
  private hasCreatedShape = false

  override onEnter(): void {
    this.hasCreatedShape = false
    this.shape = undefined
    this.shapeId = createShapeId()
    this.markId = this.editor.markHistoryStoppingPoint(`creating_note:${this.shapeId}`)
    const center = Vec.From(this.editor.inputs.getOriginPagePoint())
    const offset = getNoteShapeAdjacentPositionOffset(this.editor, center, this.editor.getResizeScaleFactor(), 200, 200)
    if (offset) center.sub(offset)
    this.shapeCenter = center
    if (!this.editor.getInstanceState().isCoarsePointer) this.ensureShapeCreated()
  }

  override onPointerMove(info: BoxPointerInfo): void {
    if (!this.editor.inputs.getIsDragging()) return
    this.ensureShapeCreated()
    if (!this.shape) return
    this.editor.setCurrentTool('select.translating', {
      ...info,
      target: 'shape',
      shape: this.shape,
      onInteractionEnd: 'note',
      isCreating: true,
      creatingMarkId: this.markId,
      onCreate: () => {
        if (this.shape) startEditingShapeWithRichText(this.editor, this.shape.id)
      }
    })
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onLongPress(): void {
    if (this.editor.getInstanceState().isCoarsePointer) this.cancel()
  }

  override onInterrupt(): void {
    this.cancel()
  }
  override onComplete(): void {
    this.complete()
  }
  override onCancel(): void {
    this.cancel()
  }

  private ensureShapeCreated(): void {
    if (this.hasCreatedShape) return
    const shape = createNoteShape(this.editor, this.shapeId, this.shapeCenter)
    if (!shape) {
      this.cancel()
      return
    }
    this.shape = shape
    this.hasCreatedShape = true
  }

  private complete(): void {
    this.ensureShapeCreated()
    if (!this.shape) return
    if (this.editor.getInstanceState().isToolLocked) this.parent.transition('idle')
    else startEditingShapeWithRichText(this.editor, this.shape.id, { info: this.info })
  }

  private cancel(): void {
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.parent.transition('idle', this.info)
  }
}

export function getNoteAdjacentPositions(
  editor: BoxToolEditor,
  shape: NoteShape,
  noteWidth: number,
  noteHeight: number
): Vec[] {
  const transform = editor.getShapePageTransform?.(shape.id)
  const pagePoint = transform?.point?.()
  if (!transform || !pagePoint) return []
  const scale = shape.props.scale
  const width = noteWidth * scale
  const height = noteHeight * scale
  const margin = (editor.options?.adjacentShapeMargin ?? 20) * scale
  const rotation = transform.rotation()
  const offsets = [
    new Vec(width * 0.5, -height * 0.5 - margin),
    new Vec(width * 1.5 + margin, height * 0.5),
    new Vec(width * 0.5, height * 1.5 + margin + shape.props.growY * scale),
    new Vec(-width * 0.5 - margin, height * 0.5)
  ]
  return offsets.map(offset => offset.rot(rotation).add(pagePoint))
}

export function getAvailableNoteAdjacentPositions(
  editor: BoxToolEditor,
  scale: number,
  noteWidth: number,
  noteHeight: number,
  rotation = 0
): Vec[] {
  const selected = new Set(editor.getSelectedShapeIds?.() ?? [])
  const notes = (editor.getCurrentPageShapes?.() ?? []).filter(
    (shape): shape is NoteShape =>
      shape.type === 'note' &&
      shape.props.scale === scale &&
      !selected.has(shape.id)
  )
  const positions = notes.flatMap(shape => getNoteAdjacentPositions(editor, shape, noteWidth, noteHeight))
  return positions.filter(position =>
    notes.every(shape => {
      const bounds = editor.getShapePageBounds(shape)
      if (!bounds) return true
      if (
        Vec.Dist2(bounds.center, position) >
        (Math.max(noteWidth, noteHeight) + (editor.options?.adjacentShapeMargin ?? 20)) ** 2
      )
        return true
      return !(editor.isPointInShape?.(shape, position) ?? bounds.containsPoint(position))
    })
  )
}

export function getNoteShapeAdjacentPositionOffset(
  editor: BoxToolEditor,
  center: Vec,
  scale: number,
  noteWidth: number,
  noteHeight: number
): Vec | undefined {
  let minimum = NOTE_ADJACENT_POSITION_SNAP_RADIUS / (editor.getZoomLevel?.() ?? 1)
  let offset: Vec | undefined
  for (const position of getAvailableNoteAdjacentPositions(editor, scale, noteWidth, noteHeight)) {
    const delta = Vec.Sub(center, position)
    const distance = delta.len()
    if (distance < minimum) {
      minimum = distance
      offset = delta
    }
  }
  return offset
}

export function createNoteShape(editor: BoxToolEditor, id: TLShapeId, center: Vec): NoteShape | undefined {
  const scale = editor.getResizeScaleFactor()
  editor.createShapes([{ id, type: 'note', x: center.x, y: center.y, props: { scale } }])
  const shape = editor.getShape(id)
  if (!shape || shape.type !== 'note') return
  editor.select(id)
  const bounds = editor.getShapeGeometry?.(shape)?.bounds
  const width = bounds?.width ?? 200 * scale
  const height = bounds?.height ?? 200 * scale
  const point = maybeSnapToGrid(new Vec(shape.x - width / 2, shape.y - height / 2), editor)
  editor.updateShape({ id, type: 'note', x: point.x, y: point.y })
  const updated = editor.getShape(id)
  return updated?.type === 'note' ? updated : undefined
}
