import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { movedBy } from './movedBy'

const CARD_WIDTH = 240

type Standing = { anchor: () => Element | null; hide: () => void }

let active: Standing | null = null

export function hoverCardIn(el: Element | null): boolean {
  const anchor = active?.anchor()
  return Boolean(el && anchor && el.contains(anchor))
}

function within(rect: DOMRect | undefined, x: number, y: number, pad: number): boolean {
  if (!rect) return false
  return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad
}

export default function HoverCard({
  content,
  width = CARD_WIDTH,
  hug,
  className = '',
  children
}: {
  content: ReactNode
  width?: number
  // A card as wide as what it holds, up to the width, rather than pinned at it.
  // A card that holds rows to line up or a picture to fill it wants the whole
  // width every time, and one that holds a face and a name is a hand's width of
  // empty glass at that size.
  hug?: boolean
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
    if (active?.hide === hide) active = null
    setRect(null)
    setSize(null)
  }

  useEffect(() => {
    return () => {
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
      if (active?.hide === hide) active = null
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
      if (movedBy(event, anchorRef.current)) hide()
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
      if (active && active.hide !== hide) active.hide()
      active = { anchor: () => anchorRef.current, hide }
      setRect(next)
    }, 300)
  }

  const cancel = () => {
    if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
  }

  const box: CSSProperties = hug ? { width: 'max-content', maxWidth: width } : { width }

  const style = ((): CSSProperties | null => {
    if (!rect) return null
    if (!size) return { left: 0, top: 0, ...box, visibility: 'hidden' }
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - size.w - 8))
    let top = rect.top - 8 - size.h
    if (top < 8) top = rect.bottom + 8
    top = Math.max(8, Math.min(top, window.innerHeight - size.h - 8))
    return { left, top, ...box }
  })()

  return (
    <span
      className={`inline-block ${className}`}
      ref={anchorRef}
      onMouseEnter={enter}
      onMouseLeave={cancel}
      onPointerDown={hide}
    >
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
