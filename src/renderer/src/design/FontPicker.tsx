import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState } from 'react'
import { Popover } from '../components/Popover'
import { FONTS, fontLabel, fontStack, loadFonts, type FontCategory } from './fonts'

const GROUPS: Array<{ id: FontCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All fonts' },
  { id: 'sans', label: 'Sans serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
  { id: 'display', label: 'Display' },
  { id: 'hand', label: 'Handwriting' }
]

export default function FontPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<FontCategory | 'all'>('all')

  useEffect(() => loadFonts([value]), [value])

  const shown = useMemo(() => {
    const clean = query.trim().toLowerCase()
    return FONTS.filter(font => {
      if (group !== 'all' && font.category !== group) return false
      return clean === '' || font.label.toLowerCase().includes(clean)
    })
  }, [query, group])

  useEffect(() => {
    if (open) loadFonts(shown.map(font => font.name))
  }, [open, shown])

  return (
    <div className="relative block min-w-0">
      <button
        onClick={() => setOpen(current => !current)}
        aria-label="Font"
        aria-expanded={open}
        className={`w-full min-w-0 flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 ${
          open ? 'bg-ink-700 text-fg' : 'bg-ink-800 text-fg-secondary hover:bg-ink-700 hover:text-fg'
        }`}
      >
        <span className="flex-1 min-w-0 truncate text-left" style={{ fontFamily: fontStack(value) }}>
          {fontLabel(value)}
        </span>
        <ChevronDownIcon
          className={`w-4 h-4 shrink-0 text-fg-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="start" className="w-64">
        <div className="flex flex-col gap-1.5">
          <label className="h-8 shrink-0 flex items-center gap-1.5 rounded-full bg-fg/[0.06] px-3 focus-within:bg-fg/[0.12] transition-colors">
            <MagnifyingGlassIcon className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Find a font"
              aria-label="Find a font"
              className="w-full min-w-0 bg-transparent text-xs text-fg placeholder:text-fg-muted outline-none"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {GROUPS.map(item => (
              <button
                key={item.id}
                onClick={() => setGroup(item.id)}
                aria-pressed={group === item.id}
                className={`shrink-0 h-6 px-2.5 rounded-full text-xs font-medium transition-colors ${
                  group === item.id ? 'bg-fg text-ink-900' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.06]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {shown.length === 0 && <p className="px-3 py-6 text-xs text-fg-muted text-center">Nothing matches that.</p>}
            {shown.map(font => (
              <button
                key={font.name}
                onClick={() => {
                  onChange(font.name)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left transition-colors ${
                  font.name === value ? 'text-fg bg-fg/[0.06]' : 'text-fg-secondary hover:text-fg hover:bg-fg/5'
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-base" style={{ fontFamily: fontStack(font.name) }}>
                  {font.label}
                </span>
                {font.name === value && <CheckIcon className="w-4 h-4 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </Popover>
    </div>
  )
}
