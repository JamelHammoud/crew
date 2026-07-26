import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

const STEP = 0.05

// A bar you drag. What it is set to changes as you move, and what it is left at
// is said once at the end, so a seek that everyone hears is sent when you let go
// rather than sixty times on the way there.
export default function Slider({
  value,
  label,
  disabled,
  className = '',
  onChange,
  onCommit
}: {
  value: number
  label: string
  disabled?: boolean
  className?: string
  onChange: (value: number) => void
  onCommit?: (value: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const held = Math.min(1, Math.max(0, value))

  const along = (clientX: number): number => {
    const box = ref.current?.getBoundingClientRect()
    if (!box || box.width === 0) return held
    return Math.min(1, Math.max(0, (clientX - box.left) / box.width))
  }

  const down = (event: ReactPointerEvent) => {
    if (disabled) return
    event.preventDefault()
    setDragging(true)
    onChange(along(event.clientX))
    const move = (moved: PointerEvent) => onChange(along(moved.clientX))
    const up = (let_go: PointerEvent) => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onCommit?.(along(let_go.clientX))
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const keys = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0
    if (!step) return
    event.preventDefault()
    const next = Math.min(1, Math.max(0, held + step))
    onChange(next)
    onCommit?.(next)
  }

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(held * 100)}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={down}
      onKeyDown={keys}
      className={`group relative h-5 flex items-center outline-none ${
        disabled ? 'pointer-events-none opacity-40' : 'cursor-pointer'
      } ${className}`}
    >
      <span className="h-1.5 w-full rounded-full bg-fg/[0.12] overflow-hidden">
        <span className="block h-full rounded-full bg-fg" style={{ width: `${held * 100}%` }} />
      </span>
      <span
        className={`absolute w-3 h-3 -translate-x-1/2 rounded-full bg-fg transition-opacity duration-150 ${
          dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
        }`}
        style={{ left: `${held * 100}%` }}
      />
    </div>
  )
}
