import { createElement, type ReactNode } from 'react'
import { Group2d, Rectangle2d, type Geometry2d } from '../geometry'
import { groupShapeProps, type TLShape as CrewShape } from '../schema'
import { dashedBoxPath, getPerfectDashProps } from './dash'
import { ShapeUtil } from './ShapeUtil'

export type GroupShape = CrewShape<'group'>

export class GroupShapeUtil extends ShapeUtil<GroupShape> {
  static override type = 'group' as const
  static override props = groupShapeProps

  getDefaultProps(): GroupShape['props'] {
    return {}
  }
  getGeometry(shape: GroupShape): Geometry2d {
    const ids = this.editor.getSortedChildIdsForParent?.(shape.id) ?? []
    const children = ids.flatMap(id => {
      const child = this.editor.getShape?.(id)
      if (!child) return []
      const geometry = this.editor.getShapeGeometry?.(child)
      if (!geometry) return []
      const bounds = geometry.bounds
      return [
        new Rectangle2d({
          x: child.x + bounds.x,
          y: child.y + bounds.y,
          width: Math.max(1, bounds.w),
          height: Math.max(1, bounds.h),
          isFilled: false
        })
      ]
    })
    return children.length ? new Group2d({ children }) : new Rectangle2d({ width: 1, height: 1, isFilled: false })
  }
  override canBind(): boolean {
    return false
  }
  override hideSelectionBoundsFg(): boolean {
    return true
  }
  override getIndicatorPath(shape: GroupShape): Path2D | undefined {
    const geometry = this.editor.getShapeGeometry?.(shape)
    if (!geometry) return undefined
    return dashedBoxPath(geometry.bounds.sides, 1 / Math.max(0.0001, this.editor.getZoomLevel?.() ?? 1))
  }
  override canResizeChildren(): boolean {
    return true
  }
  override canResize(): boolean {
    return true
  }
  component(shape: GroupShape): ReactNode {
    if (!this.showsOutline(shape)) return createElement('div')
    const bounds = this.editor.getShapeGeometry?.(shape)?.bounds
    if (!bounds) return createElement('div')
    const zoom = Math.max(0.0001, this.editor.getZoomLevel?.() ?? 1)
    return createElement(
      'svg',
      { className: 'crew-group-outline', width: bounds.w, height: bounds.h },
      bounds.sides.map(([start, end], at) => {
        const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(
          Math.hypot(end.x - start.x, end.y - start.y),
          1 / zoom,
          { style: 'dashed', lengthRatio: 4 }
        )
        return createElement('line', {
          key: at,
          x1: start.x - bounds.x,
          y1: start.y - bounds.y,
          x2: end.x - bounds.x,
          y2: end.y - bounds.y,
          strokeDasharray,
          strokeDashoffset
        })
      })
    )
  }
  private showsOutline(shape: GroupShape): boolean {
    if (this.editor.getErasingShapeIds?.()?.includes(shape.id)) return true
    const state = this.editor.getCurrentPageState?.()
    if (state?.focusedGroupId !== shape.id) return false
    const hinting = state?.hintingShapeIds ?? []
    return !hinting.some(id => {
      if (id === shape.id) return false
      const other = this.editor.getShape?.(id)
      return Boolean(other && other.type === 'group')
    })
  }
}
