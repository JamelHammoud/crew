import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject
} from 'react'
import InsetRing from '../InsetRing'
import { FIELD } from './paint'

// The keys the game is played with. They are taken off the page while the field
// has focus, or the arrows scroll the panel out from under whoever is playing.
const PLAYED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'])

export type Box = { width: number; height: number }

const SAME = (box: Box, width: number, height: number): boolean => box.width === width && box.height === height

// The field is the room the panel leaves, so it is measured rather than guessed
// at: a game is drawn in world units and has to be told the size it is really
// standing at. Nothing here changes unless the numbers do, so a game repaints
// when the panel is dragged and at no other time.
function useBox(ref: RefObject<HTMLDivElement | null>): Box {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = (): void => {
      const width = el.clientWidth
      const height = el.clientHeight
      setBox(old => (SAME(old, width, height) ? old : { width, height }))
    }
    const watch = new ResizeObserver(read)
    watch.observe(el)
    read()
    return () => watch.disconnect()
  }, [ref])
  return box
}

// Every game takes the whole of the room the panel leaves. A world with a shape
// of its own is centered in it and sinks its own well into the field, which is
// what Tetris does; one that scrolls takes the room as its width, which is what
// Flappy does. Pinning the field itself to one shape is what left a band of dead
// panel over and under it, and no shape can fill a panel anyone can drag.
export function Field({
  onKeyDown,
  onPress,
  onSize,
  overlay,
  children
}: {
  onKeyDown: (key: string) => void
  onPress: () => void
  // The field lands at nothing on the first render and at its real size a beat
  // later, and a game that is not running has no loop to paint it again. So it
  // is told the size it has: without this the board keeps the one pixel it was
  // first drawn at and is stretched over the whole field.
  onSize: (box: Box) => void
  overlay?: ReactNode
  children: ReactNode
}) {
  const stage = useRef<HTMLDivElement>(null)
  const box = useBox(stage)

  // A game is played with the keyboard, so the field takes focus as it arrives
  // rather than waiting for somebody to work out that it wants a click first.
  useEffect(() => {
    stage.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    onSize(box)
  }, [box, onSize])

  const key = (event: ReactKeyboardEvent) => {
    if (PLAYED.has(event.key)) event.preventDefault()
    onKeyDown(event.key)
  }

  return (
    <div
      ref={stage}
      tabIndex={0}
      onKeyDown={key}
      onPointerDown={onPress}
      className="relative flex-1 min-h-0 w-full rounded-card overflow-hidden outline-none cursor-pointer"
      style={{ background: FIELD }}
    >
      {children}
      {/* Drawn inside the field rather than around it, since the field is
          artwork and a ring outside it is cropped by the card it sits in. */}
      <InsetRing className="ring-1 ring-inset ring-white/10" />
      {overlay}
    </div>
  )
}

// What stands over the field before a game and after one: what just happened,
// where that leaves everyone, and the one thing to press. It holds the board
// rather than the panel under the field holding it, so the field is the same
// size whether a game is running or not and nothing moves when one starts.
export function Overlay({
  title,
  note,
  label,
  onStart,
  children
}: {
  title?: string
  note?: string
  label: string
  onStart: () => void
  children?: ReactNode
}) {
  return (
    <div className="absolute inset-0 px-5 flex flex-col items-center justify-center gap-5 overflow-hidden bg-black/55 backdrop-blur-[3px]">
      {(title || note) && (
        <div className="flex flex-col items-center gap-1 animate-rise">
          {title && <span className="text-base font-semibold text-white">{title}</span>}
          {note && <span className="text-xs text-white/55">{note}</span>}
        </div>
      )}
      {children}
      <button
        onClick={onStart}
        onPointerDown={event => event.stopPropagation()}
        onMouseDown={event => event.preventDefault()}
        className="h-9 px-5 rounded-full bg-white text-sm font-semibold text-[#141a2b] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
      >
        {label}
      </button>
    </div>
  )
}
