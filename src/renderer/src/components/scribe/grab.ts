import type { PointerEvent as Pressed } from 'react'

// Taking hold of the pill and putting it somewhere else. The window is what
// moves, so a drag is a distance handed to main rather than anything this page
// does to itself.
//
// It is measured against the screen and never against the window, because the
// window travels under the pointer the whole time it is being dragged. Read the
// other way round, every frame would move the pill by however far it had
// already moved, and it would run off the edge of the screen on its own.
export function grab(event: Pressed<HTMLElement>): void {
  if (event.button !== 0) return
  const box = event.currentTarget
  const from = { x: event.screenX, y: event.screenY }
  window.crew.grabScribe()
  box.setPointerCapture(event.pointerId)

  const move = (moved: PointerEvent) =>
    window.crew.moveScribe(moved.screenX - from.x, moved.screenY - from.y, false)

  // A drag that is let go of and one the system takes away both settle where
  // the pill stands, so a gesture interrupted by anything at all still leaves
  // it somewhere it will be found again.
  const settle = (last: PointerEvent) => {
    window.crew.moveScribe(last.screenX - from.x, last.screenY - from.y, true)
    box.removeEventListener('pointermove', move)
    box.removeEventListener('pointerup', settle)
    box.removeEventListener('pointercancel', settle)
  }

  box.addEventListener('pointermove', move)
  box.addEventListener('pointerup', settle)
  box.addEventListener('pointercancel', settle)
}
