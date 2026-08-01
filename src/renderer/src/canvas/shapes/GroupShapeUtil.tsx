import { createElement, type ReactNode } from 'react'
import { Group2d, Rectangle2d, type Geometry2d } from '../geometry'
import { groupShapeProps, type TLShape as CrewShape } from '../schema'
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
  override getIndicatorPath(shape: GroupShape): Path2D | undefined {
    if (typeof Path2D === 'undefined') return undefined
    const bounds = this.editor.getShapeGeometry?.(shape)?.bounds
    if (!bounds) return undefined
    const path = new Path2D()
    path.rect(bounds.x, bounds.y, bounds.w, bounds.h)
    return path
  }
  override canResizeChildren(): boolean {
    return true
  }
  override canResize(): boolean {
    return true
  }
  component(_shape: GroupShape): ReactNode {
    return createElement('div')
  }
}
