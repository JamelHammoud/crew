import { useLayoutEffect, useRef } from 'react'

function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let up = el.parentElement; up; up = up.parentElement) {
    const overflow = getComputedStyle(up).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return up
  }
  return null
}

export function useAutoResize(value: string, maxHeight = 200) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLElement | null>(null)
  const looked = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!looked.current) {
      scroller.current = scrollerOf(el)
      looked.current = true
    }
    const page = scroller.current
    const top = page?.scrollTop
    el.style.height = 'auto'
    const full = el.scrollHeight
    el.style.height = `${Math.min(full, maxHeight)}px`
    el.style.overflowY = full > maxHeight ? 'auto' : 'hidden'
    if (page && top !== undefined && page.scrollTop !== top) page.scrollTop = top
  }, [value, maxHeight])

  return ref
}
