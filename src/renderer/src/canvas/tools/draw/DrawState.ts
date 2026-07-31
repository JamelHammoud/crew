import type { DrawTool } from './DrawTool'
import type { FreehandEditor, FreehandKeyboardEvent, FreehandPointerEvent } from './types'

export abstract class DrawState {
  constructor(
    protected readonly tool: DrawTool,
    protected readonly editor: FreehandEditor
  ) {}

  onEnter(_info?: FreehandPointerEvent): void {}
  onExit(): void {}
  onPointerDown(_info: FreehandPointerEvent): void {}
  onPointerMove(_info?: FreehandPointerEvent): void {}
  onPointerUp(_info?: FreehandPointerEvent): void {}
  onKeyDown(_info: FreehandKeyboardEvent): void {}
  onKeyUp(_info: FreehandKeyboardEvent): void {}
  onCancel(): void {}
  onComplete(): void {}
  onInterrupt(): void {}
}
