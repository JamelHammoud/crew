import type { ReactNode } from 'react'
import { ChevronRightGlyph } from '../icons'

export type StrandTone = 'plain' | 'quiet' | 'danger'

const TONES: Record<StrandTone, string> = {
  plain: 'text-fg',
  quiet: 'text-fg-muted',
  danger: 'text-danger'
}

// The thread itself, hanging under the ask that opened it. It is one row rather
// than a box with a bar in the bottom of it: a thread is a strand off the
// conversation, and a card drawn around the ask made the two read as one object
// with a slab of chrome under it. Everything the thread has to say from out
// here is on this row, so there is one thing to press and one line to read.
export default function ThreadStrand({
  mark,
  label,
  tone = 'plain',
  subject,
  figures,
  dashed,
  onOpen
}: {
  mark: ReactNode
  label: string
  tone?: StrandTone
  subject?: ReactNode
  figures?: ReactNode
  // A ghost thread wears a dashed stroke wherever it is drawn, and out here the
  // strand is the whole of what there is to draw it on.
  dashed?: boolean
  onOpen?: () => void
}) {
  const Row = onOpen ? 'button' : 'div'

  return (
    <Row
      onClick={onOpen}
      className={`group mt-2 w-full h-11 px-5 flex items-center gap-2.5 rounded-full border text-sm text-left transition-[background-color,border-color,transform] duration-200 ${
        dashed ? 'border-dashed border-ink-600 hover:bg-ink-800' : 'border-transparent bg-ink-800'
      } ${onOpen ? `cursor-pointer active:scale-[0.99] ${dashed ? 'hover:border-ink-500' : 'hover:bg-ink-700'}` : ''}`}
    >
      {mark}
      <span className={`shrink-0 font-medium ${TONES[tone]}`}>{label}</span>
      {subject}
      <span className="ml-auto shrink-0 flex items-center gap-2.5 pl-1 text-xs">{figures}</span>
      <ChevronRightGlyph
        className={`w-3.5 h-3.5 shrink-0 text-fg-muted transition-opacity duration-200 ${
          onOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'
        }`}
      />
    </Row>
  )
}
