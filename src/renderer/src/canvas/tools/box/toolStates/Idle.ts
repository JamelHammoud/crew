import { BoxStateNode } from '../StateNode'
import type { BoxPointerInfo } from '../types'

export class Idle extends BoxStateNode {
  readonly id = 'idle'

  override onPointerDown(info: BoxPointerInfo): void {
    this.parent.transition('pointing', info)
  }

  override onEnter(): void {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onCancel(): void {
    this.editor.setCurrentTool('select')
  }
}
