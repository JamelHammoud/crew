import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { clampSplit, DIFF_MIN, LIST_MIN } from './split'

// What one press of an arrow is worth. A row of the list, so a press moves the
// boundary by a whole file rather than by a pixel nobody can see.
const STEP = 28

// Where the two panes meet. It is taken hold of and worked from where it was
// grabbed rather than from wherever the pointer is now, the way the Scribe pill
// is dragged: read the other way round, the divider travels under the pointer
// every frame and runs off the bottom of the panel on its own.
export default function SplitGrip({
  height,
  total,
  onHeight,
  onSettle
}: {
  height: number
  total: number
  onHeight: (height: number) => void
  onSettle: (height: number) => void
}) {
  const from = useRef<{ y: number; height: number } | null>(null)
  const last = useRef(height)

  const down = (event: PointerEvent<HTMLDivElement>) => {
    from.current = { y: event.clientY, height }
    last.current = height
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const held = from.current
    if (!held) return
    const next = clampSplit(held.height + (event.clientY - held.y), total)
    last.current = next
    onHeight(next)
  }

  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (!from.current) return
    from.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    onSettle(last.current)
  }

  return (
    <div
      role="separator"
      aria-label="Drag to resize"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="group/grip relative h-2 shrink-0 cursor-row-resize select-none"
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-ink-700 transition-colors group-hover/grip:bg-fg/25" />
    </div>
  )
}
