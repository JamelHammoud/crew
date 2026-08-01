import { useEffect, type RefObject } from 'react'

const EDGE = 1

export function useScrollFade(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const read = (): void => {
      frame = 0
      el.toggleAttribute('data-fade-top', el.scrollTop > EDGE)
      el.toggleAttribute('data-fade-bottom', el.scrollTop + el.clientHeight < el.scrollHeight - EDGE)
    }
    const soon = (): void => {
      if (frame) return
      frame = requestAnimationFrame(read)
    }
    read()
    el.addEventListener('scroll', soon, { passive: true })
    const box = new ResizeObserver(soon)
    box.observe(el)
    const rows = new MutationObserver(soon)
    rows.observe(el, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', soon)
      box.disconnect()
      rows.disconnect()
    }
  }, [ref])
}
