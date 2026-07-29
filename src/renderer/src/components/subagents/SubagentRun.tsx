import { useLayoutEffect, useMemo, useRef } from 'react'
import { WarningGlyph } from '../../icons'
import { pendingCount, useCrew } from '../../state/store'
import Composer from '../Composer'
import FilesChanged from '../FilesChanged'
import RunStatus from '../RunStatus'
import Spinner from '../Spinner'
import SubagentMark from '../SubagentMark'
import ThreadItems from '../ThreadItems'
import { buildThread } from '../thread'
import { formatSpan } from '../time'
import { useAutoResize } from '../useAutoResize'
import { useStickToBottom } from '../useStickToBottom'
import { useRunState } from './runs'

// One helper, live. It is an ordinary thread, so the whole of this is the
// pieces a thread is already made of: its steps, its thinking, its diffs, the
// run status, and a composer that sends into that thread and nothing else.
// Steering falls out of that for free, because a message to a running steerable
// agent is folded into the turn it is already in.

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

  const threadEvents = useMemo(
    () => events.filter(event => 'threadId' in event && event.threadId === threadId),
    [events, threadId]
  )
  const items = useMemo(() => buildThread(threadEvents, steps, selfId, agents), [threadEvents, steps, selfId, agents])
  const threadSteps = useMemo(() => {
    const ids = threadEvents.filter(event => event.kind === 'agent.start').map(event => event.promptId)
    return ids.flatMap(id => steps[id] ?? [])
  }, [threadEvents, steps])
  const start = threadEvents.find(event => event.kind === 'agent.start' && event.promptId === promptId)
  const ended = useMemo(() => {
    for (let i = threadEvents.length - 1; i >= 0; i--) {
      const event = threadEvents[i]
      if (event.kind === 'subagent.ended') return event
    }
    return undefined
  }, [threadEvents])

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
      <div className="shrink-0 flex items-center gap-3 px-4 pb-3">
        <SubagentMark seed={threadId} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-fg truncate">{thread.subject ?? thread.title}</p>
          <p className="text-xs text-fg-faint truncate">
            {[thread.helper, thread.agentLabel].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {working ? (
            <>
              <Spinner size={14} className="text-fg-muted" />
              <span className="text-xs text-fg-muted">Working</span>
            </>
          ) : ended?.ok === false ? (
            <>
              <WarningGlyph className="w-4 h-4 text-danger" />
              <span className="text-xs text-danger">Stopped</span>
            </>
          ) : (
            <span className="text-xs text-fg-faint">{ended ? formatSpan(ended.ms) : ''}</span>
          )}
        </div>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-4">
        <div className="space-y-4 pb-4">
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
