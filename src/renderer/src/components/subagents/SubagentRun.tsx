import { useLayoutEffect, useMemo, useRef } from 'react'
import { pendingCount, useCrew } from '../../state/store'
import Composer from '../Composer'
import FilesChanged from '../FilesChanged'
import RunStatus from '../RunStatus'
import ThreadItems from '../ThreadItems'
import { buildThread, eventsOfThread } from '../thread'
import { useAutoResize } from '../useAutoResize'
import { useStickToBottom } from '../useStickToBottom'

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

export default function SubagentRun({ threadId }: { threadId: string }) {
  const events = useCrew(state => state.events)
  const steps = useCrew(state => state.steps)
  const selfId = useCrew(state => state.selfId)
  const agents = useCrew(state => state.agents)
  const thread = useCrew(state => state.threads[threadId])
  const promptId = useCrew(state => state.threadPrompts[threadId])
  const tokens = useCrew(state => (promptId ? (state.tokens[promptId] ?? 0) : 0))
  const cost = useCrew(state => (promptId ? state.costs[promptId] : undefined))
  const text = useCrew(state => state.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(state => state.setThreadDraft)
  const sendChat = useCrew(state => state.sendChat)
  const cancelPrompt = useCrew(state => state.cancelPrompt)
  const steerable = useCrew(state => state.agents.find(one => one.id === thread?.agentId)?.steerable === true)

  const scrollRef = useRef<HTMLDivElement>(null)
  const { onScroll, follow, jumpToBottom } = useStickToBottom(scrollRef, `subagent:${threadId}`)
  const inputRef = useAutoResize(text)

  const threadEvents = useMemo(() => eventsOfThread(events, threadId), [events, threadId])
  // The work here is the helper's, so it stands under the name the agent made it
  // up with and the mark drawn from this run's own id.
  const helper = thread?.helper
  const as = useMemo(() => (helper ? { name: helper, seed: threadId } : undefined), [helper, threadId])
  const items = useMemo(
    () => buildThread(threadEvents, steps, selfId, agents, as),
    [threadEvents, steps, selfId, agents, as]
  )
  const threadSteps = useMemo(() => {
    const ids = threadEvents.filter(event => event.kind === 'agent.start').map(event => event.promptId)
    return ids.flatMap(id => steps[id] ?? [])
  }, [threadEvents, steps])
  const start = threadEvents.find(event => event.kind === 'agent.start' && event.promptId === promptId)

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
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-4">
        <div className="space-y-4 pb-4 select-text">
          <ThreadItems items={items} />
          {working && start?.kind === 'agent.start' && (
            <RunStatus
              startedAt={start.ts}
              tokens={tokens}
              cost={cost}
              steps={promptId ? (steps[promptId] ?? []) : []}
            />
          )}
          <FilesChanged steps={threadSteps} />
        </div>
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
          onStop={promptId ? () => cancelPrompt(promptId) : undefined}
          sendLabel={working && steerable ? 'Steer' : 'Send'}
        />
      </div>
    </div>
  )
}
