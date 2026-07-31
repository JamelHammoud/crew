import { atom, computed } from '../../signals'
import { EVENT_NAME_MAP, type CanvasEventInfo, type StateEventHandlers } from './events'

export interface StateNodeEditor {
  performance?: {
    _notifyInteractionStart(id: string, path: string): void
    _notifyInteractionEnd(): void
  }
}

export interface StateNodeConstructor<Editor extends StateNodeEditor = StateNodeEditor> {
  new (editor: Editor, parent?: StateNode<Editor>): StateNode<Editor>
  id: string
  initial?: string
  children?(): StateNodeConstructor<Editor>[]
  isLockable: boolean
  useCoalescedEvents: boolean
  trackPerformance: boolean
}

export type TLStateNodeConstructor<Editor extends StateNodeEditor = StateNodeEditor> = StateNodeConstructor<Editor>

export abstract class StateNode<Editor extends StateNodeEditor = StateNodeEditor> implements StateEventHandlers {
  static id: string
  static initial?: string
  static children?: () => StateNodeConstructor[]
  static isLockable = true
  static useCoalescedEvents = false
  static trackPerformance = false

  readonly id: string
  readonly type: 'branch' | 'leaf' | 'root'
  readonly isLockable: boolean
  readonly useCoalescedEvents: boolean
  readonly parent: StateNode<Editor>
  shapeType?: string
  initial?: string
  children?: Record<string, StateNode<Editor>>

  private readonly activeState
  private readonly currentState
  private readonly pathState
  private readonly currentToolIdMask = atom<string | undefined>('current tool id mask', undefined)

  constructor(
    readonly editor: Editor,
    parent?: StateNode<Editor>
  ) {
    const Constructor = this.constructor as StateNodeConstructor<Editor>
    this.id = Constructor.id
    this.activeState = atom(`toolIsActive${this.id}`, false)
    this.currentState = atom<StateNode<Editor> | undefined>(`toolState${this.id}`, undefined)
    this.pathState = computed(`toolPath${this.id}`, () => {
      const current = this.getCurrent()
      return this.id + (current ? `.${current.getPath()}` : '')
    })
    this.parent = parent ?? ({} as StateNode<Editor>)
    this.isLockable = Constructor.isLockable
    this.useCoalescedEvents = Constructor.useCoalescedEvents

    if (!parent) {
      this.type = 'root'
    } else if (Constructor.children && Constructor.initial) {
      this.type = 'branch'
    } else {
      this.type = 'leaf'
    }

    if (Constructor.children && Constructor.initial) {
      this.initial = Constructor.initial
      this.children = Object.fromEntries(Constructor.children().map(Child => [Child.id, new Child(this.editor, this)]))
      const initial = this.children[this.initial]
      if (!initial) throw new Error(`${this.id} - no child state exists with the id ${this.initial}.`)
      this.currentState.set(initial)
    }
  }

  getPath(): string {
    return this.pathState.get()
  }

  getCurrent(): StateNode<Editor> | undefined {
    return this.currentState.get()
  }

  getIsActive(): boolean {
    return this.activeState.get()
  }

  transition(id: string, info: any = {}): this {
    const path = id.split('.')
    let current: StateNode<Editor> = this
    for (const childId of path) {
      const previous = current.getCurrent()
      const next = current.children?.[childId]
      if (!next) throw new Error(`${current.id} - no child state exists with the id ${childId}.`)
      if (previous?.id !== next.id) {
        previous?.exit(info, childId)
        current.currentState.set(next)
        next.enter(info, previous?.id ?? 'initial')
        if (!next.getIsActive()) break
      }
      current = next
    }
    return this
  }

  handleEvent(info: CanvasEventInfo): void {
    const handler = EVENT_NAME_MAP[info.name] as keyof this
    const current = this.currentState.__unsafe__getWithoutCapture()
    const callback = this[handler]
    if (typeof callback === 'function') callback.call(this, info)
    if (
      this.activeState.__unsafe__getWithoutCapture() &&
      current &&
      current === this.currentState.__unsafe__getWithoutCapture()
    ) {
      current.handleEvent(info)
    }
  }

  enter(info: any = {}, from = 'initial'): void {
    const trackPerformance = (this.constructor as StateNodeConstructor<Editor>).trackPerformance
    if (trackPerformance) this.editor.performance?._notifyInteractionStart(this.id, this.getPath())
    this.activeState.set(true)
    this.onEnter?.(info, from)
    if (this.children && this.initial && this.getIsActive()) {
      const initial = this.children[this.initial]
      this.currentState.set(initial)
      initial.enter(info, from)
    }
  }

  exit(info: any = {}, to = 'initial'): void {
    const trackPerformance = (this.constructor as StateNodeConstructor<Editor>).trackPerformance
    if (trackPerformance) this.editor.performance?._notifyInteractionEnd()
    this.activeState.set(false)
    this.onExit?.(info, to)
    if (!this.getIsActive()) this.getCurrent()?.exit(info, to)
  }

  getCurrentToolIdMask(): string | undefined {
    return this.currentToolIdMask.get()
  }

  setCurrentToolIdMask(id: string | undefined): void {
    this.currentToolIdMask.set(id)
  }

  addChild(childConstructor: StateNodeConstructor<Editor>): this {
    if (this.type === 'leaf') throw new Error('StateNode.addChild: cannot add child to a leaf node')
    this.children ??= {}
    const child = new childConstructor(this.editor, this)
    if (this.children[child.id]) {
      throw new Error(`StateNode.addChild: a child with id '${child.id}' already exists`)
    }
    this.children[child.id] = child
    return this
  }

  onEnter?(info: any, from: string): void
  onExit?(info: any, to: string): void
  onWheel?(info: any): void
  onPointerDown?(info: any): void
  onPointerMove?(info: any): void
  onLongPress?(info: any): void
  onPointerUp?(info: any): void
  onDoubleClick?(info: any): void
  onRightClick?(info: any): void
  onMiddleClick?(info: any): void
  onKeyDown?(info: any): void
  onKeyUp?(info: any): void
  onKeyRepeat?(info: any): void
  onCancel?(info: any): void
  onComplete?(info: any): void
  onInterrupt?(info: any): void
  onTick?(info: any): void
}
