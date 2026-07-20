import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export default function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  const hide = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setRect(null)
    setSize(null)
  }

  useEffect(() => {
    if (!rect) return
    window.addEventListener('scroll', hide, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', hide, { capture: true })
  }, [rect])

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  useLayoutEffect(() => {
    const el = tipRef.current
    if (rect && el) setSize({ w: el.offsetWidth, h: el.offsetHeight })
  }, [rect])

  const enter = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const next = anchorRef.current?.getBoundingClientRect()
      if (next) setRect(next)
    }, 300)
  }

  const style = ((): CSSProperties | null => {
    if (!rect) return null
    if (!size) return { left: 0, top: 0, visibility: 'hidden' }
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - size.w / 2, window.innerWidth - size.w - 8))
    let top = rect.top - 6 - size.h
    if (top < 8) top = rect.bottom + 6
    return { left, top }
  })()

  return (
    <span className="inline-block" ref={anchorRef} onMouseEnter={enter} onMouseLeave={hide}>
      {children}
      {style &&
        createPortal(
          <span
            ref={tipRef}
            style={style}
            className="glass fixed z-50 block rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-secondary whitespace-nowrap animate-pop pointer-events-none"
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  )
}
