import { memo, useEffect, useState } from 'react'
import { useBrowser } from '../state/browser'
import { useCrew } from '../state/store'
import { EmojiText } from './Emoji'
import HoverCard from './HoverCard'
import SubagentMark from './SubagentMark'
import { rootThread, sameItem, type ThreadItem } from './thread'

function SubagentMessage({ item, threadId }: { item: ThreadItem; threadId: string }) {
  const openSubagent = useBrowser(state => state.openSubagent)
  const parentThreadId = useCrew(state => rootThread(threadId, state.threads))
  const [line, setLine] = useState<HTMLSpanElement | null>(null)
  const [clipped, setClipped] = useState(false)

  useEffect(() => {
    if (!line) return
    const measure = () => setClipped(line.scrollWidth > line.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(line)
    return () => observer.disconnect()
  }, [line, item.text])

  const helperThreadId = item.helperThreadId ?? ''
  const card = clipped || item.text.includes('\n')

  return (
    <div className="flex items-center pl-13 pr-4 py-1 select-none">
      <HoverCard
        width={380}
        className="min-w-0 max-w-full"
        content={
          card ? (
            <span className="block max-h-[300px] overflow-y-auto overscroll-contain whitespace-pre-wrap break-words text-sm leading-[1.6] text-fg/70 select-text">
              <EmojiText text={item.text} quiet />
            </span>
          ) : null
        }
      >
        <button
          type="button"
          onClick={() => helperThreadId && openSubagent(helperThreadId, parentThreadId)}
          className="group flex min-w-0 max-w-full items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-ink-700 bg-ink-800/60 transition-all active:scale-[0.98] hover:border-ink-600 hover:bg-ink-700"
        >
          <SubagentMark seed={helperThreadId} size="xs" />
          <span className="shrink-0 text-xs text-fg-faint">To {item.author}</span>
          <span ref={setLine} className="min-w-0 truncate text-sm text-fg-secondary group-hover:text-fg">
            <EmojiText text={item.text} quiet />
          </span>
        </button>
      </HoverCard>
    </div>
  )
}

export default memo(
  SubagentMessage,
  (before, after) => before.threadId === after.threadId && sameItem(before.item, after.item)
)
