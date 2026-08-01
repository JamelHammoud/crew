import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const CARD_WIDTH = 240

let closeActive: (() => void) | null = null

export function hoverCardOpen(): boolean {
  return closeActive !== null
}

function within(rect: DOMRect | undefined, x: number, y: number, pad: number): boolean {
  if (!rect) return false
  return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad
}

export default function HoverCard({
  content,
  width = CARD_WIDTH,
  className = '',
  children
}: {
  content: ReactNode
  width?: number
  className?: string
  children: ReactNode
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  const hideRef = useRef<() => void>(() => {})
  const hide = useRef(() => hideRef.current()).current
  hideRef.current = () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
    if (closeActive === hide) closeActive = null
    setRect(null)
    setSize(null)
  }

  useEffect(() => {
    return () => {
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
      if (closeActive === hide) closeActive = null
    }
  }, [hide])

  useEffect(() => {
    if (!rect) return
    const onMove = (event: PointerEvent) => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const card = cardRef.current?.getBoundingClientRect()
      if (!within(anchor, event.clientX, event.clientY, 4) && !within(card, event.clientX, event.clientY, 12)) {
        hide()
      }
    }
    // The page moving under a card takes it away, and a card being read is not
    // the page: one that holds more than it can show is scrolled inside itself,
    // and a card that went down on the first turn of the wheel could never be
    // read to the end.
    const onScroll = (event: Event) => {
      const target = event.target
      if (target instanceof Node && cardRef.current?.contains(target)) return
      hide()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [rect, hide])

  useLayoutEffect(() => {
    const el = cardRef.current
    if (rect && el) setSize({ w: el.offsetWidth, h: el.offsetHeight })
  }, [rect])

  // Nothing to say is nothing to stand up. Said here rather than by whoever
  // wraps it: a caller that swaps the card out for the plain thing underneath
  // takes the thing out of the tree and puts it back, which loses whatever it
  // had measured about itself.
  const empty = content === null || content === undefined || content === false

  useEffect(() => {
    if (empty && rect) hide()
  }, [empty, rect, hide])

  const enter = () => {
    if (empty) return
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
    enterTimer.current = window.setTimeout(() => {
      const next = anchorRef.current?.getBoundingClientRect()
      if (!next) return
      if (closeActive && closeActive !== hide) closeActive()
      closeActive = hide
      setRect(next)
    }, 300)
  }

  const cancel = () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
  }

  const style = ((): CSSProperties | null => {
    if (!rect) return null
    if (!size) return { left: 0, top: 0, width, visibility: 'hidden' }
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - size.w - 8))
    let top = rect.top - 8 - size.h
    if (top < 8) top = rect.bottom + 8
    top = Math.max(8, Math.min(top, window.innerHeight - size.h - 8))
    return { left, top, width }
  })()

  return (
    <span className={`inline-block ${className}`} ref={anchorRef} onMouseEnter={enter} onMouseLeave={cancel}>
      {children}
      {style &&
        createPortal(
          <div
            ref={cardRef}
            style={style}
            className="glass app-no-drag fixed z-[70] rounded-2xl p-3 animate-pop cursor-default"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  )
}
