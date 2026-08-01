export function movedBy(event: Event, el: Element | null): boolean {
  if (!el) return false
  const target = event.target
  return target instanceof Node ? target.contains(el) : true
}
