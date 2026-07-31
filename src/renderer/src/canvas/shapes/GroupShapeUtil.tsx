import { createElement, type ReactNode } from 'react'
import { Group2d, Rectangle2d, type Geometry2d } from '../geometry'
import { groupShapeProps, type TLShape } from '../schema'
import { ShapeUtil } from './ShapeUtil'

export type TLGroupShape = TLShape<'group'>

export class GroupShapeUtil extends ShapeUtil<TLGroupShape> {
  static override type = 'group' as const
  static override props = groupShapeProps

  getDefaultProps(): TLGroupShape['props'] { return {} }
  getGeometry(shape: TLGroupShape): Geometry2d {
    const ids = this.editor.getSortedChildIdsForParent?.(shape.id) ?? []
    const children = ids.flatMap(id => {
      const child = this.editor.getShape?.(id)
      if (!child) return []
      const geometry = this.editor.getShapeGeometry?.(child)
      if (!geometry) return []
      const bounds = geometry.bounds
      return [new Rectangle2d({ x: child.x + bounds.x, y: child.y + bounds.y, width: Math.max(1, bounds.w), height: Math.max(1, bounds.h), isFilled: false })]
    })
    return children.length ? new Group2d({ children }) : new Rectangle2d({ width: 1, height: 1, isFilled: false })
  }
  override canBind(): boolean { return false }
  override canResize(): boolean { return false }
  component(_shape: TLGroupShape): ReactNode { return createElement('div') }
}
