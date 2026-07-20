import { useEffect, useRef, type ReactNode } from 'react'

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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const position = [
    side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
    align === 'end' ? 'right-0' : 'left-0'
  ].join(' ')

  return (
    <div ref={ref} className={`glass absolute z-50 rounded-2xl p-1.5 animate-pop ${position} ${className}`}>
      {children}
    </div>
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
