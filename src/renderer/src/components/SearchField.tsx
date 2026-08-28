import { type KeyboardEvent, type ReactNode } from 'react'
import { CloseGlyph, SearchGlyph } from '../icons'
import { useAutoFocus } from './useAutoFocus'

const QUIET =
  'shrink-0 flex items-center justify-center rounded-full text-fg/45 cursor-pointer transition-[background-color,color,transform] duration-150 hover:text-fg hover:bg-fg/[0.08] active:scale-90'

export default function SearchField({
  value,
  onChange,
  placeholder,
  onKeyDown,
  actions,
  prefix,
  search = true,
  autoFocus = true,
  clearLabel = 'Clear search'
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  actions?: ReactNode
  prefix?: ReactNode
  search?: boolean
  autoFocus?: boolean
  clearLabel?: string
}) {
  const ref = useAutoFocus<HTMLInputElement>(autoFocus)

  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-fg/[0.06] px-2.5">
      {prefix}
      {search && <SearchGlyph className="ml-1.5 h-4 w-4 shrink-0 text-fg/35" />}
      <input
        ref={ref}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg/35"
      />
      {actions}
      {value.length > 0 && (
        <button type="button" onClick={() => onChange('')} aria-label={clearLabel} className={`${QUIET} h-7 w-7`}>
          <CloseGlyph className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
