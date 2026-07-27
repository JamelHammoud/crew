import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

// One screen inside a card giving way to another. The screen that arrives
// travels the way you are going, and the box it stands in takes the height of
// whatever is in it, so a card that grows or shrinks does it in one movement
// rather than jumping to the new size and playing an animation inside it.
//
// Only a change animates. Opening the card is the card's own animation, and a
// screen sliding in behind that is two movements for one action.
export default function ScreenSwap({
  screen,
  depth,
  children
}: {
  screen: string
  // How far in this screen is. It is what tells going deeper from coming back,
  // which is the direction the new screen travels from.
  depth: number
  children: ReactNode
}) {
  const inner = useRef<HTMLDivElement>(null)
  const opened = useRef(screen)
  const was = useRef(depth)
  const [height, setHeight] = useState<number | null>(null)
  const back = depth < was.current
  was.current = depth

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const watching = new ResizeObserver(measure)
    watching.observe(el)
    return () => watching.disconnect()
  }, [screen])

  return (
    <div
      style={height === null ? undefined : { height }}
      className="relative overflow-hidden transition-[height] duration-200 ease-out"
    >
      <div
        key={screen}
        ref={inner}
        className={opened.current === screen ? '' : back ? 'animate-screen-back' : 'animate-screen'}
      >
        {children}
      </div>
    </div>
  )
}
