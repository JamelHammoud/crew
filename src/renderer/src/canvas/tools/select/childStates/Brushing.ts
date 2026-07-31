import { polygonsIntersect } from '../../../geometry'
import { Box, pointInPolygon } from '../../../math'
import { react } from '../../../signals'
import { StateNode } from '../../state'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class Brushing extends StateNode<SelectEditor> {
  static id = 'brushing'
  static trackPerformance = true
  private initialSelectedShapeIds: any[] = []
  private excludedShapeIds = new Set<any>()
  private isWrapMode = false
  private viewportDidChange = false
  private cleanupViewportChangeReactor = () => {}

  onEnter(info: SelectPointerInfo): void {
    let initialCheck = true
    this.isWrapMode = this.editor.user.getIsWrapMode()
    this.viewportDidChange = false
    this.cleanupViewportChangeReactor = react('viewport change while brushing', () => {
      this.editor.getViewportPageBounds()
      if (!initialCheck) this.viewportDidChange = true
    })
    if (this.editor.inputs.getAltKey()) {
      this.parent.transition('scribble_brushing', info)
      return
    }
    const selectLockedShapes = this.editor.options.selectLockedShapes
    this.excludedShapeIds = new Set(
      this.editor
        .getCurrentPageShapes()
        .filter(
          (shape: any) =>
            this.editor.isShapeOfType(shape, 'group') ||
            (!selectLockedShapes && this.editor.isShapeOrAncestorLocked(shape))
        )
        .map((shape: any) => shape.id)
    )
    this.initialSelectedShapeIds = this.editor.getSelectedShapeIds().slice()
    this.hitTestShapes()
    initialCheck = false
  }

  onExit(): void {
    this.initialSelectedShapeIds = []
    this.editor.updateInstanceState({ brush: null })
    this.cleanupViewportChangeReactor()
  }

  onTick(info: { elapsed: number }): void {
    if (!this.editor.inputs.getIsDragging() || this.editor.inputs.getIsPanning()) return
    this.editor.edgeScrollManager.updateEdgeScrolling(info.elapsed)
  }

  onPointerMove(): void {
    this.hitTestShapes()
  }

  onPointerUp(): void {
    this.complete()
  }

  onComplete(): void {
    this.complete()
  }

  onCancel(info: SelectPointerInfo): void {
    this.editor.setSelectedShapes(this.initialSelectedShapeIds)
    this.parent.transition('idle', info)
  }

  onKeyDown(info: SelectPointerInfo): void {
    if (this.editor.inputs.getAltKey()) this.parent.transition('scribble_brushing', info)
    else this.hitTestShapes()
  }

  onKeyUp(): void {
    this.hitTestShapes()
  }

  onInterrupt(): void {
    this.editor.updateInstanceState({ brush: null })
  }

  private complete(): void {
    this.hitTestShapes()
    this.parent.transition('idle')
  }

  private hitTestShapes(): void {
    const origin = this.editor.inputs.getOriginPagePoint()
    const currentPoint = this.editor.inputs.getCurrentPagePoint()
    const results = new Set(this.editor.inputs.getShiftKey() ? this.initialSelectedShapeIds : [])
    const isWrapping = this.isWrapMode ? !this.editor.inputs.getCtrlKey() : this.editor.inputs.getCtrlKey()
    const brush = Box.FromPoints([origin, currentPoint])
    const candidateIds = this.editor.getShapeIdsInsideBounds(brush)
    const viewportContainsBrush = this.editor.getViewportPageBounds().contains(brush)
    const shapes = (
      viewportContainsBrush && !this.viewportDidChange
        ? this.editor.getCurrentPageRenderingShapesSorted()
        : this.editor.getCurrentPageShapesSorted()
    ).filter((shape: any) => candidateIds.has(shape.id))

    for (const shape of shapes) {
      if (this.excludedShapeIds.has(shape.id) || results.has(shape.id)) continue
      const bounds = this.editor.getShapePageBounds(shape)
      if (!bounds) continue
      if (brush.contains(bounds)) {
        this.handleHit(shape, currentPoint, results, brush.corners)
        continue
      }
      if (isWrapping || this.editor.isShapeFrameLike(shape) || !brush.collides(bounds)) continue
      const transform = this.editor.getShapePageTransform(shape)
      if (!transform) continue
      const corners = transform.clone().invert().applyToPoints(brush.corners)
      const geometry = this.editor.getShapeGeometry(shape)
      for (let i = 0; i < 4; i++) {
        if (geometry.hitTestLineSegment(corners[i], corners[(i + 1) % 4], 0)) {
          this.handleHit(shape, currentPoint, results, brush.corners)
          break
        }
      }
    }

    const oldBrush = this.editor.getInstanceState().brush
    if (!oldBrush || !brush.equals(oldBrush)) this.editor.updateInstanceState({ brush: brush.toJson() })
    const selected = this.editor.getSelectedShapeIds()
    if (selected.length !== results.size || selected.some((id: any) => !results.has(id))) {
      this.editor.setSelectedShapes([...results])
    }
  }

  private handleHit(shape: any, point: any, results: Set<any>, corners: any[]): void {
    if (shape.parentId === this.editor.getCurrentPageId()) {
      results.add(shape.id)
      return
    }
    const outermost = this.editor.getOutermostSelectableShape(shape)
    const mask = this.editor.getShapeMask(outermost.id)
    if (mask && !polygonsIntersect(mask, corners) && !pointInPolygon(point, mask)) return
    results.add(outermost.id)
  }
}
