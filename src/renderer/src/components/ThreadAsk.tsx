import { useEffect, useMemo, useState } from 'react'
import { relabelMentions, type AgentMentionRef } from '../../../shared/llm'
import { useCrew } from '../state/store'
import HoverCard from './HoverCard'

const CARD_WIDTH = 380

// What the line is holding back. The header has one line for what a thread is
// about, and a message written in paragraphs is cut down to a phrase to fit it,
// so hovering stands the whole of it up rather than sending somebody to the head
// of the thread to read what they are already looking at.
export function askHasMore(ask: string, whole: string, clipped: boolean): boolean {
  if (!whole.trim()) return false
  // Cut to fit the box, cut to fit the title, or written over more lines than
  // the one the header draws.
  return clipped || ask.endsWith('…') || whole.trim().includes('\n')
}

export default function ThreadAsk({
  ask,
  whole = '',
  mentionRefs,
  onJump
}: {
  ask: string
  // The message the thread was opened on, as it was written. The line above is
  // the host's own short name for it, so this is the only place the whole of it
  // is read without going to the head of the thread.
  whole?: string
  mentionRefs?: AgentMentionRef[]
  onJump: () => void
}) {
  const agents = useCrew(s => s.agents)
  const [line, setLine] = useState<HTMLButtonElement | null>(null)
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    if (!line) return
    const measure = () => setClipped(line.scrollWidth > line.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(line)
    return () => observer.disconnect()
  }, [line, ask])

  // A rename shows on a message written before it, the same as everywhere else
  // the words are drawn.
  const written = useMemo(() => relabelMentions(whole, mentionRefs, agents).trim(), [agents, mentionRefs, whole])

  return (
    <HoverCard
      width={CARD_WIDTH}
      className="min-w-0 max-w-full"
      content={
        askHasMore(ask, written, clipped) ? (
          <span className="block max-h-[300px] overflow-y-auto overscroll-contain whitespace-pre-wrap break-words text-sm leading-[1.6] text-fg/70 select-text">
            {written}
          </span>
        ) : null
      }
    >
      <button
        ref={setLine}
        onClick={onJump}
        className="block max-w-full truncate text-sm text-fg-muted transition-colors duration-150 hover:text-fg-secondary"
      >
        {ask}
      </button>
    </HoverCard>
  )
}
