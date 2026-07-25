import { useEffect, useState, type ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-xs text-fg-muted">{label}</span>
      {children}
    </label>
  )
}

export function Section({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <span className="text-xs font-semibold text-fg-muted">{label}</span>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  min = -99999,
  max = 99999,
  suffix
}: {
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
    <span className="flex-1 min-w-0 flex items-center h-7 rounded-full bg-fg/[0.06] px-2.5 transition-colors focus-within:bg-fg/[0.1]">
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
        className="w-full min-w-0 bg-transparent text-xs tabular-nums text-fg outline-none"
      />
      {suffix && <span className="text-xs text-fg-faint shrink-0">{suffix}</span>}
    </span>
  )
}

export function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <span className="flex-1 min-w-0 flex items-center gap-2 h-7 rounded-full bg-fg/[0.06] pl-1 pr-2.5">
      <input
        type="color"
        value={value.slice(0, 7)}
        onChange={e => onChange(e.target.value + (value.length === 9 ? value.slice(7) : ''))}
        aria-label="Color"
        className="w-5 h-5 shrink-0 rounded-full bg-transparent border-0 p-0 cursor-pointer"
      />
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(draft) ? onChange(draft) : setDraft(value))}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-full min-w-0 bg-transparent text-xs font-mono uppercase text-fg outline-none"
      />
    </span>
  )
}

export function Choice<T extends string>({
  value,
  options,
  onPick
}: {
  value: T
  options: ReadonlyArray<{ value: T; label?: string; icon?: ReactNode }>
  onPick: (value: T) => void
}) {
  return (
    <span className="flex-1 min-w-0 flex bg-fg/[0.06] rounded-full p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onPick(option.value)}
          aria-label={option.label}
          aria-pressed={option.value === value}
          className={`flex-1 min-w-0 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            option.value === value ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg'
          }`}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </span>
  )
}
