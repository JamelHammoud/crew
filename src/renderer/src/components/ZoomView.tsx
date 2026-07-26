import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import Tooltip from './Tooltip'
import { FIT, panBy, pinchFactor, settle, zoomBy, zoomPercent, type Box, type Point, type View } from './zoom'

const DOUBLE_CLICK_SCALE = 2.5

export interface Drawn {
  box: Box
  natural: number
}

export interface Zoom {
  scale: number
  ratio: number
}

export default function ZoomView({
  content,
  refit,
  className = '',
  children
}: {
  content: (frame: Box) => Drawn | null
  refit?: unknown
  className?: string
  children: ReactNode | ((zoom: Zoom) => ReactNode)
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const held = useRef<Point | null>(null)
  const read = useRef(content)
  const [view, setView] = useState<View>(FIT)
  const [ratio, setRatio] = useState(1)
  const [dragging, setDragging] = useState(false)

  const sizes = useCallback((): { drawn: Box; frame: Box; natural: number } | null => {
    const el = frameRef.current
    if (!el) return null
    const frame = { width: el.clientWidth, height: el.clientHeight }
    const drawn = read.current(frame)
    return drawn ? { drawn: drawn.box, frame, natural: drawn.natural } : null
  }, [])

  const remeasure = useCallback(() => {
    const now = sizes()
    if (!now) return
    setRatio(now.natural ? now.drawn.width / now.natural : 1)
    setView(current => settle(current, now.drawn, now.frame))
  }, [sizes])

  const from = (event: { clientX: number; clientY: number }): Point => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    return { x: event.clientX - (box.left + box.width / 2), y: event.clientY - (box.top + box.height / 2) }
  }

  useEffect(() => {
    setView(FIT)
  }, [refit])

  useEffect(() => {
    read.current = content
    remeasure()
  }, [content, remeasure])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      const now = sizes()
      if (!now) return
      event.preventDefault()
      const at = from(event)
      setView(current =>
        event.ctrlKey
          ? zoomBy(current, pinchFactor(event.deltaY), at, now.drawn, now.frame)
          : panBy(current, event.deltaX, event.deltaY, now.drawn, now.frame)
      )
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [sizes])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(remeasure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [remeasure])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (view.scale === 1 || event.button !== 0) return
    held.current = { x: event.clientX, y: event.clientY }
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const last = held.current
    const now = sizes()
    if (!last || !now) return
    setView(current => panBy(current, last.x - event.clientX, last.y - event.clientY, now.drawn, now.frame))
    held.current = { x: event.clientX, y: event.clientY }
  }

  const onPointerUp = () => {
    held.current = null
    setDragging(false)
  }

  const onDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = sizes()
    if (!now) return
    setView(current =>
      current.scale > 1 ? FIT : zoomBy(current, DOUBLE_CLICK_SCALE, from(event), now.drawn, now.frame)
    )
  }

  const zoomed = view.scale > 1

  return (
    <div
      ref={frameRef}
      data-zoom-frame
      className={`relative overflow-hidden flex items-center justify-center touch-none ${
        zoomed ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
      } ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        data-zoom-content
        className="w-full h-full flex items-center justify-center"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
      >
        {typeof children === 'function' ? children({ scale: view.scale, ratio }) : children}
      </div>
      {zoomed && (
        <Tooltip label="Reset" className="absolute bottom-4 right-4">
          <button
            onClick={() => setView(FIT)}
            className="glass animate-pop h-8 px-3 rounded-full text-xs tabular-nums text-fg/70 transition-all duration-150 hover:text-fg active:scale-95"
          >
            {zoomPercent(view.scale, ratio)}%
          </button>
        </Tooltip>
      )}
    </div>
  )
}
