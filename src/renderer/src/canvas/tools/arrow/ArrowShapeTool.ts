import { ArrowStateNode, type ArrowStateParent } from './StateNode'
import { Idle } from './toolStates/Idle'
import { Pointing } from './toolStates/Pointing'
import type { ArrowKeyboardInfo, ArrowPointerInfo, ArrowToolEditor } from './types'

export class ArrowShapeTool implements ArrowStateParent {
  static readonly id = 'arrow'
  static readonly initial = 'idle'
  readonly id = ArrowShapeTool.id
  readonly shapeType = 'arrow'
  readonly states: Record<string, ArrowStateNode>
  current: ArrowStateNode

  constructor(readonly editor: ArrowToolEditor) {
    this.states = {
      idle: new Idle(editor, this),
      pointing: new Pointing(editor, this)
    }
    this.current = this.states[ArrowShapeTool.initial]
    this.current.onEnter({})
  }

  transition(id: string, info: ArrowPointerInfo = {}): void {
    const next = this.states[id]
    if (!next) throw new Error(`Unknown arrow state: ${id}`)
    this.current.onExit()
    this.current = next
    next.onEnter(info)
  }

  enter(info: ArrowPointerInfo = {}): void {
    this.current = this.states[ArrowShapeTool.initial]
    this.current.onEnter(info)
  }

  exit(): void {
    this.current.onExit()
  }

  getCurrentStateId(): string {
    return `${this.id}.${this.current.id}`
  }

  onPointerDown(info: ArrowPointerInfo = {}): void {
    this.current.onPointerDown(info)
  }

  onPointerMove(info: ArrowPointerInfo = {}): void {
    this.current.onPointerMove(info)
  }

  onPointerUp(info: ArrowPointerInfo = {}): void {
    this.current.onPointerUp(info)
  }

  onLongPress(info: ArrowPointerInfo = {}): void {
    this.current.onLongPress(info)
  }

  onKeyDown(info: ArrowKeyboardInfo = {}): void {
    this.current.onKeyDown(info)
  }

  onKeyUp(info: ArrowKeyboardInfo = {}): void {
    this.current.onKeyUp(info)
  }

  onCancel(info: ArrowPointerInfo = {}): void {
    this.current.onCancel(info)
  }

  onComplete(info: ArrowPointerInfo = {}): void {
    this.current.onComplete(info)
  }

  onInterrupt(info: ArrowPointerInfo = {}): void {
    this.current.onInterrupt(info)
  }
}
