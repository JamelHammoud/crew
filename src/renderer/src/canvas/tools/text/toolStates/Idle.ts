import { BoxStateNode, type BoxPointerInfo } from '../../box'
import { startEditingShapeWithRichText } from '../editing'

export class Idle extends BoxStateNode {
  readonly id = 'idle'

  override onPointerMove(): void {
    this.editor.updateHoveredShapeId?.()
  }

  override onPointerDown(info: BoxPointerInfo): void {
    this.parent.transition('pointing', info)
  }

  override onEnter(): void {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onExit(): void {
    this.editor.cancelUpdateHoveredShapeId?.()
  }

  override onKeyDown(info: BoxPointerInfo): void {
    if (info.key !== 'Enter') return
    const shape = this.editor.getOnlySelectedShape?.()
    if (!shape || (this.editor.canEditShape && !this.editor.canEditShape(shape))) return
    this.editor.setCurrentTool('select')
    startEditingShapeWithRichText(this.editor, shape, { info })
  }

  override onCancel(): void {
    this.editor.setCurrentTool('select')
  }
}
