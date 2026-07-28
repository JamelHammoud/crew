import { useCallback, useLayoutEffect, useRef } from 'react'

const NEAR_TOP = 400
const QUIET_PAGES = 5

/**
 * Reads older messages in as the reader comes up on the top of a scroller, and
 * puts them above where they are standing rather than under them: what arrives
 * lands outside the view, so the line being read does not move.
 *
 * A page can hold nothing this view draws, since the log carries far more than
 * any one screen of it shows. When one lands and the scroller is no taller for
 * it, the next is asked for straight away, up to a few in a row, or reaching
 * back would take a scroll per page with nothing to show for any of them. A
 * view with nothing to scroll asks for the same reason, since scrolling is the
 * only other way it would ever be asked.
 */
export function useLoadOlder(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  { more, loading, load }: { more: boolean; loading: boolean; load: () => void }
) {
  const height = useRef(0)
  const asked = useRef(false)
  const quiet = useRef(0)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (loading) {
      height.current = el.scrollHeight
      asked.current = true
      return
    }
    const landed = asked.current
    if (landed) {
      asked.current = false
      const grew = el.scrollHeight - height.current
      if (grew > 0) {
        el.scrollTop += grew
        quiet.current = 0
      } else {
        quiet.current += 1
      }
    }
    if (!more || quiet.current >= QUIET_PAGES) return
    if (el.scrollHeight <= el.clientHeight || (landed && el.scrollTop < NEAR_TOP)) load()
  }, [load, loading, more, scrollRef])

  return useCallback(() => {
    const el = scrollRef.current
    if (!el || !more || loading || el.scrollTop >= NEAR_TOP) return
    quiet.current = 0
    load()
  }, [load, loading, more, scrollRef])
}
