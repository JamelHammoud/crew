import { useEffect, useRef, useState, type ReactNode } from 'react'

// How long the screen being left is held on for. The one arriving is what sets
// it, since it is the slower of the two.
const GONE = 200

// How long a card clips for. The screen arriving and the height moving are both
// 200ms, and past that there is nothing travelling to cut.
const MOVING = 260

type Leaving = { screen: string; node: ReactNode; back: boolean }

// One screen giving way to another. The screen that arrives travels the way you
// are going, so going deeper comes in from the right and coming back comes in
// from the left.
//
// In a card the box takes the height of whatever is in it, so a card that grows
// or shrinks does it in one movement rather than jumping to the new size and
// playing an animation inside it. The screen being left goes where it stands,
// because the height is already moving and there is nothing behind it to see.
//
// `fill` is the same idea in a box that already has its size, a panel rather
// than a card. Nothing carries the change there, so the screen being left is
// held on for the length of the movement and watched out, and the two stand one
// over the other while it happens. It is keyed on its own name, so the screen
// that steps back is the same one that was standing there: it keeps its scroll,
// its state and everything it had drawn, and only the class it wears changes.
//
// Only a change animates. Opening the card is the card's own animation, and a
// screen sliding in behind that is two movements for one action.
export default function ScreenSwap({
  screen,
  depth,
  fill = false,
  children
}: {
  screen: string
  // How far in this screen is. It is what tells going deeper from coming back,
  // which is the direction the new screen travels from.
  depth: number
  // For a box that already has its size, where the screen being left has to be
  // seen to go.
  fill?: boolean
  children: ReactNode
}) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  // What was last drawn, so the screen being left can be held on to. It is the
  // same element it was, so React leaves that whole subtree alone rather than
  // drawing it again on its way out.
  const held = useRef<ReactNode>(children)
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  // The direction is kept beside the screen rather than worked out each time,
  // or a render that lands mid-movement reads the depth as unchanged and turns
  // the animation round under itself.
  const [shown, setShown] = useState({ screen, depth, back: false, first: true })

  if (shown.screen !== screen) {
    const back = depth < shown.depth
    setShown({ screen, depth, back, first: false })
    if (fill) setLeaving({ screen: shown.screen, node: held.current, back })
  }

  useEffect(() => {
    held.current = children
  })

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setLeaving(was => (was === leaving ? null : was)), GONE)
    return () => clearTimeout(timer)
  }, [leaving])

  useEffect(() => {
    const el = inner.current
    if (fill || !el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const watching = new ResizeObserver(measure)
    watching.observe(el)
    return () => watching.disconnect()
  }, [screen, fill])

  const arriving = shown.first ? '' : shown.back ? 'animate-screen-back' : 'animate-screen'

  if (fill) {
    const layers = leaving ? [leaving, null] : [null]
    return (
      // Clipped, because a screen on its way in or out stands past the edge of
      // the box for as long as it is travelling, and the panel it is in is not
      // the end of the window.
      <div className="absolute inset-0 overflow-hidden">
        {layers.map(gone => (
          <div
            key={gone ? gone.screen : screen}
            data-screen={gone ? gone.screen : screen}
            aria-hidden={gone ? true : undefined}
            className={`absolute inset-0 [--screen-travel:24px] ${
              gone
                ? `pointer-events-none ${gone.back ? 'animate-screen-out-back' : 'animate-screen-out'}`
                : arriving
            }`}
          >
            {gone ? gone.node : children}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      style={height === null ? undefined : { height }}
      className="relative overflow-hidden transition-[height] duration-200 ease-out"
    >
      <div key={screen} ref={inner} className={arriving}>
        {children}
      </div>
    </div>
  )
}
