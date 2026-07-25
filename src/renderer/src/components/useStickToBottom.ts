import { useCallback, useRef, useState } from 'react'
import { hoverCardOpen } from './HoverCard'

// Hysteresis: rubber-band bounce at the bottom must not unpin, and a deliberate
// upward scroll must never have to outrun the streaming auto-scroll.
const UNPIN_SLOP = 12
const REPIN_DISTANCE = 60
const AT_BOTTOM_SLOP = 2

type Remembered = { top: number; pinned: boolean }

const remembered = new Map<string, Remembered>()

/**
 * Tracks whether the user is pinned to the bottom of a scroll container.
 * Scrolling up past a small threshold unpins (auto-scroll stops fighting the
 * user); scrolling back into the bottom re-pins. Reads direction from scroll
 * events, so programmatic scrolls to the bottom never unpin.
 *
 * Pass a key to remember where the user was across unmounts, so leaving a view
 * and coming back lands in the same place. A view left at the bottom returns to
 * the bottom, since messages may have arrived while it was gone.
 */
export function useStickToBottom(scrollRef: React.RefObject<HTMLDivElement | null>, memoryKey?: string) {
  const pinnedRef = useRef(true)
  const [scrolledUp, setScrolledUp] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const lastScrollTop = useRef(0)
  const restored = useRef(false)

  const setPinned = useCallback((pinned: boolean) => {
    pinnedRef.current = pinned
    setScrolledUp(!pinned)
  }, [])

  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_SLOP)
  }, [scrollRef])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setAtBottom(distance <= AT_BOTTOM_SLOP)
    const up = el.scrollTop < lastScrollTop.current
    if (up && distance > UNPIN_SLOP) setPinned(false)
    else if (!up && distance <= REPIN_DISTANCE) setPinned(true)
    lastScrollTop.current = el.scrollTop
    if (memoryKey) remembered.set(memoryKey, { top: el.scrollTop, pinned: pinnedRef.current })
  }, [memoryKey, scrollRef, setPinned])

  const jumpToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setPinned(true)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [scrollRef, setPinned])

  const follow = useCallback(
    (ready = true) => {
      const el = scrollRef.current
      if (!el) return
      if (restored.current) {
        if (pinnedRef.current && !hoverCardOpen()) {
          el.scrollTop = el.scrollHeight
          lastScrollTop.current = el.scrollTop
        }
        measure()
        return
      }
      if (!ready) return
      restored.current = true
      const saved = memoryKey ? remembered.get(memoryKey) : undefined
      if (saved && !saved.pinned) {
        setPinned(false)
        lastScrollTop.current = saved.top
        el.scrollTop = saved.top
        measure()
        return
      }
      el.scrollTop = el.scrollHeight
      lastScrollTop.current = el.scrollTop
      measure()
    },
    [measure, memoryKey, scrollRef, setPinned]
  )

  return { pinnedRef, scrolledUp, atBottom, onScroll, jumpToBottom, follow }
}
