import { useCallback, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useBox } from './useBox'

export interface Spot {
  x: number
  y: number
}

const KEY = 'crew.huddle.dock'
const MARGIN = 16
// Only used for the first frame, before the dock has been measured. It is on
// the small side on purpose: too small corrects itself once the real size
// arrives, too large leaves the dock floating short of the corner.
const FALLBACK = { w: 320, h: 160 }

function clamp(spot: Spot, size: { w: number; h: number }): Spot {
  return {
    x: Math.max(MARGIN, Math.min(spot.x, window.innerWidth - size.w - MARGIN)),
    y: Math.max(MARGIN, Math.min(spot.y, window.innerHeight - size.h - MARGIN))
  }
}

function stored(): Spot | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

// The dock stays where it was put, and follows the window back inside when the
// window shrinks under it.
export function useDockPosition(): {
  spot: Spot
  dragging: boolean
  onGrab: (event: ReactPointerEvent) => void
  attach: (node: HTMLDivElement | null) => void
} {
  const [attach, box] = useBox()
  const size = { w: box.width || FALLBACK.w, h: box.height || FALLBACK.h }
  const [spot, setSpot] = useState<Spot>(
    () => stored() ?? { x: MARGIN, y: Math.max(MARGIN, window.innerHeight - size.h - MARGIN) }
  )
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const fit = () => setSpot(current => clamp(current, size))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [size.w, size.h])

  const onGrab = useCallback(
    (event: ReactPointerEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      setDragging(true)
      const start = { x: event.clientX, y: event.clientY }
      const from = spot
      const move = (e: PointerEvent) =>
        setSpot(clamp({ x: from.x + e.clientX - start.x, y: from.y + e.clientY - start.y }, size))
      const done = () => {
        setDragging(false)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', done)
        setSpot(current => {
          try {
            globalThis.localStorage?.setItem(KEY, JSON.stringify(current))
          } catch {
            return current
          }
          return current
        })
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', done)
    },
    [spot, size.w, size.h]
  )

  return { spot, dragging, onGrab, attach }
}
