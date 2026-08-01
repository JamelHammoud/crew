import { useLayoutEffect, useRef } from 'react'

// Grows a textarea with its content up to maxHeight, then scrolls.
export function useAutoResize(value: string, maxHeight = 200) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const full = el.scrollHeight
    el.style.height = `${Math.min(full, maxHeight)}px`
    el.style.overflowY = full > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeight])

  return ref
}
