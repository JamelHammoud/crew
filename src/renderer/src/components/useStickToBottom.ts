import { useCallback, useRef, useState } from 'react'

// Hysteresis: rubber-band bounce at the bottom must not unpin, and a deliberate
// upward scroll must never have to outrun the streaming auto-scroll.
const UNPIN_SLOP = 12
const REPIN_DISTANCE = 60

/**
 * Tracks whether the user is pinned to the bottom of a scroll container.
 * Scrolling up past a small threshold unpins (auto-scroll stops fighting the
 * user); scrolling back into the bottom re-pins. Reads direction from scroll
 * events, so programmatic scrolls to the bottom never unpin.
 */
export function useStickToBottom(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const pinnedRef = useRef(true)
  const [scrolledUp, setScrolledUp] = useState(false)
  const lastScrollTop = useRef(0)

  const setPinned = useCallback((pinned: boolean) => {
    pinnedRef.current = pinned
    setScrolledUp(!pinned)
  }, [])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const up = el.scrollTop < lastScrollTop.current
    if (up && distance > UNPIN_SLOP) setPinned(false)
    else if (!up && distance <= REPIN_DISTANCE) setPinned(true)
    lastScrollTop.current = el.scrollTop
  }, [scrollRef, setPinned])

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setPinned(true)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [scrollRef, setPinned])

  return { pinnedRef, scrolledUp, onScroll, jumpToBottom }
}
