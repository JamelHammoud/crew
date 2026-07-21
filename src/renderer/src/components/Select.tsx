import { CheckIcon, ChevronDownIcon } from '@heroicons/react/16/solid'
import { useState, type ReactNode } from 'react'
import { Popover } from './Popover'

export default function Select({
  label,
  value,
  options,
  onChange,
  side = 'bottom'
}: {
  label?: string
  value: string
  options: Array<{ value: string; label: string; hint?: ReactNode }>
  onChange: (value: string) => void
  side?: 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  const current = options.find(option => option.value === value)

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 ${
          open ? 'bg-ink-700 text-fg' : 'bg-ink-800 text-fg-secondary hover:bg-ink-700 hover:text-fg'
        }`}
      >
        {label && <span className="text-fg-muted">{label}</span>}
        <span>{current?.label ?? value}</span>
        <ChevronDownIcon
          className={`w-4 h-4 text-fg-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="start" side={side} className="min-w-40 max-h-64 overflow-y-auto">
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
                selected ? 'text-fg' : 'text-fg-secondary hover:text-fg hover:bg-fg/5'
              }`}
            >
              <span className="flex-1">{option.label}</span>
              {option.hint != null && <span className="text-xs text-fg-muted">{option.hint}</span>}
              {selected && <CheckIcon className="w-4 h-4 shrink-0" />}
            </button>
          )
        })}
      </Popover>
    </div>
  )
}
