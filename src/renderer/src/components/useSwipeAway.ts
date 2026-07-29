import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

// Pushing something out of the way to the right. It follows the pointer while it
// is held, and on letting go it either carries on and goes or springs back to
// where it was. A gesture that travelled is not a press, so whatever it was
// dragged from asks `moved` before it treats the click as one.
const SLOP = 6
const AWAY = 88
const FLICK = 0.45
const CLEAR = 40
const SAMPLE = 30

export interface SwipeAway {
  props: {
    style: CSSProperties
    'data-swiping'?: string
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onPointerMove: (event: PointerEvent<HTMLElement>) => void
    onPointerUp: (event: PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  }
  moved: () => boolean
}

// How fast it is going is read over a window rather than off the last move. Two
// events can land in the same fraction of a millisecond, and a few pixels over
// nearly no time at all is a speed no hand ever moved at.
interface Grab {
  from: number
  x: number
  speed: number
  mark: { x: number; at: number }
}

export function useSwipeAway(onAway: () => void): SwipeAway {
  const [x, setX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const grab = useRef<Grab | null>(null)
  const moved = useRef(false)
  const gone = useRef(false)

  // Far enough, or fast enough however far it got. A flick is how somebody
  // brushes one of these aside, and it lands well short of the distance.
  const end = (event: PointerEvent<HTMLElement>): void => {
    const held = grab.current
    if (!held) return
    grab.current = null
    setSwiping(false)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (held.x < AWAY && !(held.x > SLOP && held.speed > FLICK)) return setX(0)
    gone.current = true
    setX(held.x + event.currentTarget.offsetWidth + CLEAR)
    onAway()
  }

  return {
    moved: () => moved.current,
    props: {
      style: {
        transform: `translateX(${x}px)`,
        opacity: gone.current ? 0 : 1 - Math.min(x / (AWAY * 3), 0.5)
      },
      'data-swiping': swiping ? '' : undefined,
      onPointerDown: event => {
        if (event.button !== 0) return
        moved.current = false
        grab.current = { from: event.clientX, x: 0, speed: 0, mark: { x: 0, at: performance.now() } }
        setSwiping(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
      },
      onPointerMove: event => {
        const held = grab.current
        if (!held) return
        const travelled = event.clientX - held.from
        if (!moved.current && Math.abs(travelled) < SLOP) return
        moved.current = true
        // It only goes one way, so pulling the other way holds it where it is
        // rather than dragging it under whatever it stands beside.
        const next = Math.max(0, travelled)
        const at = performance.now()
        held.x = next
        if (at - held.mark.at >= SAMPLE) {
          held.speed = (next - held.mark.x) / (at - held.mark.at)
          held.mark = { x: next, at }
        }
        setX(next)
      },
      onPointerUp: end,
      onPointerCancel: end
    }
  }
}
