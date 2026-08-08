import type { ReactNode } from 'react'
import { ChevronRightGlyph } from '../icons'

export type StatusTone = 'plain' | 'quiet' | 'danger'

const TONES: Record<StatusTone, string> = {
  plain: 'text-fg',
  quiet: 'text-fg-muted',
  danger: 'text-danger'
}

// The band at the foot of a thread's card, read in the grammar a step inside
// the thread is already read in: a mark, the word, and what the word is about.
// What the run has spent stands at the far end, where it is at the same offset
// on every card whatever the words in front of it are doing.
export default function ThreadStatusBar({
  mark,
  label,
  tone = 'plain',
  subject,
  figures
}: {
  mark: ReactNode
  label: string
  tone?: StatusTone
  subject?: ReactNode
  figures?: ReactNode
}) {
  return (
    <div className="w-full bg-ink-700 px-5 h-11 flex items-center gap-2.5 text-sm text-left">
      {mark}
      <span className={`shrink-0 font-medium ${TONES[tone]}`}>{label}</span>
      {subject}
      <span className="ml-auto shrink-0 flex items-center gap-2.5 pl-1 text-xs">{figures}</span>
      <ChevronRightGlyph className="w-3.5 h-3.5 shrink-0 text-fg-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </div>
  )
}
