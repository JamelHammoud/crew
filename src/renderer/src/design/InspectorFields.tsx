import { useEffect, useState, type ReactNode } from 'react'
import { CREW_SWATCHES } from '../../../shared/design'
import { Popover } from '../components/Popover'

export function Section({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-t border-ink-700 px-4 py-3 flex flex-col gap-2">
      <div className="min-h-7 flex items-center">
        <h3 className="flex-1 text-sm font-semibold text-fg">{title}</h3>
        {action}
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

function Shell({ children }: { children: ReactNode }) {
  return (
    <span className="min-w-0 h-8 flex items-center gap-2 rounded-full bg-fg/[0.06] px-3 transition-colors focus-within:bg-fg/[0.12]">
      {children}
    </span>
  )
}

function Lead({ label, icon }: { label?: string; icon?: ReactNode }) {
  if (icon) return <span className="shrink-0 text-fg-muted">{icon}</span>
  if (label) return <span className="shrink-0 text-xs text-fg-muted">{label}</span>
  return null
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
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(String(Math.round(value * 100) / 100))
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const next = Number(draft)
    if (!isFinite(next)) return setDraft(String(value))
    onChange(Math.min(max, Math.max(min, next)))
  }

  return (
    <Shell>
      <Lead label={label} icon={icon} />
      <input
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(String(value))
            e.currentTarget.blur()
          }
        }}
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
      <Lead label={icon ? undefined : label} icon={icon} />
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
  const alpha = value.length === 9 ? value.slice(7) : ''
  return (
    <span className="flex-1 min-w-0 flex items-center gap-2 h-8 rounded-full bg-fg/[0.06] pl-1.5 pr-3">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Color"
        style={{ background: value }}
        className="w-5 h-5 shrink-0 rounded-full ring-1 ring-inset ring-fg/15 transition-transform hover:scale-110 active:scale-95"
      />
      <Popover open={open} onClose={() => setOpen(false)} align="start">
        <ColorPicker value={value} onChange={onChange} alpha={onOpacity === undefined} />
      </Popover>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(draft) ? onChange(draft) : setDraft(value))}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Hex"
        className="w-full min-w-0 bg-transparent text-xs font-mono uppercase text-fg outline-none"
      />
      {opacity !== undefined && onOpacity && (
        <input
          value={Math.round(opacity * 100)}
          onChange={e => {
            const next = Number(e.target.value)
            if (isFinite(next)) onOpacity(Math.min(100, Math.max(0, next)) / 100)
          }}
          aria-label="Opacity"
          className="w-8 shrink-0 bg-transparent text-right text-xs tabular-nums text-fg-muted outline-none"
        />
      )}
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
