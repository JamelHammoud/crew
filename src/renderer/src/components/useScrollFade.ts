import { useEffect, type RefObject } from 'react'

const EDGE = 1
type Axis = 'horizontal' | 'vertical'

export function useScrollFade(ref: RefObject<HTMLElement | null>, axis: Axis = 'vertical', enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    let frame = 0
    const read = (): void => {
      frame = 0
      if (axis === 'horizontal') {
        el.toggleAttribute('data-fade-left', el.scrollLeft > EDGE)
        el.toggleAttribute('data-fade-right', el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE)
      } else {
        el.toggleAttribute('data-fade-top', el.scrollTop > EDGE)
        el.toggleAttribute('data-fade-bottom', el.scrollTop + el.clientHeight < el.scrollHeight - EDGE)
      }
    }
    const soon = (): void => {
      if (frame) return
      frame = requestAnimationFrame(read)
    }
    read()
    el.addEventListener('scroll', soon, { passive: true })
    const box = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon)
    box?.observe(el)
    const rows = new MutationObserver(soon)
    rows.observe(el, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', soon)
      box?.disconnect()
      rows.disconnect()
    }
  }, [axis, enabled, ref])
}
