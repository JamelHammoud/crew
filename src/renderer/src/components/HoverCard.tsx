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

export default function HoverCard({ content, children }: { content: ReactNode; children: ReactNode }) {
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
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', hide, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', hide, { capture: true })
    }
  }, [rect, hide])

  useLayoutEffect(() => {
    const el = cardRef.current
    if (rect && el) setSize({ w: el.offsetWidth, h: el.offsetHeight })
  }, [rect])

  const enter = () => {
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
    if (!size) return { left: 0, top: 0, width: CARD_WIDTH, visibility: 'hidden' }
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - size.w - 8))
    let top = rect.top - 8 - size.h
    if (top < 8) top = rect.bottom + 8
    top = Math.max(8, Math.min(top, window.innerHeight - size.h - 8))
    return { left, top, width: CARD_WIDTH }
  })()

  return (
    <span className="inline-block" ref={anchorRef} onMouseEnter={enter} onMouseLeave={cancel}>
      {children}
      {style &&
        createPortal(
          <div ref={cardRef} style={style} className="glass fixed z-50 rounded-2xl p-3 animate-pop cursor-default">
            {content}
          </div>,
          document.body
        )}
    </span>
  )
}
