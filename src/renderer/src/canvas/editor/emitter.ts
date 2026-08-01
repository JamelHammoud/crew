export type EditorEventHandler = (...args: never[]) => void

export class EditorEmitter {
  private readonly handlers = new Map<string, Set<(...args: unknown[]) => void>>()

  on(event: string, handler: (...args: never[]) => void): void {
    const listeners = this.handlers.get(event) ?? new Set()
    listeners.add(handler as (...args: unknown[]) => void)
    this.handlers.set(event, listeners)
  }

  once(event: string, handler: (...args: never[]) => void): void {
    const wrapped = (...args: unknown[]): void => {
      this.off(event, wrapped)
      ;(handler as (...args: unknown[]) => void)(...args)
    }
    this.on(event, wrapped)
  }

  off(event: string, handler: (...args: never[]) => void): void {
    this.handlers.get(event)?.delete(handler as (...args: unknown[]) => void)
  }

  emit(event: string, ...args: unknown[]): void {
    const listeners = this.handlers.get(event)
    if (!listeners) return
    for (const handler of [...listeners]) handler(...args)
  }

  clear(): void {
    this.handlers.clear()
  }
}
