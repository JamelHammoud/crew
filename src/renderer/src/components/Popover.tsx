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
  const placedRef = useRef<'top' | 'bottom' | null>(null)
  const sizeRef = useRef<{ w: number; h: number } | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setRect(null)
      setSize(null)
      sizeRef.current = null
      placedRef.current = null
      return
    }
    if (at) {
      setRect(new DOMRect(at.x, at.y, 0, 0))
      return
    }
    const anchor = holderRef.current?.parentElement
    if (anchor) setRect(anchor.getBoundingClientRect())
  }, [open, at])

  const measure = (): void => {
    const el = popRef.current
    if (!el) return
    const last = sizeRef.current
    if (last && last.w === el.offsetWidth && last.h === el.offsetHeight) return
    sizeRef.current = { w: el.offsetWidth, h: el.offsetHeight }
    setSize(sizeRef.current)
  }

  useLayoutEffect(() => {
    if (rect) measure()
  })

  useLayoutEffect(() => {
    const el = popRef.current
    if (!rect || !el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
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
    const fits = (choice: 'top' | 'bottom') =>
      choice === 'bottom' ? rect.bottom + 8 + size.h <= window.innerHeight - 8 : rect.top - 8 - size.h >= 8
    const other = side === 'bottom' ? 'top' : 'bottom'
    const placed = placedRef.current ?? (fits(side) || !fits(other) ? side : other)
    placedRef.current = placed
    let top = placed === 'bottom' ? rect.bottom + 8 : rect.top - 8 - size.h
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

export function MenuDivider() {
  return <div className="h-px bg-fg/[0.06] my-1 -mx-1.5" />
}

export function MenuItem({
  icon,
  label,
  hint,
  danger,
  active,
  onClick,
  onHover
}: {
  icon?: ReactNode
  label: string
  hint?: string
  danger?: boolean
  active?: boolean
  onClick: () => void
  onHover?: () => void
}) {
  return (
    <button
      onClick={onClick}
      onPointerEnter={onHover}
      data-active={active ? '' : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left whitespace-nowrap transition-colors ${
        danger
          ? 'text-danger hover:bg-danger/10 data-active:bg-danger/10'
          : 'text-fg/70 hover:text-fg hover:bg-fg/5 data-active:text-fg data-active:bg-fg/5'
      }`}
    >
      {icon && <span className="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      <span className="flex-1">{label}</span>
      {hint && <span className="text-xs text-fg/40 tabular-nums">{hint}</span>}
    </button>
  )
}

// A row that opens a second panel beside it, the way a menu nests in Figma.
export function SubMenu({
  icon,
  label,
  children
}: {
  icon?: ReactNode
  label: string
  children: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  const show = () => {
    const rect = rowRef.current?.getBoundingClientRect()
    if (!rect) return
    setAt({ x: rect.right + 6, y: rect.top - 6 })
    setOpen(true)
  }

  return (
    <div ref={rowRef} onPointerEnter={show} onPointerLeave={() => setOpen(false)} className="relative">
      <div
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
          open ? 'text-fg bg-fg/5' : 'text-fg/70'
        }`}
      >
        {icon && <span className="w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
        <span className="flex-1">{label}</span>
        <ChevronRightIcon className="w-3.5 h-3.5 shrink-0 text-fg/40" />
      </div>
      {open && at && (
        <Popover open onClose={() => setOpen(false)} at={at}>
          {children}
        </Popover>
      )}
    </div>
  )
}
