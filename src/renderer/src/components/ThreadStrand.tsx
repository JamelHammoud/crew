import type { ReactNode } from 'react'
import { ChevronRightGlyph } from '../icons'

export type StrandTone = 'plain' | 'quiet' | 'danger'

const TONES: Record<StrandTone, string> = {
  plain: 'text-fg',
  quiet: 'text-fg-muted',
  danger: 'text-danger'
}

export const STRAND_SHAPE = 'h-9 flex items-center gap-2.5 rounded-[14px] border text-sm'

export function StrandPill({ mark, label }: { mark: ReactNode; label: string }) {
  return (
    <span
      className={`${STRAND_SHAPE} shrink-0 pl-3 pr-3.5 border-transparent bg-ink-800 font-medium text-fg-muted`}
    >
      {mark}
      {label}
    </span>
  )
}

export default function ThreadStrand({
  mark,
  label,
  tone = 'plain',
  figures,
  chips,
  dashed,
  onOpen
}: {
  mark: ReactNode
  label: string
  tone?: StrandTone
  figures?: ReactNode
  chips?: ReactNode
  dashed?: boolean
  onOpen?: () => void
}) {
  const Row = onOpen ? 'button' : 'div'

  return (
    <Row
      onClick={onOpen}
      className={`group mt-4 w-full flex items-center gap-2.5 text-left ${
        onOpen ? 'cursor-pointer transition-transform duration-200 active:scale-[0.99]' : ''
      }`}
    >
      <span
        className={`${STRAND_SHAPE} min-w-0 max-w-full pl-3.5 pr-2 transition-[background-color,border-color] duration-200 ${
          dashed ? 'border-dashed border-ink-600' : 'border-transparent bg-ink-800'
        } ${onOpen ? (dashed ? 'group-hover:border-ink-500' : 'group-hover:bg-ink-700') : ''}`}
      >
        {mark}
        <span className={`min-w-0 truncate font-medium ${TONES[tone]}`}>{label}</span>
        <span className="shrink-0 ml-2 flex items-center gap-2.5 text-xs">{figures}</span>
        <span
          className={`shrink-0 -ml-2.5 w-1.5 overflow-hidden opacity-0 transition-[width,margin,opacity] duration-200 ${
            onOpen ? 'group-hover:ml-0 group-hover:w-3.5 group-hover:opacity-100' : ''
          }`}
        >
          <ChevronRightGlyph className="w-3.5 h-3.5 shrink-0 text-fg-muted" />
        </span>
      </span>
      {chips}
    </Row>
  )
}
