import { useEffect, useRef, type RefObject } from 'react'

const TRIES = 10

export function useAutoFocus<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null)

  useEffect(() => {
    let frame = 0
    let left = TRIES
    const take = () => {
      const el = ref.current
      if (!el || document.activeElement === el) return
      el.focus()
      if (document.activeElement !== el && left-- > 0) frame = requestAnimationFrame(take)
    }
    take()
    return () => cancelAnimationFrame(frame)
  }, [])

  return ref
}
