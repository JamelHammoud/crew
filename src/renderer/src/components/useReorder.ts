import { useRef, type PointerEvent as Press } from 'react'
import { landing, shift, type Box } from './reorder'

// How far the pointer travels before the row believes it is a drag rather than a
// press, so a plain click still lands on whatever it was aimed at.
const TAKES = 4
// A row that scrolls carries itself along while something is held near either end
// of it, or the far end is somewhere nothing can be dropped.
const EDGE = 56
const STEP = 12
const SLIDE = 'translate 150ms cubic-bezier(0.4, 0, 0.2, 1)'

export type Reorder = {
  ref: (node: HTMLElement | null) => void
  take(id: string): (event: Press) => void
  dragged(): boolean
}

type Axis = 'horizontal' | 'vertical'

// Dragging one of a row of things into another place in it. Where each one goes
// is written straight onto the elements rather than held in state, the way the
// music's bars are: it runs every frame, and a render a frame would cost
// everything standing beside the row. Nothing is reordered until it is let go,
// so the row under the pointer stands still while it is being aimed at.
export function useReorder(onMove: (id: string, to: number) => void, axis: Axis = 'horizontal'): Reorder {
  const row = useRef<HTMLElement | null>(null)
  const dragged = useRef(false)

  const take = (id: string) => (event: Press) => {
    const strip = row.current
    if (event.button !== 0 || !strip) return
    const bar = strip.getBoundingClientRect()
    const items = Array.from(strip.querySelectorAll<HTMLElement>('[data-reorder]'))
    const from = items.findIndex(item => item.dataset.reorder === id)
    const held = items[from]
    if (!held || items.length < 2) return

    // Boxes are read in the row's own coordinates rather than the window's, so a
    // row that scrolls under a drag does not put every one of them out.
    const vertical = axis === 'vertical'
    const scroll = () => (vertical ? strip.scrollTop : strip.scrollLeft)
    const start = vertical ? bar.top : bar.left
    const length = vertical ? bar.height : bar.width
    const coordinate = (point: PointerEvent | Press) => (vertical ? point.clientY : point.clientX)
    const boxes: Box[] = items.map(item => {
      const box = item.getBoundingClientRect()
      return vertical
        ? { left: box.top - bar.top + strip.scrollTop, width: box.height }
        : { left: box.left - bar.left + strip.scrollLeft, width: box.width }
    })
    const startAt = coordinate(event) - start + scroll()

    let pointer = coordinate(event)
    let taken = false
    let to = from
    let frame = 0
    dragged.current = false

    const tick = () => {
      const dx = pointer - start + scroll() - startAt
      if (!taken && Math.abs(dx) < TAKES) return
      taken = true
      dragged.current = true
      held.style.translate = vertical ? `0 ${dx}px` : `${dx}px`
      held.style.zIndex = '10'
      held.style.cursor = 'grabbing'
      const next = landing(boxes, from, dx)
      if (next === to) return
      to = next
      items.forEach((item, index) => {
        if (index === from) return
        item.style.transition = SLIDE
        const distance = shift(boxes, from, to, index)
        item.style.translate = vertical ? `0 ${distance}px` : `${distance}px`
      })
    }

    // The pointer standing still near an end still carries the row along, so the
    // reading happens on a frame of its own as well as on every move.
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const past = pointer - start
      if (past < EDGE) {
        if (vertical) strip.scrollTop -= STEP
        else strip.scrollLeft -= STEP
      } else if (past > length - EDGE) {
        if (vertical) strip.scrollTop += STEP
        else strip.scrollLeft += STEP
      }
      tick()
    }

    const move = (moved: PointerEvent) => {
      pointer = coordinate(moved)
      tick()
    }

    // Everything the drag wrote is taken off before the row is reordered, and
    // the transition goes with it, or the one that was let go slides in from a
    // slot it has already left.
    const stop = (keep: boolean) => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', key)
      items.forEach(item => {
        item.style.translate = ''
        item.style.transition = ''
        item.style.zIndex = ''
        item.style.cursor = ''
      })
      if (keep && to !== from) onMove(id, to)
    }

    const up = () => stop(true)
    const cancel = () => stop(false)
    const key = (pressed: KeyboardEvent) => {
      if (pressed.key === 'Escape') stop(false)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
    frame = requestAnimationFrame(draw)
  }

  return {
    ref: node => {
      row.current = node
    },
    take,
    dragged: () => dragged.current
  }
}
