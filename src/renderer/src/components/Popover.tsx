import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { CheckGlyph, ChevronRightGlyph } from '../icons'

// A popover opened from inside a popover is a sibling of it in the body rather
// than a child, so the one underneath counts every click on it as a click
// outside and closes, taking the one on top down with it. Each popover tells the
// ones it stands inside where it is, all the way up, so a click anywhere in the
// stack is a click inside every popover in it.
type Nest = { add: (el: HTMLElement) => void; drop: (el: HTMLElement) => void }

const NestContext = createContext<Nest | null>(null)

// A popover follows what it was opened on rather than closing when the page
// under it moves. The thread scrolls itself while an agent works, and a menu
// that goes down with it is a menu that vanishes mid-aim.
const sameSpot = (a: DOMRect, b: DOMRect): boolean =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

export function Popover({
  open,
  onClose,
  align = 'end',
  side = 'bottom',
  at,
  flush,
  maxHeight,
  className = '',
  children
}: {
  open: boolean
  onClose: () => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
  at?: { x: number; y: number }
  flush?: boolean
  maxHeight?: number
  className?: string
  children: ReactNode
}) {
  const holderRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const placedRef = useRef<'top' | 'bottom' | null>(null)
  const sizeRef = useRef<{ w: number; h: number } | null>(null)
  const trackRef = useRef<{ el: HTMLElement; from: DOMRect } | null>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const outer = useContext(NestContext)
  const inner = useRef(new Set<HTMLElement>())
  const nest = useMemo<Nest>(
    () => ({
      add: el => {
        inner.current.add(el)
        outer?.add(el)
      },
      drop: el => {
        inner.current.delete(el)
        outer?.drop(el)
      }
    }),
    [outer]
  )

  useEffect(() => {
    const el = popRef.current
    if (!el || !outer) return
    outer.add(el)
    return () => outer.drop(el)
  })

  const within = (target: Node): boolean =>
    Boolean(popRef.current?.contains(target)) || [...inner.current].some(el => el.contains(target))

  const spotNow = (): DOMRect | null => {
    if (!at) {
      const anchor = holderRef.current?.parentElement
      return anchor ? anchor.getBoundingClientRect() : null
    }
    const track = trackRef.current
    if (!track) return new DOMRect(at.x, at.y, 0, 0)
    if (!track.el.isConnected) return null
    const now = track.el.getBoundingClientRect()
    return new DOMRect(at.x + now.left - track.from.left, at.y + now.top - track.from.top, 0, 0)
  }

  useLayoutEffect(() => {
    if (!open) {
      setRect(null)
      setSize(null)
      sizeRef.current = null
      placedRef.current = null
      trackRef.current = null
      return
    }
    if (at) {
      const el = document.elementFromPoint?.(at.x, at.y) as HTMLElement | null
      trackRef.current = el && !within(el) ? { el, from: el.getBoundingClientRect() } : null
    }
    setRect(spotNow())
  }, [open, at])

  useEffect(() => {
    if (!open || typeof requestAnimationFrame === 'undefined') return
    let frame = requestAnimationFrame(function tick() {
      frame = requestAnimationFrame(tick)
      const next = spotNow()
      if (next) setRect(current => (current && sameSpot(current, next) ? current : next))
    })
    return () => cancelAnimationFrame(frame)
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

  const spot = ((): CSSProperties | null => {
    if (!rect) return null
    if (!size) return { left: 0, top: 0, visibility: 'hidden' }
    if (at) {
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - size.w - 8))
      let top = rect.top
      if (top + size.h > window.innerHeight - 8) top = rect.top - size.h
      top = Math.max(8, Math.min(top, window.innerHeight - size.h - 8))
      return { left, top }
    }
    let left =
      align === 'start'
        ? rect.left
        : align === 'center'
          ? rect.left + rect.width / 2 - size.w / 2
          : rect.right - size.w
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

  const style: CSSProperties | null = spot && {
    ...spot,
    maxHeight: Math.min(maxHeight ?? Infinity, window.innerHeight - 16),
    overflowY: 'auto',
    overflowX: 'hidden'
  }

  useEffect(() => {
    if (!open) return
    const anchor = holderRef.current?.parentElement
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (within(target)) return
      if (at || !anchor?.contains(target)) onClose()
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
  }, [open, onClose, at])

  return (
    <>
      <span ref={holderRef} className="hidden" />
      {open &&
        style &&
        createPortal(
          <div
            ref={popRef}
            style={style}
            className={`glass fixed z-[70] rounded-2xl animate-pop overscroll-contain ${flush ? '' : 'p-1.5'} ${className}`}
          >
            <NestContext.Provider value={nest}>{children}</NestContext.Provider>
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
  checked,
  into,
  onClick,
  onHover
}: {
  icon?: ReactNode
  label: string
  hint?: string
  danger?: boolean
  active?: boolean
  checked?: boolean
  // A row that opens a screen inside the same card rather than doing the thing
  // it names. The chevron is what says so before it is pressed.
  into?: boolean
  onClick: () => void
  onHover?: () => void
}) {
  // A row that is a toggle renames itself under the pointer that just pressed
  // it, and the mark it wears changes with the word. Both turn over together, so
  // the two read as one change rather than as two things blinking. Keyed on the
  // label, which is what remounts them, and armed only once the label has really
  // changed: opening a menu is not a change, and every row fading in behind the
  // popover's own pop is two animations for one action.
  const opened = useRef(label)
  const swap = opened.current === label ? '' : 'word-swap'

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
      {icon && (
        <span key={`mark:${label}`} className={`${swap} w-4 h-4 shrink-0 [&>svg]:w-4 [&>svg]:h-4`}>
          {icon}
        </span>
      )}
      <span key={`word:${label}`} className={`${swap} flex-1 truncate`}>
        {label}
      </span>
      {hint && <span className="text-xs text-fg/40 tabular-nums shrink-0">{hint}</span>}
      {checked && <CheckGlyph className="w-4 h-4 shrink-0 text-fg" />}
      {into && <ChevronRightGlyph className="w-3.5 h-3.5 shrink-0 text-fg/40" />}
    </button>
  )
}

export function SubMenu({
  icon,
  label,
  maxHeight,
  children
}: {
  icon?: ReactNode
  label: string
  maxHeight?: number
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
        <span className="flex-1 truncate">{label}</span>
        <ChevronRightGlyph className="w-3.5 h-3.5 shrink-0 text-fg/40" />
      </div>
      {open && at && (
        <Popover open onClose={() => setOpen(false)} at={at} maxHeight={maxHeight}>
          {children}
        </Popover>
      )}
    </div>
  )
}
