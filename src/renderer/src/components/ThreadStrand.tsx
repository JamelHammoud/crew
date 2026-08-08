import type { ReactNode } from 'react'
import { ChevronRightGlyph } from '../icons'

export type StrandTone = 'plain' | 'quiet' | 'danger'

const TONES: Record<StrandTone, string> = {
  plain: 'text-fg',
  quiet: 'text-fg-muted',
  danger: 'text-danger'
}

export default function ThreadStrand({
  mark,
  label,
  tone = 'plain',
  figures,
  dashed,
  onOpen
}: {
  mark: ReactNode
  label: string
  tone?: StrandTone
  figures?: ReactNode
  dashed?: boolean
  onOpen?: () => void
}) {
  const Row = onOpen ? 'button' : 'div'

  return (
    <Row
      onClick={onOpen}
      className={`group mt-2 w-full h-11 px-5 flex items-center gap-2.5 rounded-full border text-sm text-left transition-[background-color,border-color,transform] duration-200 ${
        dashed ? 'border-dashed border-ink-600' : 'border-transparent bg-ink-800'
      } ${onOpen ? `cursor-pointer active:scale-[0.99] ${dashed ? 'hover:border-ink-500 hover:bg-ink-800' : 'hover:bg-ink-700'}` : ''}`}
    >
      {mark}
      <span className={`min-w-0 truncate font-medium ${TONES[tone]}`}>{label}</span>
      <span className="ml-auto shrink-0 flex items-center gap-2.5 pl-2 text-xs">{figures}</span>
      <span
        className={`shrink-0 -ml-2.5 w-0 overflow-hidden opacity-0 transition-[width,margin,opacity] duration-200 ${
          onOpen ? 'group-hover:ml-0 group-hover:w-3.5 group-hover:opacity-100' : ''
        }`}
      >
        <ChevronRightGlyph className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
      </span>
    </Row>
  )
}
