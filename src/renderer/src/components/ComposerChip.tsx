import type { ReactNode } from 'react'
import { CloseGlyph } from '../icons'

// A chip in the composer is a control standing in the row the plus stands in,
// so it is that button's height and wears its outline. The mark arrives at the
// size it should be drawn at, since a glyph and a pet are not one size.
export default function ComposerChip({
  mark,
  label,
  pressLabel,
  pressed,
  onPress,
  removeLabel,
  onRemove
}: {
  mark: ReactNode
  label: string
  pressLabel?: string
  pressed?: boolean
  onPress?: () => void
  removeLabel: string
  onRemove: () => void
}) {
  const contents = (
    <>
      {mark}
      <span className="truncate">{label}</span>
    </>
  )

  return (
    <span
      className={`h-10 pl-4 pr-1.5 rounded-full border flex items-center gap-2 text-sm text-fg shrink-0 transition-colors ${
        pressed ? 'border-fg/20' : 'border-ink-600'
      }`}
    >
      {onPress ? (
        <button
          onClick={onPress}
          aria-label={pressLabel}
          aria-expanded={pressed}
          className="h-full flex items-center gap-2 min-w-0 text-fg/80 hover:text-fg transition-colors cursor-pointer"
        >
          {contents}
        </button>
      ) : (
        contents
      )}
      <button
        onClick={onRemove}
        aria-label={removeLabel}
        className="w-7 h-7 -mr-0.5 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 cursor-pointer hover:text-fg hover:bg-fg/[0.06] active:scale-95"
      >
        <CloseGlyph className="w-3.5 h-3.5" />
      </button>
    </span>
  )
}
