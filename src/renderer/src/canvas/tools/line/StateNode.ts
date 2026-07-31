import type { LinePointerInfo, LineToolEditor } from './types'

export abstract class LineStateNode {
  abstract readonly id: string

  constructor(
    readonly editor: LineToolEditor,
    readonly parent: LineStateParent
  ) {}

  getIsActive(): boolean {
    return this.parent.current === this
  }

  onEnter(_info: LinePointerInfo): void {}
  onExit(): void {}
  onPointerDown(_info: LinePointerInfo): void {}
  onPointerMove(_info: LinePointerInfo): void {}
  onPointerUp(_info: LinePointerInfo): void {}
  onLongPress(_info: LinePointerInfo): void {}
  onCancel(_info: LinePointerInfo): void {}
  onComplete(_info: LinePointerInfo): void {}
  onInterrupt(_info: LinePointerInfo): void {}
}

export interface LineStateParent {
  current: LineStateNode
  transition(id: string, info?: LinePointerInfo): void
}
