import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Popover({
  open,
  onClose,
  align = 'end',
  side = 'bottom',
  className = '',
  children
}: {
  open: boolean
  onClose: () => void
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
  className?: string
  children: ReactNode
}) {
  const holderRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null)
      return
    }
    const anchor = holderRef.current?.parentElement
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const next: CSSProperties = {}
    if (side === 'bottom') next.top = rect.bottom + 8
    else next.bottom = window.innerHeight - rect.top + 8
    if (align === 'start') next.left = rect.left
    else next.right = window.innerWidth - rect.right
    setStyle(next)
  }, [open, align, side])

  useEffect(() => {
    if (!open) return
    const anchor = holderRef.current?.parentElement
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!anchor?.contains(target) && !popRef.current?.contains(target)) onClose()
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
  }, [open, onClose])

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
