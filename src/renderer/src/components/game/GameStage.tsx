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

// Every game stands on the same field, whatever shape its own world is, so the
// panel looks the same from one game to the next and the side panel is filled
// rather than nearly filled. It is the shape of the room the panel leaves: the
// width it has, against the height under the tab bar and the one line of chrome
// over the field. A game whose world is another shape is centered in it, which
// is what a well with a surround around it already looks like.
export const FIELD_RATIO = 2 / 3

type Box = { width: number; height: number }

// The field keeps its own shape whatever the panel is doing, so it is measured
// rather than left to the box around it: a canvas told to fill a box it does not
// have the shape of comes out stretched, and the game is drawn in world units.
function useBox(ref: RefObject<HTMLDivElement | null>): Box {
  const [box, setBox] = useState<Box>({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const watch = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }))
    watch.observe(el)
    setBox({ width: el.clientWidth, height: el.clientHeight })
    return () => watch.disconnect()
  }, [ref])
  return box
}

export function Field({
  onKeyDown,
  onPress,
  onSize,
  overlay,
  children
}: {
  onKeyDown: (key: string) => void
  onPress: () => void
  // The field is only as big as the panel left it, and it lands at nothing on
  // the first render and at its real size a beat later. A game that is not
  // running has no loop to repaint it, so it is told when the size changed and
  // paints again: without this the board keeps the one pixel it was drawn at
  // and is stretched over the whole field.
  onSize: (width: number) => void
  overlay?: ReactNode
  children: ReactNode
}) {
  const outer = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const box = useBox(outer)

  // A game is played with the keyboard, so the field takes focus as it arrives
  // rather than waiting for somebody to work out that it wants a click first.
  useEffect(() => {
    stage.current?.focus({ preventScroll: true })
  }, [])

  const width = Math.min(box.width, box.height * FIELD_RATIO)
  const height = width / FIELD_RATIO

  useEffect(() => {
    onSize(width)
  }, [width, onSize])

  const key = (event: ReactKeyboardEvent) => {
    if (PLAYED.has(event.key)) event.preventDefault()
    onKeyDown(event.key)
  }

  return (
    <div ref={outer} className="relative flex-1 min-h-0 w-full">
      <div
        className="absolute"
        style={{
          width,
          height,
          left: (box.width - width) / 2,
          top: (box.height - height) / 2
        }}
      >
        <div
          ref={stage}
          tabIndex={0}
          onKeyDown={key}
          onPointerDown={onPress}
          className="relative w-full h-full rounded-card overflow-hidden outline-none cursor-pointer"
          style={{ background: FIELD }}
        >
          {children}
          {/* Drawn inside the field rather than around it, since the field is
              artwork and a ring outside it is cropped by the card it sits in. */}
          <InsetRing className="ring-1 ring-inset ring-white/10" />
          {overlay}
        </div>
      </div>
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
