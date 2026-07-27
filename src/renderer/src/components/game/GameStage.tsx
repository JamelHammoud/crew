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
  ratio,
  onKeyDown,
  onPress,
  overlay,
  children
}: {
  ratio: number
  onKeyDown: (key: string) => void
  onPress: () => void
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

  const width = Math.min(box.width, box.height * ratio)
  const height = width / ratio

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

// What stands over the field before a game and after one. It is the whole field
// rather than a card in the middle of it, so the one thing to press is wherever
// the pointer already is.
export function Overlay({
  title,
  note,
  label,
  onStart
}: {
  title: string
  note?: string
  label: string
  onStart: () => void
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-[3px]">
      <div className="flex flex-col items-center gap-1 animate-rise">
        <span className="text-base font-semibold text-white">{title}</span>
        {note && <span className="text-xs text-white/55">{note}</span>}
      </div>
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
