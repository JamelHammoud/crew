import { BoxStateNode, type BoxPointerInfo, type BoxStateParent, type BoxToolEditor } from '../box'
import { Idle } from './toolStates/Idle'
import { Pointing } from './toolStates/Pointing'

export class TextShapeTool implements BoxStateParent {
  static readonly id = 'text'
  static readonly initial = 'idle'
  readonly id = TextShapeTool.id
  readonly shapeType = 'text'
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

  transition(id: string, info: BoxPointerInfo = {}): void {
    const next = this.states[id]
    if (!next) throw new Error(`Unknown text state: ${id}`)
    this.current.onExit()
    this.current = next
    next.onEnter(info)
  }

  enter(info: BoxPointerInfo = {}): void {
    this.current = this.states[TextShapeTool.initial]
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
}
