import { useLayoutEffect, useRef, type ReactNode } from 'react'
import ScrollFade from '../ScrollFade'
import useScrollEdges from '../useScrollEdges'

export type Place = { at: number }

// One screen of the panel. It scrolls on its own rather than through a scroller
// the whole panel shares, which is what lets two of them stand one over the
// other while one gives way to the other, and it is what lets each one keep its
// own place: coming out of a playlist puts the shelf back where you were reading
// it rather than at the top of it.
export default function MusicScreen({
  place,
  under,
  children
}: {
  place: Place
  // Whether the bar is up. The list runs on underneath it, so it is given room
  // to scroll past and a deeper fade to go out under.
  under: boolean
  children: ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const { edges, update } = useScrollEdges(scroller)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = place.at
    update()
    return () => {
      place.at = el.scrollTop
    }
  }, [place])

  return (
    <>
      <div ref={scroller} className={`absolute inset-0 overflow-y-auto [scrollbar-width:thin] ${under ? 'pb-32' : ''}`}>
        {children}
      </div>
      <ScrollFade edges={{ top: edges.top, bottom: under ? true : edges.bottom }} />
      {/* A taller fade while the bar is up. The list runs on under the glass, and
          it has to be gone by the time it would show in the margin the bar
          floats in, or a row reappears under it a moment after passing behind
          it. */}
      {under && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ink-900 from-30% to-transparent pointer-events-none"
        />
      )}
    </>
  )
}
