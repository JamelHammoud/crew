import { useState, type ReactNode } from 'react'
import { CheckGlyph, ChevronDownGlyph } from '../icons'
import { Popover } from './Popover'

export default function Select({
  label,
  value,
  options,
  onChange,
  side = 'bottom',
  full
}: {
  label?: string
  value: string
  options: Array<{ value: string; label: string; hint?: ReactNode }>
  onChange: (value: string) => void
  side?: 'top' | 'bottom'
  full?: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.value === value)

  return (
    <div className={`relative ${full ? 'block min-w-0' : 'inline-block'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 ${
          full ? 'w-full min-w-0' : ''
        } ${open ? 'bg-fg/[0.12] text-fg' : 'bg-fg/[0.07] text-fg/70 hover:bg-fg/[0.12] hover:text-fg'}`}
      >
        {label && <span className="text-fg/45">{label}</span>}
        <span className={full ? 'flex-1 min-w-0 truncate text-left' : ''}>{current?.label ?? value}</span>
        <ChevronDownGlyph
          className={`w-4 h-4 shrink-0 text-fg/45 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="start" side={side} maxHeight={256} className="min-w-40">
        {options.map(option => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left whitespace-nowrap transition-colors ${
                selected ? 'text-fg' : 'text-fg/70 hover:text-fg hover:bg-fg/5'
              }`}
            >
              <span className="flex-1">{option.label}</span>
              {option.hint != null && <span className="text-xs text-fg/45">{option.hint}</span>}
              {selected && <CheckGlyph className="w-4 h-4 shrink-0" />}
            </button>
          )
        })}
      </Popover>
    </div>
  )
}
