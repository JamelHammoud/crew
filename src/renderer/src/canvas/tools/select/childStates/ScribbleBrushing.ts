import { intersectLineSegmentPolygon } from '../../../geometry'
import { Box, pointInPolygon } from '../../../math'
import { StateNode } from '../../state'
import type { SelectEditor } from '../types'

export class ScribbleBrushing extends StateNode<SelectEditor> {
  static id = 'scribble_brushing'
  static trackPerformance = true
  private scribbleId = ''
  private initialSelectedShapeIds = new Set<any>()
  private newlySelectedShapeIds = new Set<any>()

  onEnter(): void {
    this.initialSelectedShapeIds = new Set(this.editor.inputs.getShiftKey() ? this.editor.getSelectedShapeIds() : [])
    this.newlySelectedShapeIds = new Set()
    this.scribbleId = this.editor.scribbles.addScribble({
      color: 'selection-stroke',
      opacity: 0.32,
      size: 12
    }).id
    this.updateScribbleSelection(true)
    this.editor.updateInstanceState({ brush: null })
  }

  onExit(): void {
    this.editor.scribbles.stop(this.scribbleId)
  }

  onPointerMove(): void {
    this.updateScribbleSelection(true)
  }

  onPointerUp(): void {
    this.complete()
  }

  onKeyDown(): void {
    this.updateScribbleSelection(false)
  }

  onKeyUp(): void {
    if (!this.editor.inputs.getAltKey()) this.parent.transition('brushing')
    else this.updateScribbleSelection(false)
  }

  onCancel(): void {
    this.editor.setSelectedShapes([...this.initialSelectedShapeIds])
    this.parent.transition('idle')
  }

  onComplete(): void {
    this.complete()
  }

  private complete(): void {
    this.updateScribbleSelection(true)
    this.parent.transition('idle')
  }

  private updateScribbleSelection(addPoint: boolean): void {
    const origin = this.editor.inputs.getOriginPagePoint()
    const previous = this.editor.inputs.getPreviousPagePoint()
    const current = this.editor.inputs.getCurrentPagePoint()
    if (addPoint) this.editor.scribbles.addPoint(this.scribbleId, current.x, current.y)
    const lineBounds = Box.FromPoints([previous, current])
    const candidates = this.editor.getShapeIdsInsideBounds(lineBounds)
    const shapes = this.editor.getCurrentPageRenderingShapesSorted().filter((shape: any) => candidates.has(shape.id))
    for (const shape of shapes) {
      if (
        this.editor.isShapeOfType(shape, 'group') ||
        this.newlySelectedShapeIds.has(shape.id) ||
        (!this.editor.options.selectLockedShapes && this.editor.isShapeOrAncestorLocked(shape))
      ) {
        continue
      }
      const geometry = this.editor.getShapeGeometry(shape)
      const transform = this.editor.getShapePageTransform(shape)
      if (!geometry || !transform) continue
      const inverse = transform.clone().invert()
      if (geometry.hitTestLineSegment(inverse.applyToPoint(previous), inverse.applyToPoint(current), 0)) {
        const outermost = this.editor.getOutermostSelectableShape(shape)
        const mask = this.editor.getShapeMask(outermost.id)
        if (mask && intersectLineSegmentPolygon(previous, current, mask) !== null && !pointInPolygon(current, mask)) {
          continue
        }
        this.newlySelectedShapeIds.add(outermost.id)
      }
    }
    const next = new Set(
      this.editor.inputs.getShiftKey()
        ? [...this.newlySelectedShapeIds, ...this.initialSelectedShapeIds]
        : [...this.newlySelectedShapeIds]
    )
    const selected = this.editor.getSelectedShapeIds()
    if (selected.length !== next.size || selected.some((id: any) => !next.has(id))) {
      this.editor.setSelectedShapes([...next])
    }
  }
}
