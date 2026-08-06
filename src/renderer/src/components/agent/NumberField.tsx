import { useEffect, useState } from 'react'

export default function NumberField({
  value,
  label,
  unit,
  min,
  max,
  step,
  placeholder = 'Default',
  onChange
}: {
  value: string
  label: string
  unit?: string
  min?: number
  max?: number
  step?: number
  placeholder?: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  const commit = (raw: string) => {
    const text = raw.trim()
    if (!text) {
      setDraft('')
      onChange('')
      return
    }
    const held = Number(text)
    if (!Number.isFinite(held)) {
      setDraft(value)
      return
    }
    const floored = min !== undefined ? Math.max(min, held) : held
    const capped = max !== undefined ? Math.min(max, floored) : floored
    setDraft(String(capped))
    onChange(String(capped))
  }

  return (
    <div className="relative flex items-center">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={event => setDraft(event.target.value)}
        onBlur={event => commit(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') commit((event.target as HTMLInputElement).value)
          if (event.key === 'Escape') setDraft(value)
        }}
        className={`no-spin h-8 w-24 rounded-full bg-fg/[0.07] pl-3.5 text-sm text-fg text-right placeholder:text-fg/30 outline-none transition-colors duration-150 hover:bg-fg/[0.1] focus:bg-fg/[0.14] ${
          unit ? 'pr-9' : 'pr-3.5'
        }`}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3.5 text-sm text-fg/45 select-none">{unit}</span>
      )}
    </div>
  )
}
