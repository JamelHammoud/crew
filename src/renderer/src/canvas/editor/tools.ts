import { atom, type Atom } from '../signals'
import { EVENT_NAME_MAP, type CanvasEventInfo } from '../tools/state/events'
import { StateNode, type StateNodeConstructor } from '../tools/state/StateNode'
import { DraggingHandle, Resizing, Rotating, Translating } from '../tools/transforms'

interface ToolInstance {
  id?: string
  enter?(info?: unknown, from?: string): void
  exit?(info?: unknown, to?: string): void
  handleEvent?(info: CanvasEventInfo): void
  [key: string]: unknown
}

export class ToolManager {
  private readonly currentId: Atom<string>
  private readonly instances = new Map<string, ToolInstance>()

  constructor(editor: unknown, constructors: readonly unknown[] = [], initial = 'select') {
    for (const Constructor of constructors) {
      if (typeof Constructor !== 'function') continue
      const instance = new (Constructor as new (editor: unknown) => ToolInstance)(editor)
      const id = toolId(Constructor) ?? instance.id ?? null
      if (id === 'select') addTransformChildren(instance)
      if (id) this.instances.set(id, instance)
    }
    const first = this.instances.has(initial) ? initial : (this.instances.keys().next().value ?? initial)
    this.currentId = atom('editor.currentTool', first)
    this.instances.get(first)?.enter?.({}, 'initial')
  }

  getCurrentToolId(): string {
    return this.currentId.get()
  }

  getCurrentToolPath(): string {
    const current = this.getCurrent()
    return typeof current?.getPath === 'function' ? (current.getPath() as string) : this.currentId.get()
  }

  getCurrent(): ToolInstance | undefined {
    return this.instances.get(this.currentId.get())
  }

  setCurrentTool(id: string, info: unknown = {}): void {
    const [topLevelId, ...path] = id.split('.')
    const previousId = this.currentId.get()
    if (topLevelId === previousId) {
      transitionPath(this.instances.get(previousId), path, info)
      return
    }
    const previous = this.instances.get(previousId)
    const next = this.instances.get(topLevelId)
    if (!next) return
    previous?.exit?.(info, topLevelId)
    this.currentId.set(topLevelId)
    next?.enter?.(info, previousId)
    transitionPath(next, path, info)
  }

  dispatch(info: CanvasEventInfo): void {
    const current = this.getCurrent()
    if (!current) return
    if (current.handleEvent) {
      current.handleEvent(info)
      return
    }
    const handler = current[EVENT_NAME_MAP[info.name]]
    if (typeof handler === 'function') handler.call(current, info)
  }

  has(id: string): boolean {
    return this.instances.has(id)
  }
}

function addTransformChildren(instance: ToolInstance): void {
  const addChild = instance.addChild
  const children = instance.children as Record<string, unknown> | undefined
  if (typeof addChild !== 'function') return
  for (const Transform of [Translating, Resizing, Rotating, DraggingHandle]) {
    if (!children?.[Transform.id]) addChild.call(instance, transformNode(Transform))
  }
}

function transformNode(Transform: new (editor: any, parent: any) => any): StateNodeConstructor<any> {
  class TransformNode extends StateNode<any> {
    static id = (Transform as unknown as { id: string }).id
    private readonly transform = new Transform(this.editor, this.parent)

    override onEnter(info: unknown, from: string): void {
      this.transform.enter(info, from)
    }

    override onExit(info: unknown, to: string): void {
      this.transform.exit(info, to)
    }

    override handleEvent(info: CanvasEventInfo): void {
      const handler = this.transform[EVENT_NAME_MAP[info.name]]
      if (typeof handler === 'function') handler.call(this.transform, info)
    }
  }
  return TransformNode
}

function transitionPath(instance: ToolInstance | undefined, path: string[], info: unknown): void {
  if (!instance || path.length === 0) return
  const transition = instance.transition
  if (typeof transition !== 'function') return
  transition.call(instance, path.join('.'), info)
}

function toolId(tool: unknown): string | null {
  if (!tool || (typeof tool !== 'object' && typeof tool !== 'function')) return null
  const id = (tool as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}
