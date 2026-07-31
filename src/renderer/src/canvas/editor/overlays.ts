export class OverlayManager {
  private readonly values = new Map<string, unknown>()

  constructor(constructors: readonly unknown[] = []) {
    for (const Constructor of constructors) {
      const value = typeof Constructor === 'function' ? new (Constructor as new () => unknown)() : Constructor
      const id = overlayId(value)
      if (id) this.values.set(id, value)
    }
  }

  get(id: string): unknown {
    return this.values.get(id)
  }

  all(): unknown[] {
    return [...this.values.values()]
  }
}

function overlayId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const id = (value as { id?: unknown }).id ?? (value as { constructor?: { id?: unknown } }).constructor?.id
  return typeof id === 'string' ? id : null
}
