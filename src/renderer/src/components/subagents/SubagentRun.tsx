import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { pendingCount, useCrew } from '../../state/store'
import Composer, { COMPOSER_MAX } from '../Composer'
import FilesChanged from '../FilesChanged'
import RunAction from '../RunAction'
import RunEnded from '../RunEnded'
import RunStatus from '../RunStatus'
import ScrollFade from '../ScrollFade'
import ThreadItems from '../ThreadItems'
import { buildThread, eventsOfThread, lastEnd } from '../thread'
import { useThreadRead } from '../useThreadRead'
import { useFamilySteps } from '../useThreadSteps'
import { useAutoResize } from '../useAutoResize'
import { useDrawnTail } from '../useDrawnTail'
import useScrollEdges from '../useScrollEdges'
import { useStickToBottom } from '../useStickToBottom'
import { useRunState } from './runs'

// One helper, live. It is an ordinary thread, so the whole of this is the
// pieces a thread is already made of: its steps, its thinking, its diffs, the
// run status, and a composer that sends into that thread and nothing else.
// Steering falls out of that for free, because a message to a running steerable
// agent is folded into the turn it is already in.
//
// Nothing here says what the screen already says. What it is doing is on the
// header row above it, RunStatus says it is working, and the words are the
// helper's own, so a face and a name over the top of all three would be a third
// telling of it.
//
// The transcript never travels sideways. A panel is half the width the thread
// column is, so whatever stands past its edge is slack rather than something to
// go and read, and a bar under the words that scrolls to nothing is a control
// that does nothing. Anything in here that really has more to the right owns a
// scroller of its own: a code fence, a diff, a terminal card and a table are all
// overflow-x-auto inside their own box, so clipping the column costs none of it.
// The aside holds the same rule for the same reason.

const HELPER_PAGE = 400

export default function SubagentRun({ threadId }: { threadId: string }) {
  const { events, steps } = useThreadRead(threadId)
  const selfId = useCrew(state => state.selfId)
  const agents = useCrew(state => state.agents)
  const thread = useCrew(state => state.threads[threadId])
  const promptId = useCrew(state => state.threadPrompts[threadId])
  const tokens = useCrew(state => (promptId ? (state.tokens[promptId] ?? 0) : 0))
  const cost = useCrew(state => (promptId ? state.costs[promptId] : undefined))
  const text = useCrew(state => state.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(state => state.setThreadDraft)
  const sendChat = useCrew(state => state.sendChat)
  const stopSubagent = useCrew(state => state.stopSubagent)
  const restartSubagent = useCrew(state => state.restartSubagent)
  const steerable = useCrew(state => state.agents.find(one => one.id === thread?.agentId)?.steerable === true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrolledUp, onScroll, follow, jumpToBottom } = useStickToBottom(scrollRef, `subagent:${threadId}`)
  const { edges } = useScrollEdges(scrollRef)
  const inputRef = useAutoResize(text, COMPOSER_MAX)

  const threadEvents = useMemo(() => eventsOfThread(events, threadId), [events, threadId])
  // The work here is the helper's, so it stands under the name the agent made it
  // up with and the mark drawn from this run's own id.
  const helper = thread?.helper
  const as = useMemo(() => (helper ? { name: helper, seed: threadId } : undefined), [helper, threadId])
  const items = useMemo(
    () => buildThread(threadEvents, steps, selfId, agents, as),
    [threadEvents, steps, selfId, agents, as]
  )
  const tail = useDrawnTail(items.length, HELPER_PAGE, scrollRef, scrolledUp)
  const drawn = useMemo(() => (tail.from === 0 ? items : items.slice(tail.from)), [items, tail.from])
  const tailScroll = tail.onScroll
  const scrolled = useCallback(() => {
    onScroll()
    tailScroll()
  }, [onScroll, tailScroll])
  const threadSteps = useFamilySteps(threadId)
  const start = threadEvents.find(event => event.kind === 'agent.start' && event.promptId === promptId)
  const ended = lastEnd(threadId, threadEvents)
  const state = useRunState(threadId)

  useLayoutEffect(() => {
    follow()
  }, [items, follow])

  if (!thread) return null

  const working = Boolean(promptId)
  const send = () => {
    if (!text.trim() && pendingCount(threadId) === 0) return
    sendChat(text, threadId)
    jumpToBottom()
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 min-h-0 min-w-0">
        <div ref={scrollRef} onScroll={scrolled} className="h-full overflow-y-auto overflow-x-hidden px-4">
          <div className="space-y-4 pt-1 pb-4 select-text">
            <ThreadItems threadId={threadId} items={drawn} />
            {working && start?.kind === 'agent.start' ? (
              <RunStatus
                startedAt={start.ts}
                tokens={tokens}
                cost={cost}
                steps={promptId ? (steps[promptId] ?? []) : []}
              />
            ) : ended ? (
              <div className="space-y-3">
                {(state === 'failed' || state === 'stopped') && (
                  <RunAction label="Try again" onClick={() => restartSubagent(threadId)} />
                )}
                <RunEnded end={ended} />
              </div>
            ) : null}
            <FilesChanged steps={threadSteps} agentId={thread.agentId} />
          </div>
        </div>
        <ScrollFade edges={edges} />
      </div>

      <div className="shrink-0 px-4 pb-4">
        <Composer
          attachmentKey={threadId}
          value={text}
          placeholder="Say something to this one"
          inputRef={inputRef}
          onChange={value => setThreadDraft(threadId, value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          onSend={send}
          onStop={promptId ? () => stopSubagent(threadId) : undefined}
          sendLabel={working && steerable ? 'Steer' : 'Send'}
        />
      </div>
    </div>
  )
}
