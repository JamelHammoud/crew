import { type KeyboardEvent } from 'react'
import { ChevronLeftGlyph, CloseGlyph, SearchGlyph } from '../icons'
import { useAutoFocus } from './useAutoFocus'

const QUIET =
  'shrink-0 flex items-center justify-center rounded-full text-fg/45 cursor-pointer transition-[background-color,color,transform] duration-150 hover:text-fg hover:bg-fg/[0.08] active:scale-90'

export default function SearchField({
  value,
  onChange,
  placeholder,
  onBack,
  onKeyDown,
  backLabel = 'Back'
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onBack?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  backLabel?: string
}) {
  const ref = useAutoFocus<HTMLInputElement>()

  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-fg/[0.06] px-2.5">
      {onBack && (
        <button type="button" onClick={onBack} aria-label={backLabel} className={`${QUIET} h-8 w-8`}>
          <ChevronLeftGlyph className="h-4 w-4" />
        </button>
      )}
      <SearchGlyph className={`h-4 w-4 shrink-0 text-fg/35 ${onBack ? '' : 'ml-1.5'}`} />
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
      {value.length > 0 && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className={`${QUIET} h-7 w-7`}>
          <CloseGlyph className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
