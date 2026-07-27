import { useEffect, useRef, type RefObject } from 'react'

const TRIES = 10

// A field inside a popover mounts hidden for the pass the popover measures
// itself in, and a hidden element cannot take focus, so React's own autoFocus
// is spent on nothing. This asks again on each frame until the field really has
// it, which is the frame the popover is placed on.
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

  return ref as RefObject<T>
}
