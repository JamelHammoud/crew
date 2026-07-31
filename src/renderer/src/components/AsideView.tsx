import { useLayoutEffect, useMemo, useRef } from 'react'
import { pendingCount, useCrew } from '../state/store'
import Composer from './Composer'
import RunStatus from './RunStatus'
import ScrollFade from './ScrollFade'
import ThreadItems from './ThreadItems'
import { buildThread, eventsOfThread } from './thread'
import { useAutoResize } from './useAutoResize'
import useScrollEdges from './useScrollEdges'
import { useStickToBottom } from './useStickToBottom'

// A conversation on the side, standing where it was asked to stand: beside the
// work rather than in it. It is a thread nobody else has, so it is made of the
// pieces a thread is already made of, a composer among them: an answer is
// rarely the end of it, and going back for the next question is a second tab
// that has to be told the whole thing again.
//
// Nothing typed here reaches the thread it is about, whatever is written. The
// thread is read fresh on every turn, so it carries on and the answers keep up
// with it.
export default function AsideView({ threadId }: { threadId: string }) {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const selfId = useCrew(s => s.selfId)
  const agents = useCrew(s => s.agents)
  const thread = useCrew(s => s.threads[threadId])
  const promptId = useCrew(s => s.threadPrompts[threadId])
  const tokens = useCrew(s => (promptId ? (s.tokens[promptId] ?? 0) : 0))
  const cost = useCrew(s => (promptId ? s.costs[promptId] : undefined))
  const text = useCrew(s => s.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(s => s.setThreadDraft)
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { onScroll, follow, jumpToBottom } = useStickToBottom(scrollRef, `aside:${threadId}`)
  const { edges } = useScrollEdges(scrollRef)
  const inputRef = useAutoResize(text)

  const threadEvents = useMemo(() => eventsOfThread(events, threadId), [events, threadId])
  const items = useMemo(() => buildThread(threadEvents, steps, selfId, agents), [threadEvents, steps, selfId, agents])
  const startedAt = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === promptId)?.ts

  // An answer is written into the bottom of the panel, so it follows itself down
  // the way a thread does, until somebody scrolls back to read it.
  useLayoutEffect(() => {
    follow()
  }, [items, steps, follow])

  if (!thread) return null

  const send = () => {
    if (!text.trim() && pendingCount(threadId) === 0) return
    sendChat(text, threadId)
    jumpToBottom()
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-ink-900">
      <div className="relative flex-1 min-h-0 min-w-0">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full overflow-y-auto overflow-x-hidden px-5 py-4 space-y-5 select-text"
        >
          <ThreadItems items={items} />
          {promptId && startedAt && (
            <RunStatus startedAt={startedAt} tokens={tokens} cost={cost} steps={steps[promptId] ?? []} />
          )}
        </div>
        <ScrollFade edges={edges} />
      </div>
      <div className="shrink-0 px-4 pb-4">
        <Composer
          attachmentKey={threadId}
          value={text}
          placeholder="Ask something else"
          inputRef={inputRef}
          onChange={value => setThreadDraft(threadId, value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          onSend={send}
          onStop={promptId ? () => cancelPrompt(promptId) : undefined}
          sendLabel="Ask"
          ghost
        />
      </div>
    </div>
  )
}
