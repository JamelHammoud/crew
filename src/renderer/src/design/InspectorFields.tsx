import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from 'react'
import { useMaybeEditor } from 'tldraw'
import { Popover } from '../components/Popover'
import ColorPicker from './ColorPicker'

const tidy = (value: number) => Math.round(value * 100) / 100

export function Section({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-t border-ink-700 px-4 py-3 flex flex-col gap-2">
      <div className="min-h-7 flex items-center">
        <h3 className="flex-1 text-sm font-semibold text-fg">{title}</h3>
        {action && <span className="shrink-0 flex items-center -mr-1.5">{action}</span>}
      </div>
      {children}
    </section>
  )
}

export function SubLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs text-fg-muted">{children}</span>
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

export function Trailing({ children }: { children: ReactNode }) {
  return <span className="shrink-0 flex items-center -mr-2">{children}</span>
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <span className="min-w-0 h-8 flex items-center gap-1.5 rounded-full bg-fg/[0.06] px-2.5 transition-colors focus-within:bg-fg/[0.12]">
      {children}
    </span>
  )
}

interface Gesture {
  onStart: () => void
  onStep: (by: number) => void
  onEnd: () => void
}

function Scrub({ label, gesture, children }: { label: string; gesture: Gesture; children: ReactNode }) {
  const from = useRef<number | null>(null)

  const stop = (event: PointerEvent<HTMLSpanElement>) => {
    if (from.current === null) return
    from.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    gesture.onEnd()
  }

  return (
    <span
      data-scrub={label}
      aria-hidden
      onPointerDown={event => {
        if (event.button !== 0) return
        event.preventDefault()
        from.current = event.clientX
        event.currentTarget.setPointerCapture?.(event.pointerId)
        gesture.onStart()
      }}
      onPointerMove={event => {
        if (from.current === null) return
        const steps = Math.trunc(event.clientX - from.current)
        if (steps === 0) return
        from.current += steps
        gesture.onStep(steps * (event.shiftKey ? 10 : 1))
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      className="shrink-0 flex items-center text-fg-muted cursor-ew-resize select-none touch-none transition-colors hover:text-fg"
    >
      {children}
    </span>
  )
}

function useNumberField({
  value,
  onChange,
  min,
  max
}: {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
}) {
  const editor = useMaybeEditor()
  const [draft, setDraft] = useState(() => String(tidy(value)))
  const [editing, setEditing] = useState(false)
  const pending = useRef(value)
  const mark = useRef<string | null>(null)

  useEffect(() => {
    if (!editing) setDraft(String(tidy(value)))
  }, [value, editing])

  const clamp = (next: number) => Math.min(max, Math.max(min, tidy(next)))

  const gesture: Gesture = {
    onStart: () => {
      const base = Number(draft)
      pending.current = draft.trim() !== '' && isFinite(base) ? base : value
      if (editor && mark.current === null) mark.current = editor.markHistoryStoppingPoint()
    },
    onStep: by => {
      pending.current = clamp(pending.current + by)
      setDraft(String(pending.current))
      onChange(pending.current)
    },
    onEnd: () => {
      if (editor && mark.current !== null) editor.squashToMark(mark.current)
      mark.current = null
    }
  }

  const input = {
    value: draft,
    onFocus: () => setEditing(true),
    onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    onBlur: () => {
      setEditing(false)
      const next = Number(draft)
      if (draft.trim() === '' || !isFinite(next)) return setDraft(String(tidy(value)))
      onChange(clamp(next))
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        if (!event.repeat) gesture.onStart()
        gesture.onStep((event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1))
        return
      }
      if (event.key === 'Enter') event.currentTarget.blur()
      if (event.key === 'Escape') {
        setDraft(String(tidy(value)))
        event.currentTarget.blur()
      }
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') gesture.onEnd()
    }
  }

  return { input, gesture }
}

export function NumberInput({
  label,
  icon,
  value,
  onChange,
  min = -99999,
  max = 99999,
  suffix
}: {
  label?: string
  icon?: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  const { input, gesture } = useNumberField({ value, onChange, min, max })
  const lead = icon ?? (label ? <span className="text-xs">{label}</span> : null)

  return (
    <Shell>
      {lead && (
        <Scrub label={label ?? 'Value'} gesture={gesture}>
          {lead}
        </Scrub>
      )}
      <input
        {...input}
        aria-label={label}
        className="w-full min-w-0 bg-transparent text-xs tabular-nums text-fg outline-none"
      />
      {suffix && <span className="shrink-0 text-xs text-fg-faint">{suffix}</span>}
    </Shell>
  )
}

export function MixedInput({ label, icon, onChange }: { label: string; icon?: ReactNode; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState('')
  return (
    <Shell>
      {icon ? (
        <span className="shrink-0 text-fg-muted">{icon}</span>
      ) : (
        <span className="shrink-0 text-xs text-fg-muted">{label}</span>
      )}
      <input
        value={draft}
        placeholder="Mixed"
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const next = Number(draft)
          if (draft !== '' && isFinite(next)) onChange(Math.max(0, next))
          setDraft('')
        }}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label={label}
        className="w-full min-w-0 bg-transparent text-xs tabular-nums text-fg placeholder:text-fg-muted outline-none"
      />
    </Shell>
  )
}

function Percent({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { input, gesture } = useNumberField({ value: Math.round(value * 100), onChange: next => onChange(next / 100), min: 0, max: 100 })
  return (
    <span className="shrink-0 flex items-center gap-0.5">
      <Scrub label="Opacity" gesture={gesture}>
        <input {...input} aria-label="Opacity" className="w-7 bg-transparent text-right text-xs tabular-nums text-fg-muted outline-none cursor-ew-resize focus:text-fg focus:cursor-text" />
      </Scrub>
      <span className="text-xs text-fg-faint">%</span>
    </span>
  )
}

export function ColorInput({
  value,
  onChange,
  opacity,
  onOpacity
}: {
  value: string
  onChange: (value: string) => void
  opacity?: number
  onOpacity?: (value: number) => void
}) {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  useEffect(() => setDraft(value), [value])
  return (
    <span className="flex-1 min-w-0 flex items-center gap-2 h-8 rounded-full bg-fg/[0.06] pl-1.5 pr-2.5">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Color"
        style={{ background: value }}
        className="w-5 h-5 shrink-0 rounded-full ring-1 ring-inset ring-fg/15 transition-transform hover:scale-110 active:scale-95"
      />
      <Popover open={open} onClose={() => setOpen(false)} align="start">
        <ColorPicker
          value={value}
          onChange={onChange}
          alpha={onOpacity === undefined}
          opacity={opacity}
          onOpacity={onOpacity}
        />
      </Popover>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(draft) ? onChange(draft) : setDraft(value))}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Hex"
        className="w-full min-w-0 bg-transparent text-xs font-mono uppercase text-fg outline-none"
      />
      {opacity !== undefined && onOpacity && <Percent value={opacity} onChange={onOpacity} />}
    </span>
  )
}

export function Choice<T extends string>({
  value,
  options,
  onPick
}: {
  value: string | null
  options: ReadonlyArray<{ value: T; label?: string; icon?: ReactNode }>
  onPick: (value: T) => void
}) {
  return (
    <span className="min-w-0 flex bg-fg/[0.06] rounded-full p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onPick(option.value)}
          aria-label={option.label}
          aria-pressed={option.value === value}
          className={`flex-1 min-w-0 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            option.value === value ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </span>
  )
}
