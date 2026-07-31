import type { TLShapeId } from '../../../schema/records'
import { LineStateNode } from '../StateNode'
import type { LinePointerInfo } from '../types'

export class Idle extends LineStateNode {
  readonly id = 'idle'
  private shapeId: TLShapeId | undefined

  override onEnter(info: LinePointerInfo): void {
    this.shapeId = info.shapeId as TLShapeId | undefined
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onPointerDown(): void {
    this.parent.transition('pointing', { shapeId: this.shapeId })
  }

  override onCancel(): void {
    this.editor.setCurrentTool('select')
  }
}
