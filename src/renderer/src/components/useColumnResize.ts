import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const AGAIN_WITHIN = 400
const STILL_WITHIN = 3

export function useColumnResize(width: number, onWidth: (width: number) => void, onReset: () => void) {
  const [dragging, setDragging] = useState(false)
  const lastRelease = useRef(0)

  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault()
    if (event.timeStamp - lastRelease.current < AGAIN_WITHIN) {
      lastRelease.current = 0
      onReset()
      return
    }
    setDragging(true)
    const startX = event.clientX
    const startWidth = width
    let moved = false
    const move = (next: PointerEvent) => {
      if (Math.abs(next.clientX - startX) > STILL_WITHIN) moved = true
      onWidth(startWidth + startX - next.clientX)
    }
    const stop = (next: PointerEvent) => {
      setDragging(false)
      lastRelease.current = moved ? 0 : next.timeStamp
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  return { dragging, startResize }
}
