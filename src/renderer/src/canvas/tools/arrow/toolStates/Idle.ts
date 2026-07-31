import { ArrowStateNode } from '../StateNode'
import type {
  ArrowKeyboardInfo,
  ArrowPointerInfo,
  ArrowTimerId,
  ArrowTargetState
} from '../types'

export class Idle extends ArrowStateNode {
  readonly id = 'idle'
  isPrecise = false
  isPreciseTimerId: ArrowTimerId | null = null
  preciseTargetId: string | null = null

  override onEnter(): void {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
    this.update()
  }

  override onPointerMove(): void {
    this.update()
  }

  override onPointerDown(info: ArrowPointerInfo): void {
    this.parent.transition('pointing', { ...info, isPrecise: this.isPrecise })
  }

  override onCancel(): void {
    this.editor.setCurrentTool('select')
  }

  override onExit(): void {
    this.editor.clearArrowTargetState()
    this.clearPreciseTimeout()
  }

  override onKeyDown(): void {
    this.update()
  }

  override onKeyUp(info: ArrowKeyboardInfo): void {
    this.update()
    if (info.key !== 'Enter') return
    const shape = this.editor.getOnlySelectedShape()
    if (shape && this.editor.canEditShape(shape)) {
      this.editor.startEditingShapeWithRichText?.(shape, { selectAll: true })
    }
  }

  update(): void {
    const util = this.editor.getShapeUtil('arrow')
    const targetState = this.editor.updateArrowTargetState({
      editor: this.editor,
      pointInPageSpace: this.editor.inputs.getCurrentPagePoint(),
      arrow: undefined,
      isPrecise: this.isPrecise,
      currentBinding: undefined,
      oppositeBinding: undefined
    })

    if (targetState && targetState.target.id !== this.preciseTargetId) {
      this.clearPreciseTimeout()
      this.preciseTargetId = targetState.target.id
      this.isPreciseTimerId = this.editor.timers.setTimeout(() => {
        if (!this.getIsActive()) return
        this.isPrecise = true
        this.update()
      }, util.options.hoverPreciseTimeout)
    } else if (!targetState && this.preciseTargetId) {
      this.isPrecise = false
      this.preciseTargetId = null
      this.clearPreciseTimeout()
    }
  }

  private clearPreciseTimeout(): void {
    if (this.isPreciseTimerId === null) return
    const clear = this.editor.timers.clearTimeout ?? clearTimeout
    clear(this.isPreciseTimerId)
    this.isPreciseTimerId = null
  }
}

export type IdleArrowTargetState = ArrowTargetState
