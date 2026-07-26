import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { FIT, panBy, pinchFactor, settle, zoomBy, zoomPercent, type Point, type View } from './imageZoom'
import Tooltip from './Tooltip'

const DOUBLE_CLICK_SCALE = 2.5
const PIXELATED_AT = 3

export default function ImageView({ src, alt }: { src: string; alt: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const held = useRef<Point | null>(null)
  const [view, setView] = useState<View>(FIT)
  const [ratio, setRatio] = useState(1)
  const [dragging, setDragging] = useState(false)

  const measure = () => {
    const frame = frameRef.current
    const image = imageRef.current
    if (!frame || !image) return null
    return {
      image: { width: image.offsetWidth, height: image.offsetHeight },
      frame: { width: frame.clientWidth, height: frame.clientHeight }
    }
  }

  const fitRatio = () => {
    const image = imageRef.current
    return image?.naturalWidth ? image.offsetWidth / image.naturalWidth : 1
  }

  const from = (event: { clientX: number; clientY: number }): Point => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    return { x: event.clientX - (box.left + box.width / 2), y: event.clientY - (box.top + box.height / 2) }
  }

  useEffect(() => {
    setView(FIT)
  }, [src])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      const sizes = measure()
      if (!sizes) return
      event.preventDefault()
      const at = from(event)
      setView(current =>
        event.ctrlKey
          ? zoomBy(current, pinchFactor(event.deltaY), at, sizes.image, sizes.frame)
          : panBy(current, event.deltaX, event.deltaY, sizes.image, sizes.frame)
      )
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const sizes = measure()
      if (!sizes) return
      setRatio(fitRatio())
      setView(current => settle(current, sizes.image, sizes.frame))
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (view.scale === 1 || event.button !== 0) return
    held.current = { x: event.clientX, y: event.clientY }
    setDragging(true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const last = held.current
    const sizes = measure()
    if (!last || !sizes) return
    setView(current => panBy(current, last.x - event.clientX, last.y - event.clientY, sizes.image, sizes.frame))
    held.current = { x: event.clientX, y: event.clientY }
  }

  const onPointerUp = () => {
    held.current = null
    setDragging(false)
  }

  const onDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const sizes = measure()
    if (!sizes) return
    setView(current =>
      current.scale > 1 ? FIT : zoomBy(current, DOUBLE_CLICK_SCALE, from(event), sizes.image, sizes.frame)
    )
  }

  const zoomed = view.scale > 1

  return (
    <div
      ref={frameRef}
      data-image-frame
      className={`absolute inset-0 overflow-hidden flex items-center justify-center p-6 touch-none ${zoomed ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setRatio(fitRatio())}
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          imageRendering: view.scale * ratio >= PIXELATED_AT ? 'pixelated' : undefined
        }}
        className={`max-w-full max-h-full object-contain animate-rise select-none ${zoomed ? '' : 'rounded-card'}`}
      />
      {zoomed && (
        <Tooltip label="Reset">
          <button
            onClick={() => setView(FIT)}
            className="glass animate-pop absolute bottom-4 right-4 h-8 px-3 rounded-full text-xs tabular-nums text-fg-secondary transition-all duration-150 hover:text-fg active:scale-95"
          >
            {zoomPercent(view.scale, ratio)}%
          </button>
        </Tooltip>
      )}
    </div>
  )
}
