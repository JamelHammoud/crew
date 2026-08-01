import { useCallback, useLayoutEffect, useRef, useState } from 'react'

const NEAR_TOP = 400

export interface DrawnTail {
  from: number
  more: boolean
  onScroll: () => void
  drawWhole: () => void
}

export function useDrawnTail(
  count: number,
  page: number,
  scrollRef: React.RefObject<HTMLDivElement | null>
): DrawnTail {
  const [held, setHeld] = useState(page)
  const [seen, setSeen] = useState(count)
  const asked = useRef<number | null>(null)

  if (seen !== count) {
    setSeen(count)
    if (count > seen) setHeld(before => before + (count - seen))
  }

  const from = Math.max(0, count - held)
  const more = from > 0

  const reachBack = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    asked.current = el.scrollHeight
    setHeld(before => before + page)
  }, [page, scrollRef])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const before = asked.current
    asked.current = null
    if (!el) return
    if (before !== null) {
      const grew = el.scrollHeight - before
      if (grew > 0) el.scrollTop += grew
      return
    }
    if (more && el.scrollHeight <= el.clientHeight) reachBack()
  }, [held, more, reachBack, scrollRef])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !more || el.scrollTop >= NEAR_TOP) return
    reachBack()
  }, [more, reachBack, scrollRef])

  const drawWhole = useCallback(() => setHeld(Number.POSITIVE_INFINITY), [])

  return { from, more, onScroll, drawWhole }
}
