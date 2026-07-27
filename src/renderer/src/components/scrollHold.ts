const holds = new Set<object>()
const listeners = new Set<() => void>()

export function scrollHeld(): boolean {
  return holds.size > 0
}

export function holdScroll(token: object): () => void {
  holds.add(token)
  return () => {
    if (!holds.delete(token) || holds.size > 0) return
    for (const listener of [...listeners]) listener()
  }
}

export function onScrollReleased(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
