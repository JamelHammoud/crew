import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { TrashGlyph } from '../icons'

const ACTION_WIDTH = 64
const DIRECTION_SLOP = 6
const OPEN_AT = ACTION_WIDTH / 2
const FLICK_SPEED = 0.35
const WHEEL_SETTLE = 120

interface Drag {
  axis: 'pending' | 'horizontal'
  fromOffset: number
  fromX: number
  fromY: number
  lastOffset: number
  lastTime: number
  speed: number
}

export interface SwipeActionRowProps {
  children: ReactNode
  className?: string
  onDelete: () => void
}

function clamp(value: number): number {
  return Math.min(ACTION_WIDTH, Math.max(0, value))
}

export default function SwipeActionRow({ children, className = '', onDelete }: SwipeActionRowProps) {
  const [offset, setOffset] = useState(0)
  const [moving, setMoving] = useState(false)
  const offsetRef = useRef(0)
  const rowRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ignoreClick = useRef(false)
  const wheelHandler = useRef<(event: WheelEvent) => void>(() => {})

  const moveTo = (next: number) => {
    const value = clamp(next)
    offsetRef.current = value
    setOffset(value)
  }

  const settle = (open: boolean) => {
    setMoving(false)
    moveTo(open ? ACTION_WIDTH : 0)
  }

  const stopWheelTimer = () => {
    if (wheelTimer.current === null) return
    clearTimeout(wheelTimer.current)
    wheelTimer.current = null
  }

  const suppressNextClick = () => {
    ignoreClick.current = true
    if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      ignoreClick.current = false
      clickTimer.current = null
    }, 0)
  }

  useEffect(() => {
    const row = rowRef.current
    const onWheel = (event: WheelEvent) => wheelHandler.current(event)
    row?.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      row?.removeEventListener('wheel', onWheel)
      stopWheelTimer()
      if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    }
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    stopWheelTimer()
    drag.current = {
      axis: 'pending',
      fromOffset: offsetRef.current,
      fromX: event.clientX,
      fromY: event.clientY,
      lastOffset: offsetRef.current,
      lastTime: performance.now(),
      speed: 0
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const held = drag.current
    if (!held) return
    const x = event.clientX - held.fromX
    const y = event.clientY - held.fromY
    if (held.axis === 'pending') {
      if (Math.max(Math.abs(x), Math.abs(y)) < DIRECTION_SLOP) return
      if (Math.abs(y) > Math.abs(x)) {
        drag.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
        return
      }
      held.axis = 'horizontal'
      setMoving(true)
    }
    event.preventDefault()
    const next = clamp(held.fromOffset - x)
    const now = performance.now()
    const elapsed = now - held.lastTime
    if (elapsed > 0) held.speed = (next - held.lastOffset) / elapsed
    held.lastOffset = next
    held.lastTime = now
    moveTo(next)
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const held = drag.current
    if (!held) return
    drag.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (held.axis !== 'horizontal') return
    suppressNextClick()
    if (cancelled) return settle(held.fromOffset >= OPEN_AT)
    if (Math.abs(held.speed) > FLICK_SPEED) return settle(held.speed > 0)
    settle(offsetRef.current >= OPEN_AT)
  }

  wheelHandler.current = event => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || event.deltaX === 0) return
    event.preventDefault()
    stopWheelTimer()
    setMoving(true)
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? ACTION_WIDTH : 1
    moveTo(offsetRef.current + event.deltaX * unit)
    wheelTimer.current = setTimeout(() => {
      wheelTimer.current = null
      settle(offsetRef.current >= OPEN_AT)
    }, WHEEL_SETTLE)
  }

  const deleteRow = () => {
    settle(false)
    onDelete()
  }

  return (
    <div
      ref={rowRef}
      data-swipe-action-row=""
      data-open={offset === ACTION_WIDTH ? '' : undefined}
      data-offset={Math.round(offset)}
      className={`relative overflow-hidden ${className}`}
      onKeyDown={event => {
        if (event.key !== 'Escape' || offsetRef.current === 0) return
        event.preventDefault()
        settle(false)
      }}
    >
      <button
        type="button"
        aria-label="Delete"
        onFocus={() => settle(true)}
        onClick={deleteRow}
        className="absolute inset-y-0 right-0 flex w-16 items-center justify-center bg-danger/15 text-danger transition-colors duration-150 hover:bg-danger/25 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-danger/40"
      >
        <TrashGlyph className="h-4 w-4" />
      </button>
      <div
        data-swipe-surface=""
        data-moving={moving ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={event => finishPointer(event, false)}
        onPointerCancel={event => finishPointer(event, true)}
        onClickCapture={event => {
          if (!ignoreClick.current) return
          event.preventDefault()
          event.stopPropagation()
          ignoreClick.current = false
        }}
        className={`relative z-10 min-w-0 bg-inherit ${moving ? '' : 'transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]'}`}
        style={{ touchAction: 'pan-y', transform: `translateX(${-offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}
