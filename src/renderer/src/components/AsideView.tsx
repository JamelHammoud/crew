import { useLayoutEffect, useMemo, useRef } from 'react'
import { useCrew } from '../state/store'
import RunStatus from './RunStatus'
import ScrollFade from './ScrollFade'
import ThreadItems from './ThreadItems'
import { buildThread } from './thread'
import useScrollEdges from './useScrollEdges'

// A question asked on the side, and the answer to it. It is a thread nobody
// else has, standing where it was asked to stand: beside the work rather than
// in it. Nothing here writes back, so there is no composer on it.
export default function AsideView({ threadId }: { threadId: string }) {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const selfId = useCrew(s => s.selfId)
  const agents = useCrew(s => s.agents)
  const thread = useCrew(s => s.threads[threadId])
  const promptId = useCrew(s => s.threadPrompts[threadId])
  const tokens = useCrew(s => (promptId ? (s.tokens[promptId] ?? 0) : 0))
  const cost = useCrew(s => (promptId ? s.costs[promptId] : undefined))
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scrollRef)

  const threadEvents = useMemo(
    () => events.filter(e => 'threadId' in e && e.threadId === threadId),
    [events, threadId]
  )
  const items = useMemo(() => buildThread(threadEvents, steps, selfId, agents), [threadEvents, steps, selfId, agents])
  const startedAt = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === promptId)?.ts

  // An answer is written into the bottom of the panel, so it follows itself down
  // the way a thread does.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items, steps])

  if (!thread) return null

  return (
    <div className="absolute inset-0 flex flex-col bg-ink-900">
      <div className="relative flex-1 min-h-0 min-w-0">
        <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden px-5 py-4 space-y-5">
          <ThreadItems items={items} />
          {promptId && startedAt && (
            <RunStatus startedAt={startedAt} tokens={tokens} cost={cost} steps={steps[promptId] ?? []} />
          )}
        </div>
        <ScrollFade edges={edges} />
      </div>
      {promptId && (
        <div className="p-4">
          <button
            onClick={() => cancelPrompt(promptId)}
            className="w-full h-11 rounded-full bg-ink-800 text-base font-semibold text-fg-secondary transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-[0.99]"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  )
}
