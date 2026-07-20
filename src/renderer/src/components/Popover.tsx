import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Popover({
  open,
  onClose,
  align = 'end',
  side = 'bottom',
  at,
  className = '',
  children
}: {
  open: boolean
  onClose: () => void
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
  at?: { x: number; y: number }
  className?: string
  children: ReactNode
}) {
  const holderRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setRect(null)
      setSize(null)
      return
    }
    if (at) {
      setRect(new DOMRect(at.x, at.y, 0, 0))
      return
    }
    const anchor = holderRef.current?.parentElement
    if (anchor) setRect(anchor.getBoundingClientRect())
  }, [open, at])

  useLayoutEffect(() => {
    const el = popRef.current
    if (rect && el) setSize({ w: el.offsetWidth, h: el.offsetHeight })
  }, [rect])

  const style = ((): CSSProperties | null => {
    if (!rect) return null
    if (!size) return { left: 0, top: 0, visibility: 'hidden' }
    if (at) {
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - size.w - 8))
      let top = rect.top
      if (top + size.h > window.innerHeight - 8) top = rect.top - size.h
      top = Math.max(8, Math.min(top, window.innerHeight - size.h - 8))
      return { left, top }
    }
    let left = align === 'start' ? rect.left : rect.right - size.w
    left = Math.max(8, Math.min(left, window.innerWidth - size.w - 8))
    let top = side === 'bottom' ? rect.bottom + 8 : rect.top - 8 - size.h
    if (side === 'bottom' && top + size.h > window.innerHeight - 8 && rect.top - 8 - size.h >= 8) {
      top = rect.top - 8 - size.h
    }
    if (side === 'top' && top < 8 && rect.bottom + 8 + size.h <= window.innerHeight - 8) {
      top = rect.bottom + 8
    }
    top = Math.max(8, Math.min(top, window.innerHeight - size.h - 8))
    return { left, top }
  })()

  useEffect(() => {
    if (!open) return
    const anchor = holderRef.current?.parentElement
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popRef.current?.contains(target)) return
      if (at || !anchor?.contains(target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onScroll = (event: Event) => {
      if (!popRef.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [open, onClose, at])

  return (
    <>
      <span ref={holderRef} className="hidden" />
      {open &&
        style &&
        createPortal(
          <div ref={popRef} style={style} className={`glass fixed z-50 rounded-2xl p-1.5 animate-pop ${className}`}>
            {children}
          </div>,
          document.body
        )}
    </>
  )
}

export function MenuItem({
  icon,
  label,
  hint,
  danger,
  onClick
}: {
  icon?: ReactNode
  label: string
  hint?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left whitespace-nowrap transition-colors ${
        danger ? 'text-danger hover:bg-danger/10' : 'text-fg-secondary hover:text-fg hover:bg-white/5'
      }`}
    >
      {icon && <span className="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-fg-muted">{hint}</span>}
    </button>
  )
}
