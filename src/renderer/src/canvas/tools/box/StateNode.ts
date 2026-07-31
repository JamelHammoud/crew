import type { BoxPointerInfo, BoxToolEditor } from './types'

export abstract class BoxStateNode {
  abstract readonly id: string

  constructor(
    readonly editor: BoxToolEditor,
    readonly parent: BoxStateParent
  ) {}

  getIsActive(): boolean {
    return this.parent.current === this
  }

  onEnter(_info: BoxPointerInfo): void {}
  onExit(): void {}
  onPointerDown(_info: BoxPointerInfo): void {}
  onPointerMove(_info: BoxPointerInfo): void {}
  onPointerUp(_info: BoxPointerInfo): void {}
  onLongPress(_info: BoxPointerInfo): void {}
  onCancel(_info: BoxPointerInfo): void {}
  onComplete(_info: BoxPointerInfo): void {}
  onInterrupt(_info: BoxPointerInfo): void {}
  onKeyDown(_info: BoxPointerInfo): void {}
}

export interface BoxStateParent {
  current: BoxStateNode
  transition(id: string, info?: BoxPointerInfo): void
}
