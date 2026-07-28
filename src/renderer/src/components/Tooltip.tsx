import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// A tooltip that is a line of text is a line of text: it never wraps and wears
// the padding of a pill. One handed something drawn instead is a small card,
// with a width to wrap inside, so the two never have to fight over a class.
export default function Tooltip({
  label,
  disabled,
  className,
  children
}: {
  label: ReactNode
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
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

  useEffect(() => {
    if (disabled) hide()
  }, [disabled])

  const enter = () => {
    if (disabled) return
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
    // Flex rather than inline-block: an inline box keeps a line of its own, and
    // the few pixels a descender leaves under a button push it off center in
    // every row it stands in.
    <span
      className={`inline-flex ${className ?? ''}`}
      ref={anchorRef}
      onMouseEnter={enter}
      onMouseLeave={hide}
    >
      {children}
      {!disabled &&
        style &&
        createPortal(
          <span
            ref={tipRef}
            style={style}
            className={`glass fixed z-[70] block animate-pop pointer-events-none ${
              typeof label === 'string'
                ? 'rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-secondary whitespace-nowrap'
                : 'rounded-2xl p-2.5 max-w-[280px]'
            }`}
          >
            {label}
          </span>,
          document.body
        )}
    </span>
  )
}
