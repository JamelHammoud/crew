import type { TLShape, TLShapeType } from '../../schema'
import { BoxStateNode, type BoxStateParent } from './StateNode'
import { Idle } from './toolStates/Idle'
import { Pointing } from './toolStates/Pointing'
import type { BoxPointerInfo, BoxToolEditor } from './types'

export abstract class BaseBoxShapeTool implements BoxStateParent {
  static readonly id: string = 'box'
  static readonly initial = 'idle'
  abstract readonly shapeType: TLShapeType
  readonly states: Record<string, BoxStateNode>
  current: BoxStateNode

  constructor(readonly editor: BoxToolEditor) {
    this.states = {
      idle: new Idle(editor, this),
      pointing: new Pointing(editor, this)
    }
    this.current = this.states.idle
    this.current.onEnter({})
  }

  get id(): string {
    return (this.constructor as typeof BaseBoxShapeTool).id
  }

  transition(id: string, info: BoxPointerInfo = {}): void {
    const next = this.states[id]
    if (!next) throw new Error(`Unknown ${this.id} state: ${id}`)
    this.current.onExit()
    this.current = next
    next.onEnter(info)
  }

  enter(info: BoxPointerInfo = {}): void {
    this.current = this.states[(this.constructor as typeof BaseBoxShapeTool).initial]
    this.current.onEnter(info)
  }

  exit(): void {
    this.current.onExit()
  }

  getPath(): string {
    return `${this.id}.${this.current.id}`
  }

  getCurrentStateId(): string {
    return this.getPath()
  }

  onPointerDown(info: BoxPointerInfo = {}): void {
    this.current.onPointerDown(info)
  }
  onPointerMove(info: BoxPointerInfo = {}): void {
    this.current.onPointerMove(info)
  }
  onPointerUp(info: BoxPointerInfo = {}): void {
    this.current.onPointerUp(info)
  }
  onLongPress(info: BoxPointerInfo = {}): void {
    this.current.onLongPress(info)
  }
  onCancel(info: BoxPointerInfo = {}): void {
    this.current.onCancel(info)
  }
  onComplete(info: BoxPointerInfo = {}): void {
    this.current.onComplete(info)
  }
  onInterrupt(info: BoxPointerInfo = {}): void {
    this.current.onInterrupt(info)
  }
  onKeyDown(info: BoxPointerInfo = {}): void {
    this.current.onKeyDown(info)
  }

  onCreate?(_shape: TLShape | null): void
}
