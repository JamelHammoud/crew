import { BoxStateNode, type BoxPointerInfo, type BoxStateParent, type BoxToolEditor } from '../box'
import { Idle } from './toolStates/Idle'
import { Pointing } from './toolStates/Pointing'

export class NoteShapeTool implements BoxStateParent {
  static readonly id = 'note'
  static readonly initial = 'idle'
  readonly id = NoteShapeTool.id
  readonly shapeType = 'note'
  readonly states: Record<string, BoxStateNode>
  current: BoxStateNode

  constructor(readonly editor: BoxToolEditor) {
    this.states = {
      idle: new Idle(editor, this),
      pointing: new Pointing(editor, this)
    }
    this.current = this.states.idle
  }

  transition(id: string, info: BoxPointerInfo = {}): void {
    const next = this.states[id]
    if (!next) throw new Error(`Unknown note state: ${id}`)
    this.current.onExit()
    this.current = next
    next.onEnter(info)
  }

  enter(info: BoxPointerInfo = {}): void {
    this.current = this.states[NoteShapeTool.initial]
    this.current.onEnter(info)
  }

  exit(): void {
    this.current.onExit()
  }

  getCurrentStateId(): string {
    return `${this.id}.${this.current.id}`
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
