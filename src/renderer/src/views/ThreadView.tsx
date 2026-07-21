import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { CheckIcon } from '@heroicons/react/24/outline'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import AgentIcon from '../components/AgentIcon'
import Composer from '../components/Composer'
import FilesChanged from '../components/FilesChanged'
import { hoverCardOpen } from '../components/HoverCard'
import { MemberName } from '../components/Mention'
import { useMentionPicker } from '../components/MentionPicker'
import QueueBar, { type QueuedMessage } from '../components/QueueBar'
import Pill from '../components/Pill'
import { usePresence } from '../components/presence'
import RunStatus from '../components/RunStatus'
import Spinner from '../components/Spinner'
import { Counts } from '../components/StepRow'
import ThreadItems from '../components/ThreadItems'
import Tooltip from '../components/Tooltip'
import { buildThread } from '../components/thread'
import { useAutoResize } from '../components/useAutoResize'
import { useCrew } from '../state/store'

export default function ThreadView({ threadId }: { threadId: string }) {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const selfId = useCrew(s => s.selfId)
  const thread = useCrew(s => s.threads[threadId])
  const activePromptId = useCrew(s => s.threadPrompts[threadId])
  const tokens = useCrew(s => (activePromptId ? (s.tokens[activePromptId] ?? 0) : 0))
  const sendChat = useCrew(s => s.sendChat)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const editQueued = useCrew(s => s.editQueued)
  const removeQueued = useCrew(s => s.removeQueued)
  const closeThread = useCrew(s => s.closeThread)
  const text = useCrew(s => s.threadDrafts[threadId] ?? '')
  const setThreadDraft = useCrew(s => s.setThreadDraft)
  const pendingCount = useCrew(s => (s.pending[threadId] ?? []).length)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useAutoResize(text)
  const mention = useMentionPicker(text, value => setThreadDraft(threadId, value), inputRef)
  const agentPresence = usePresence(thread?.agentLabel ?? '')

  const threadEvents = useMemo(() => events.filter(e => 'threadId' in e && e.threadId === threadId), [events, threadId])
  const runningStart = threadEvents.find(e => e.kind === 'agent.start' && e.promptId === activePromptId)
  const runningAgentId = runningStart?.kind === 'agent.start' ? runningStart.agentId : undefined
  const steerable = useCrew(s => s.agents.find(a => a.id === runningAgentId)?.steerable === true)
  const items = useMemo(() => buildThread(threadEvents, steps, selfId), [threadEvents, steps, selfId])
  const threadSteps = useMemo(() => {
    const promptIds = threadEvents.filter(e => e.kind === 'agent.start').map(e => e.promptId)
    return promptIds.flatMap(promptId => steps[promptId] ?? [])
  }, [threadEvents, steps])
  const queueItems = useCrew(s => s.queues[threadId])
  const queuedMessages = useMemo<QueuedMessage[]>(
    () =>
      (queueItems ?? []).map(item => ({
        promptId: item.promptId,
        author: item.authorName,
        self: item.authorId === selfId,
        text: item.text
      })),
    [queueItems, selfId]
  )
  const startedAt = runningStart?.ts
  const diffTotals = useMemo(() => {
    let added = 0
    let removed = 0
    const paths = new Set<string>()
    for (const step of threadSteps) {
      for (const file of step.files ?? []) {
        added += file.added
        removed += file.removed
        paths.add(file.path)
      }
    }
    return { added, removed, files: paths.size }
  }, [threadSteps])

  const didInitialScroll = useRef(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [overlayHeight, setOverlayHeight] = useState(240)

  useEffect(() => {
    const el = overlayRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setOverlayHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!didInitialScroll.current) {
      didInitialScroll.current = true
      el.scrollTop = el.scrollHeight
      return
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240 + overlayHeight
    if (nearBottom && !hoverCardOpen()) el.scrollTop = el.scrollHeight
  }, [items, overlayHeight])

  const send = () => {
    if (!text.trim() && pendingCount === 0) return
    sendChat(text, threadId)
    mention.close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  if (!thread) return null

  const canSteer = Boolean(activePromptId) && steerable
  const placeholder = 'Send a message or @ another agent'

  return (
    <div className="h-full relative">
      <div ref={scrollRef} className="h-full overflow-y-auto px-6">
        <div className="max-w-[660px] mx-auto pt-28 space-y-5" style={{ paddingBottom: Math.max(120, overlayHeight - 16) }}>
          <ThreadItems items={items} />
          {activePromptId && startedAt && (
            <RunStatus startedAt={startedAt} tokens={tokens} steps={steps[activePromptId] ?? []} />
          )}
          <FilesChanged steps={threadSteps} />
        </div>
      </div>

      <div ref={overlayRef} className="absolute inset-x-0 bottom-0 pointer-events-none">
        <div className="h-14 bg-gradient-to-t from-ink-900 to-transparent" />
        <div className="bg-ink-900 px-6 pb-6">
          <div className="max-w-[660px] mx-auto pointer-events-auto">
            <QueueBar items={queuedMessages} onEdit={editQueued} onRemove={removeQueued} />
            <div className="relative bg-ink-900 border border-b-0 border-ink-700 rounded-t-[30px] flex items-center gap-3 px-3 pt-2.5 pb-12 -mb-9">
              <Tooltip label="Back to chat">
                <button
                  onClick={closeThread}
                  aria-label="Back to chat"
                  className="w-10 h-10 rounded-full bg-ink-800 text-fg-secondary flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95 shrink-0"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
              </Tooltip>
              <MemberName name={thread.agentLabel}>
                <span className="flex items-center gap-3 min-w-0 cursor-default">
                  <AgentIcon seed={thread.agentId} presence={agentPresence} />
                  <span className="text-base font-bold text-fg truncate">{thread.agentLabel}</span>
                </span>
              </MemberName>
              <div className="ml-auto flex items-center gap-2 pr-2 shrink-0">
                {activePromptId ? (
                  <>
                    <Spinner size={16} className="text-fg" />
                    <span className="text-base font-semibold text-fg">Working</span>
                  </>
                ) : (
                  <>
                    <CheckIcon strokeWidth={2} className="w-5 h-5 text-fg" />
                    <span className="text-base font-semibold text-fg">Done</span>
                  </>
                )}
                {(diffTotals.added > 0 || diffTotals.removed > 0) && (
                  <Tooltip
                    label={`${diffTotals.added} ${diffTotals.added === 1 ? 'addition' : 'additions'} and ${diffTotals.removed} ${diffTotals.removed === 1 ? 'deletion' : 'deletions'}`}
                  >
                    <span className="ml-2 cursor-default">
                      <Pill lg>
                        <Counts added={diffTotals.added} removed={diffTotals.removed} size="sm" />
                      </Pill>
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="relative">
              <Composer
                attachmentKey={threadId}
                value={text}
                placeholder={placeholder}
                inputRef={inputRef}
                onChange={mention.onChange}
                onKeyDown={onKeyDown}
                onSend={send}
                onStop={activePromptId ? () => cancelPrompt(activePromptId) : undefined}
                sendLabel={canSteer ? 'Steer' : 'Send'}
              >
                {mention.menu}
              </Composer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
