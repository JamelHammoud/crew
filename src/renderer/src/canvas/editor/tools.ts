import { atom, type Atom } from '../signals'

export class ToolManager {
  private readonly current: Atom<string>
  private readonly tools = new Map<string, unknown>()

  constructor(constructors: readonly unknown[] = [], initial = 'select') {
    for (const tool of constructors) {
      const id = toolId(tool)
      if (id) this.tools.set(id, tool)
    }
    this.current = atom('editor.currentTool', initial)
  }

  getCurrentToolId(): string {
    return this.current.get()
  }

  setCurrentTool(id: string): void {
    this.current.set(id)
  }

  has(id: string): boolean {
    return this.tools.has(id)
  }
}

function toolId(tool: unknown): string | null {
  if (!tool || (typeof tool !== 'object' && typeof tool !== 'function')) return null
  const id = (tool as { id?: unknown }).id
  return typeof id === 'string' ? id : null
}
