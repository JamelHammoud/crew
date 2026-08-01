import { LineStateNode, type LineStateParent } from './StateNode'
import { Idle } from './toolStates/Idle'
import { Pointing } from './toolStates/Pointing'
import type { LinePointerInfo, LineToolEditor } from './types'

export class LineShapeTool implements LineStateParent {
  static readonly id = 'line'
  static readonly initial = 'idle'
  readonly id = LineShapeTool.id
  readonly shapeType = 'line'
  readonly states: Record<string, LineStateNode>
  current: LineStateNode

  constructor(readonly editor: LineToolEditor) {
    this.states = {
      idle: new Idle(editor, this),
      pointing: new Pointing(editor, this)
    }
    this.current = this.states[LineShapeTool.initial]
    this.current.onEnter({})
  }

  transition(id: string, info: LinePointerInfo = {}): void {
    const next = this.states[id]
    if (!next) throw new Error(`Unknown line state: ${id}`)
    this.current.onExit()
    this.current = next
    next.onEnter(info)
  }

  enter(info: LinePointerInfo = {}): void {
    this.current = this.states[LineShapeTool.initial]
    this.current.onEnter(info)
  }

  exit(): void {
    this.current.onExit()
  }

  getCurrentStateId(): string {
    return `${this.id}.${this.current.id}`
  }

  onPointerDown(info: LinePointerInfo = {}): void {
    this.current.onPointerDown(info)
  }

  onPointerMove(info: LinePointerInfo = {}): void {
    this.current.onPointerMove(info)
  }

  onPointerUp(info: LinePointerInfo = {}): void {
    this.current.onPointerUp(info)
  }

  onLongPress(info: LinePointerInfo = {}): void {
    this.current.onLongPress(info)
  }

  onCancel(info: LinePointerInfo = {}): void {
    this.current.onCancel(info)
  }

  onComplete(info: LinePointerInfo = {}): void {
    this.current.onComplete(info)
  }

  onInterrupt(info: LinePointerInfo = {}): void {
    this.current.onInterrupt(info)
  }
}
