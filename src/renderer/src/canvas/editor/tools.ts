import { atom, type Atom } from '../signals'
import { EVENT_NAME_MAP, type CanvasEventInfo } from '../tools/state/events'

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
      if (id) this.instances.set(id, instance)
    }
    const first = this.instances.has(initial) ? initial : this.instances.keys().next().value ?? initial
    this.currentId = atom('editor.currentTool', first)
    this.instances.get(first)?.enter?.({}, 'initial')
  }

  getCurrentToolId(): string {
    return this.currentId.get()
  }

  getCurrent(): ToolInstance | undefined {
    return this.instances.get(this.currentId.get())
  }

  setCurrentTool(id: string, info: unknown = {}): void {
    const previousId = this.currentId.get()
    if (id === previousId) return
    const previous = this.instances.get(previousId)
    const next = this.instances.get(id)
    previous?.exit?.(info, id)
    this.currentId.set(id)
    next?.enter?.(info, previousId)
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

function toolId(tool: unknown): string | null {
  if (!tool || (typeof tool !== 'object' && typeof tool !== 'function')) return null
  const id = (tool as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}
