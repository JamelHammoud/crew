import type {
  ArrowKeyboardInfo,
  ArrowPointerInfo,
  ArrowToolEditor
} from './types'

export abstract class ArrowStateNode {
  abstract readonly id: string

  constructor(
    readonly editor: ArrowToolEditor,
    readonly parent: ArrowStateParent
  ) {}

  getIsActive(): boolean {
    return this.parent.current === this
  }

  onEnter(_info: ArrowPointerInfo): void {}
  onExit(): void {}
  onPointerDown(_info: ArrowPointerInfo): void {}
  onPointerMove(_info: ArrowPointerInfo): void {}
  onPointerUp(_info: ArrowPointerInfo): void {}
  onLongPress(_info: ArrowPointerInfo): void {}
  onKeyDown(_info: ArrowKeyboardInfo): void {}
  onKeyUp(_info: ArrowKeyboardInfo): void {}
  onCancel(_info: ArrowPointerInfo): void {}
  onComplete(_info: ArrowPointerInfo): void {}
  onInterrupt(_info: ArrowPointerInfo): void {}
}

export interface ArrowStateParent {
  current: ArrowStateNode
  transition(id: string, info?: ArrowPointerInfo): void
}
