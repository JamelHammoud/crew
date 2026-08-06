import type { ReactNode } from 'react'
import { ChevronRightGlyph } from '../../icons'

export default function OpenRow({
  label,
  line,
  hint,
  onOpen
}: {
  label: string
  line?: string
  hint?: ReactNode
  onOpen: () => void
}) {
  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-4 py-3.5 text-left border-b border-fg/[0.06] last:border-b-0 transition-colors duration-150 group"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base text-fg">{label}</span>
        {line && <span className="block text-sm text-fg/45 mt-0.5">{line}</span>}
      </span>
      {hint != null && <span className="shrink-0 text-sm text-fg/45">{hint}</span>}
      <ChevronRightGlyph className="w-4 h-4 shrink-0 text-fg/30 transition-colors duration-150 group-hover:text-fg/70" />
    </button>
  )
}
