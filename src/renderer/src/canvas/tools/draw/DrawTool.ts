import { Drawing } from './Drawing'
import { DrawState } from './DrawState'
import type { FreehandEditor, FreehandKeyboardEvent, FreehandPointerEvent, FreehandShapeType } from './types'

export type DrawStateId = 'idle' | 'drawing'

export class DrawIdle extends DrawState {
  static readonly id = 'idle'

  override onEnter(): void {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onPointerDown(info: FreehandPointerEvent): void {
    if (info.accelKey && !info.shiftKey) {
      this.editor.setCurrentTool('eraser.pointing', { ...info, onInteractionEnd: this.tool.id })
      return
    }
    this.tool.transition('drawing', info)
  }

  override onCancel(): void {
    this.editor.setCurrentTool('select')
  }
}

export { DrawState } from './DrawState'

export class DrawTool {
  static readonly id: string = 'draw'
  static readonly initial = 'idle'
  static readonly isLockable = false
  static readonly useCoalescedEvents = true
  readonly children: { idle: DrawIdle; drawing: Drawing }
  stateId: DrawStateId = 'idle'

  constructor(
    readonly editor: FreehandEditor,
    readonly shapeType: FreehandShapeType = 'draw'
  ) {
    this.children = {
      idle: new DrawIdle(this, editor),
      drawing: new Drawing(this, editor)
    }
  }

  get id(): FreehandShapeType {
    return this.shapeType
  }

  get state(): DrawState {
    return this.children[this.stateId]
  }

  transition(id: DrawStateId, info?: FreehandPointerEvent): void {
    if (id === this.stateId) return
    this.state.onExit()
    this.stateId = id
    this.state.onEnter(info)
  }

  onPointerDown(info: FreehandPointerEvent): void {
    this.state.onPointerDown(info)
  }

  onPointerMove(info?: FreehandPointerEvent): void {
    this.state.onPointerMove(info)
  }

  onPointerUp(info?: FreehandPointerEvent): void {
    this.state.onPointerUp(info)
  }

  onKeyDown(info: FreehandKeyboardEvent): void {
    this.state.onKeyDown(info)
  }

  onKeyUp(info: FreehandKeyboardEvent): void {
    this.state.onKeyUp(info)
  }

  onCancel(): void {
    this.state.onCancel()
  }

  onComplete(): void {
    this.state.onComplete()
  }

  onInterrupt(): void {
    this.state.onInterrupt()
  }

  onExit(): void {
    this.children.drawing.initialShape = undefined
  }
}
